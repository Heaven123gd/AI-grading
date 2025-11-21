import React, { useState } from 'react';
import { MOCK_USER, MOCK_PASS } from '../constants';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Simulate a brief network delay
    setTimeout(() => {
      if (username === MOCK_USER && password === MOCK_PASS) {
        onLoginSuccess();
      } else {
        setError('Invalid credentials. Please check your username or password.');
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50 to-indigo-100 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-700 relative overflow-hidden">
      {/* Abstract background shapes with smooth animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-200/30 blur-[120px] animate-pulse" style={{animationDuration: '8s'}}></div>
          <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-fuchsia-100/40 blur-[100px] animate-pulse" style={{animationDuration: '12s'}}></div>
          <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-cyan-50/60 blur-[100px] animate-pulse" style={{animationDuration: '10s'}}></div>
      </div>

      <div className="relative w-full max-w-[400px] mx-4">
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="mb-8 text-center">
              <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 text-white mb-4 transform transition-transform hover:scale-105 hover:rotate-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">AI Grader Pro</h1>
              <p className="text-sm text-slate-500 mt-2 font-medium">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300 placeholder:text-slate-300"
                placeholder="Enter username"
              />
            </div>
            
            <div>
               <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300 placeholder:text-slate-300"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium flex items-start gap-2 border border-rose-100 animate-in fade-in slide-in-from-top-1 duration-300">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-lg shadow-slate-200 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center mt-2"
            >
              {isLoading ? (
                 <span className="inline-flex items-center gap-2 text-sm">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                 </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-slate-50/80 border border-slate-100">
               <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Test Account</p>
               <p className="text-xs font-mono text-slate-600">
                 <span className="font-semibold select-all">{MOCK_USER}</span>
                 <span className="mx-2 text-slate-300">|</span>
                 <span className="font-semibold select-all">{MOCK_PASS}</span>
               </p>
            </div>
          </div>
        </div>
        
        <footer className="text-center mt-8">
           <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} AI Grader Pro</p>
        </footer>
      </div>
    </div>
  );
};