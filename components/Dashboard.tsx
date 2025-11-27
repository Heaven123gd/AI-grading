import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS, DEFAULT_ASSIGNMENT, DEFAULT_RUBRIC, APP_TITLE } from '../constants';
import { GradingConfig, GradingStatus, StudentSubmission, GradingResult } from '../types';
import { gradeSubmission } from '../services/geminiService';
import { UploadIcon, FileTextIcon, LoaderIcon, CheckCircleIcon, AlertCircleIcon, DownloadIcon, TrashIcon, EditIcon, GradingIllustration, FilePdfIcon, FileSpreadsheetIcon, RefreshIcon } from './Icons';

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [config, setConfig] = useState<GradingConfig>({
    assignmentPrompt: DEFAULT_ASSIGNMENT,
    gradingRubric: DEFAULT_RUBRIC,
    model: AVAILABLE_MODELS[0].id
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Derived state for the active detailed view. 
  // This ensures that if 'submissions' array updates (e.g. during re-analysis), the detail view updates immediately.
  const activeSubmission = selectedSubmission 
    ? submissions.find(s => s.id === selectedSubmission.id) || null
    : null;

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- File Handling ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files: File[] = Array.from(e.target.files);
    const newSubmissions: StudentSubmission[] = [];

    await Promise.all(files.map(async (file) => {
      try {
        const id = Math.random().toString(36).substr(2, 9);
        let content = "";
        let type = file.type;
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'docx') {
          // Handle Word Documents using Mammoth
          if ((window as any).mammoth) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
              content = result.value;
              type = 'text/plain'; // Treat extracted content as text
              if (result.messages.length > 0) {
                console.warn("Mammoth messages:", result.messages);
              }
            } catch (err) {
              console.error("DOCX parsing error", err);
              content = "Error parsing Word document. Please try converting to PDF.";
              type = 'error';
            }
          } else {
            content = "Error: Word processor library not loaded. Please refresh.";
            type = 'error';
          }
        } else if (type === 'application/pdf') {
          // Handle PDF: Read as Base64 Data URL
          content = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target?.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          // Handle Text/Code: Read as Text
          content = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target?.result as string);
            reader.readAsText(file);
          });
          type = 'text/plain';
        }

        newSubmissions.push({
          id,
          fileName: file.name,
          fileType: type,
          fileContent: content,
          status: type === 'error' ? GradingStatus.ERROR : GradingStatus.PENDING,
          error: type === 'error' ? content : undefined,
          lastModified: file.lastModified
        });

      } catch (err: any) {
        console.error("File processing error:", err);
      }
    }));

    setSubmissions(prev => [...prev, ...newSubmissions]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = (id: string) => {
    setSubmissions(prev => prev.filter(s => s.id !== id));
    if (selectedSubmission?.id === id) {
      setSelectedSubmission(null);
      setIsEditing(false);
    }
  };

  // --- Grading Logic ---
  const handleGradeAll = async () => {
    const pending = submissions.filter(s => s.status === GradingStatus.PENDING || s.status === GradingStatus.ERROR);
    if (pending.length === 0) return;

    setIsProcessing(true);

    for (const sub of pending) {
      if (sub.status === GradingStatus.ERROR && sub.error?.includes("Error")) {
         continue;
      }

      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: GradingStatus.PROCESSING, error: undefined } : s));
      try {
        const result = await gradeSubmission(sub.fileContent, sub.fileType, config);
        setSubmissions(prev => prev.map(s => 
          s.id === sub.id ? { ...s, status: GradingStatus.COMPLETED, result } : s
        ));
      } catch (error: any) {
        setSubmissions(prev => prev.map(s => 
          s.id === sub.id ? { ...s, status: GradingStatus.ERROR, error: error.message || "Unknown error" } : s
        ));
      }
    }
    setIsProcessing(false);
  };

  const handleReanalyze = async (id: string) => {
    const sub = submissions.find(s => s.id === id);
    if (!sub) return;

    setIsProcessing(true);
    // Set status to PROCESSING
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: GradingStatus.PROCESSING, error: undefined } : s));

    try {
      const result = await gradeSubmission(sub.fileContent, sub.fileType, config);
      setSubmissions(prev => prev.map(s => 
        s.id === id ? { ...s, status: GradingStatus.COMPLETED, result } : s
      ));
    } catch (error: any) {
      setSubmissions(prev => prev.map(s => 
        s.id === id ? { ...s, status: GradingStatus.ERROR, error: error.message || "Unknown error" } : s
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Export Logic ---
  const handleExportSummary = () => {
    if (submissions.length === 0) return;
    const headers = ['File Name', 'Status', 'Score', 'Letter Grade', 'Summary'];
    const rows = submissions.map(s => [
      s.fileName,
      s.status,
      s.result?.score || 0,
      s.result?.letterGrade || '-',
      `"${(s.result?.summary || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `grading_summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportPDF = async () => {
    const completedSubmissions = submissions.filter(s => s.status === GradingStatus.COMPLETED && s.result);
    if (completedSubmissions.length === 0) return;
    setShowExportMenu(false);

    // 1. Create a hidden container for rendering
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-10000px';
    container.style.left = '0';
    container.style.width = '794px'; // A4 width in px at 96 DPI
    // Remove minHeight to prevent forcing extra whitespace at the bottom
    // container.style.minHeight = '1123px'; 
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '-1000';
    document.body.appendChild(container);

    try {
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < completedSubmissions.length; i++) {
        const sub = completedSubmissions[i];
        const result = sub.result!;
        const isPass = ['A', 'B', 'C'].some(g => result.letterGrade.includes(g));
        const scoreColor = isPass ? '#059669' : '#e11d48';
        const gradeBg = isPass ? '#ecfdf5' : '#fff1f2';

        // 2. Render HTML for this student
        container.innerHTML = `
          <div style="padding: 40px; background: white; font-family: 'Microsoft YaHei', 'SimHei', sans-serif; color: #1e293b; box-sizing: border-box; width: 794px;">
             <!-- Header -->
             <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
                <div style="max-width: 70%;">
                   <h1 style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2;">${sub.fileName}</h1>
                   <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Graded on: ${new Date().toLocaleDateString()}</p>
                </div>
                <div style="text-align: right;">
                   <div style="font-size: 14px; font-weight: bold; color: #4f46e5; background: #eef2ff; padding: 6px 12px; border-radius: 6px; display: inline-block;">
                     AI Grader Pro
                   </div>
                </div>
             </div>

             <!-- Score Overview -->
             <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: center;">
                   <span style="display: block; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Total Score</span>
                   <span style="font-size: 42px; font-weight: 900; color: #4f46e5;">${result.score}</span>
                </div>
                <div style="flex: 1; background: ${gradeBg}; border: 1px solid ${isPass ? '#a7f3d0' : '#fecdd3'}; border-radius: 12px; padding: 25px; text-align: center;">
                   <span style="display: block; font-size: 12px; font-weight: bold; text-transform: uppercase; color: ${isPass ? '#065f46' : '#9f1239'}; margin-bottom: 8px;">Grade</span>
                   <span style="font-size: 42px; font-weight: 900; color: ${scoreColor};">${result.letterGrade}</span>
                </div>
             </div>

             <!-- Summary -->
             <div style="margin-bottom: 25px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
                <div style="background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #cbd5e1;">
                   <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #334155; text-transform: uppercase;">Executive Summary</h3>
                </div>
                <div style="padding: 20px; font-size: 14px; color: #334155; line-height: 1.6;">
                   ${result.summary}
                </div>
             </div>

             <!-- Grid -->
             <div style="display: flex; gap: 20px; margin-bottom: 25px;">
                <!-- Strengths -->
                <div style="flex: 1; border: 1px solid #a7f3d0; border-radius: 12px; overflow: hidden;">
                   <div style="background: #d1fae5; padding: 12px 20px; border-bottom: 1px solid #a7f3d0;">
                      <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #065f46;">Strengths</h3>
                   </div>
                   <div style="padding: 20px; background: #ecfdf5; height: 100%;">
                     <ul style="margin: 0; padding-left: 20px; color: #064e3b; font-size: 13px; line-height: 1.6;">
                       ${result.strengths.map(s => `<li style="margin-bottom: 6px;">${s}</li>`).join('')}
                     </ul>
                   </div>
                </div>

                <!-- Improvements -->
                <div style="flex: 1; border: 1px solid #fde68a; border-radius: 12px; overflow: hidden;">
                   <div style="background: #fef3c7; padding: 12px 20px; border-bottom: 1px solid #fde68a;">
                      <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #92400e;">Improvements</h3>
                   </div>
                   <div style="padding: 20px; background: #fffbeb; height: 100%;">
                     <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 13px; line-height: 1.6;">
                       ${result.improvements.map(s => `<li style="margin-bottom: 6px;">${s}</li>`).join('')}
                     </ul>
                   </div>
                </div>
             </div>

             <!-- Detailed Feedback -->
             <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: #f8fafc; padding: 12px 20px; border-bottom: 1px solid #e2e8f0;">
                  <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #334155; text-transform: uppercase;">Detailed Feedback</h3>
                </div>
                <div style="padding: 20px; font-size: 13px; color: #475569; line-height: 1.8; white-space: pre-wrap;">${result.detailedFeedback}</div>
             </div>
          </div>
        `;

        // 3. Convert DOM to Canvas using html2canvas
        const canvas = await (window as any).html2canvas(container, {
           scale: 2,
           useCORS: true,
           logging: false,
           windowWidth: 794
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgProps = pdf.getImageProperties(imgData);
        
        // 4. Add to PDF
        const imgWidth = pdfWidth;
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Add new page for subsequent students
        if (i > 0) pdf.addPage();

        // First page of this student
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Only add extra pages if significant content remains (threshold of 20pt to avoid blank pages from tiny overflows)
        while (heightLeft > 20) {
           position = heightLeft - imgHeight; 
           pdf.addPage();
           pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
           heightLeft -= pdfHeight;
        }
      }

      pdf.save(`Grading_Report_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (error) {
      console.error("PDF Generation Error", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      document.body.removeChild(container);
    }
  };

  // --- Edit Logic ---
  const handleSaveEdit = (updatedResult: GradingResult) => {
    if (!activeSubmission) return;
    setSubmissions(prev => prev.map(s => s.id === activeSubmission.id ? { ...s, result: updatedResult } : s));
    // We don't need to set 'selectedSubmission' result specifically since activeSubmission is derived from submissions list
    setIsEditing(false);
  };

  // --- Sub-components ---
  const StatusBadge = ({ status }: { status: GradingStatus }) => {
    switch (status) {
      case GradingStatus.PENDING: 
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Pending</span>;
      case GradingStatus.PROCESSING: 
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1"><LoaderIcon className="w-3 h-3 animate-spin"/> Processing</span>;
      case GradingStatus.COMPLETED: 
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Graded</span>;
      case GradingStatus.ERROR: 
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-1"><AlertCircleIcon className="w-3 h-3"/> Failed</span>;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Modern Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-sm">
             <FileTextIcon className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">{APP_TITLE}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
             <span className="text-xs font-semibold text-slate-700">Teacher Account</span>
             <span className="text-[10px] text-slate-400 uppercase tracking-wider">Standard Plan</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
            T
          </div>
          <button onClick={onLogout} className="text-slate-500 hover:text-slate-800 text-sm font-medium transition">
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        
        {/* Left Panel: Configuration Card */}
        <aside className="w-[360px] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Configuration
            </h2>
          </div>
          
          <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
            <div>
              <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">AI Model</label>
              <div className="relative">
                <select 
                  className="w-full appearance-none p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm text-indigo-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  value={config.model}
                  onChange={(e) => setConfig({...config, model: e.target.value})}
                  disabled={isProcessing}
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-400">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Assignment Prompt</label>
              <textarea 
                className="w-full p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-sm text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-y transition-all placeholder-blue-300 min-h-[100px]"
                value={config.assignmentPrompt}
                onChange={(e) => setConfig({...config, assignmentPrompt: e.target.value})}
                placeholder="Describe what the students are expected to do..."
                disabled={isProcessing}
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Grading Rubric</label>
              <textarea 
                className="w-full p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-sm text-slate-700 font-mono focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none resize-y transition-all placeholder-rose-300 min-h-[150px]"
                value={config.gradingRubric}
                onChange={(e) => setConfig({...config, gradingRubric: e.target.value})}
                placeholder="Criteria 1: (0-10 pts)..."
                disabled={isProcessing}
              />
            </div>

             {/* Cartoon Image Area */}
            <div className="flex justify-center items-end pt-2 mt-auto">
               <GradingIllustration className="w-40 h-32 opacity-90 hover:opacity-100 transition-opacity duration-500" />
            </div>
          </div>
        </aside>

        {/* Center Panel: Main Workspace */}
        <main className="flex-1 flex flex-col min-w-[400px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
            <div>
              <h2 className="font-bold text-slate-800">Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Supported: PDF, Word (.docx), Text, Code</p>
            </div>
            <div className="flex gap-2">
              <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".txt,.md,.js,.py,.java,.cpp,.html,.css,.json,.pdf,.docx"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition shadow-sm active:translate-y-0.5"
                disabled={isProcessing}
              >
                <UploadIcon className="w-4 h-4" /> Upload
              </button>
              <button 
                onClick={handleGradeAll}
                disabled={isProcessing || submissions.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-md transition active:translate-y-0.5 ${
                  isProcessing || submissions.length === 0 
                    ? 'bg-indigo-300 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isProcessing ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                {isProcessing ? 'Grading...' : 'Grade All'}
              </button>
              
              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={submissions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DownloadIcon className="w-4 h-4" /> Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-30 animate-fade-in">
                    <button 
                      onClick={handleExportSummary}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-3 transition"
                    >
                      <FileSpreadsheetIcon className="w-4 h-4" />
                      <div>
                        <span className="block font-medium">Summary (Excel/CSV)</span>
                        <span className="block text-[10px] text-slate-400">Spreadsheet table of all grades</span>
                      </div>
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-3 transition"
                    >
                      <FilePdfIcon className="w-4 h-4" />
                      <div>
                        <span className="block font-medium">Details (PDF)</span>
                        <span className="block text-[10px] text-slate-400">One page per submission</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
            {submissions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-4 bg-slate-50/50">
                <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                  <UploadIcon className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-600 font-medium">No files uploaded yet</h3>
                <p className="text-sm mt-1">Upload text, code, PDF, or Word files to begin grading</p>
              </div>
            )}
            {submissions.map(sub => (
              <div 
                key={sub.id}
                onClick={() => setSelectedSubmission(sub)}
                className={`group relative bg-white p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                  activeSubmission?.id === sub.id 
                    ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/20' 
                    : 'border-slate-200 shadow-sm hover:border-indigo-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                       sub.status === GradingStatus.COMPLETED ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                       {sub.fileName.split('.').pop()?.toUpperCase() || 'TXT'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{sub.fileName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={sub.status} />
                        {sub.status === GradingStatus.COMPLETED && (
                           <span className="text-xs text-slate-500 font-medium px-2 border-l border-slate-200">
                             Score: <span className="text-slate-800">{sub.result?.score}</span>
                           </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(sub.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Right Panel: Detail Card */}
        {activeSubmission && (
          <aside className="w-[450px] bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden shrink-0 animate-slide-in">
            <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-start">
              <div className="min-w-0">
                 <h3 className="font-bold text-lg text-slate-800 truncate leading-tight" title={activeSubmission.fileName}>
                  {activeSubmission.fileName}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Last modified: {new Date(activeSubmission.lastModified).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1">
                 {/* Re-analyze Button */}
                 {(activeSubmission.status === GradingStatus.COMPLETED || activeSubmission.status === GradingStatus.ERROR) && !isEditing && !isProcessing && (
                  <button 
                    onClick={() => handleReanalyze(activeSubmission.id)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="Re-analyze"
                  >
                    <RefreshIcon className="w-4 h-4" />
                  </button>
                 )}

                 {activeSubmission.status === GradingStatus.COMPLETED && !isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="Edit Grade"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                )}
                <button 
                   onClick={() => { setSelectedSubmission(null); setIsEditing(false); }} 
                   className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
              {activeSubmission.status === GradingStatus.PROCESSING && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                       <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin"/>
                    </div>
                    <p className="font-medium text-indigo-600">Analyzing Submission...</p>
                 </div>
              )}

              {activeSubmission.status === GradingStatus.ERROR && (
                <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-100 mb-4">
                  <h4 className="font-bold flex items-center gap-2 text-sm"><AlertCircleIcon className="w-4 h-4"/> Grading Error</h4>
                  <p className="text-sm mt-1 opacity-90">{activeSubmission.error}</p>
                  <button 
                    onClick={() => handleReanalyze(activeSubmission.id)}
                    className="mt-3 text-xs font-bold bg-white border border-rose-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-rose-100 transition"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {activeSubmission.status === GradingStatus.COMPLETED && activeSubmission.result && (
                isEditing ? (
                  <EditForm 
                    result={activeSubmission.result} 
                    onSave={handleSaveEdit} 
                    onCancel={() => setIsEditing(false)} 
                  />
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    {/* Score Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
                      <div className="text-center flex-1">
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Total Score</span>
                        <span className="text-4xl font-extrabold text-indigo-600 tracking-tight">{activeSubmission.result.score}</span>
                      </div>
                      <div className="h-10 w-px bg-slate-100"></div>
                      <div className="text-center flex-1">
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Grade</span>
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xl font-bold ${
                            ['A', 'B'].some(g => activeSubmission.result?.letterGrade.includes(g)) ? 'bg-emerald-100 text-emerald-700' : 
                            activeSubmission.result?.letterGrade.includes('C') ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                            {activeSubmission.result.letterGrade}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Summary</h4>
                      <div className="bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-600 leading-relaxed shadow-sm">
                        {activeSubmission.result.summary}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                        <h4 className="font-bold text-emerald-800 text-sm mb-3 flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4"/> Strengths
                        </h4>
                        <ul className="space-y-2">
                          {activeSubmission.result.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <span className="block w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                        <h4 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Improvements
                        </h4>
                        <ul className="space-y-2">
                          {activeSubmission.result.improvements.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <span className="block w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-400 shrink-0"></span>
                                {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2 pb-4">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Detailed Feedback</h4>
                      <div className="bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-600 leading-relaxed shadow-sm whitespace-pre-wrap">
                        {activeSubmission.result.detailedFeedback}
                      </div>
                    </div>
                  </div>
                )
              )}

              {!activeSubmission.result && activeSubmission.status === GradingStatus.PENDING && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                   <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <FileTextIcon className="w-8 h-8 opacity-50"/>
                   </div>
                   <div className="text-center">
                      <p className="font-medium text-slate-600">No Analysis Available</p>
                      <p className="text-xs mt-1 max-w-[200px] mx-auto">Content is waiting to be processed.</p>
                   </div>
                    <button 
                       onClick={handleGradeAll}
                       className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-200 hover:bg-indigo-700 transition"
                    >
                      Start Grading
                    </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

// --- Edit Form Component ---
const EditForm = ({ result, onSave, onCancel }: { result: GradingResult, onSave: (r: GradingResult) => void, onCancel: () => void }) => {
  const [edited, setEdited] = useState<GradingResult>({ ...result });

  const handleChange = (field: keyof GradingResult, value: any) => {
    setEdited(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 bg-white p-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Score</label>
          <input 
            type="number" 
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            value={edited.score}
            onChange={(e) => handleChange('score', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Grade</label>
          <input 
            type="text" 
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            value={edited.letterGrade}
            onChange={(e) => handleChange('letterGrade', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Summary</label>
        <textarea 
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
          rows={3}
          value={edited.summary}
          onChange={(e) => handleChange('summary', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Strengths</label>
        <textarea 
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
          rows={4}
          value={edited.strengths.join('\n')}
          onChange={(e) => handleChange('strengths', e.target.value.split('\n'))}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Improvements</label>
        <textarea 
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
          rows={4}
          value={edited.improvements.join('\n')}
          onChange={(e) => handleChange('improvements', e.target.value.split('\n'))}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Detailed Feedback</label>
        <textarea 
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
          rows={6}
          value={edited.detailedFeedback}
          onChange={(e) => handleChange('detailedFeedback', e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          onClick={onCancel}
          className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button 
          onClick={() => onSave(edited)}
          className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};