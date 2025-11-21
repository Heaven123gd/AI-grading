export const APP_TITLE = "AI Grader Pro";

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Cost-Effective)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Reasoning & Complex Tasks)' },
];

// Mock Credentials for the requested Login feature
export const MOCK_USER = "teacher";
export const MOCK_PASS = "admin123";

export const DEFAULT_RUBRIC = `1. Accuracy (0-40 points): Is the solution correct?
2. Clarity (0-30 points): Is the code/answer easy to understand?
3. Completeness (0-30 points): Did the student answer all parts of the question?`;

export const DEFAULT_ASSIGNMENT = `Write a short essay about the impact of the Industrial Revolution on urbanization.`;
