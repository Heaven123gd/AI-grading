export enum AppView {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD'
}

export enum GradingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface GradingResult {
  score: number;
  letterGrade: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
}

export interface StudentSubmission {
  id: string;
  fileName: string;
  fileType: string;
  fileContent: string; // Base64 or Text
  status: GradingStatus;
  result?: GradingResult;
  error?: string;
  lastModified: number;
}

export interface GradingConfig {
  assignmentPrompt: string;
  gradingRubric: string;
  model: string;
}
