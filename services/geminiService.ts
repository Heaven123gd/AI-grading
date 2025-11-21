import { GoogleGenAI, Type } from "@google/genai";
import { GradingConfig, GradingResult } from "../types";

// Initialize API Client
// Note: process.env.API_KEY is assumed to be available in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: "The numerical score based on the rubric." },
    letterGrade: { type: Type.STRING, description: "The letter grade (A, B, C, D, F)." },
    summary: { type: Type.STRING, description: "A brief summary of the grading." },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of strong points in the submission."
    },
    improvements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of areas for improvement."
    },
    detailedFeedback: { type: Type.STRING, description: "Comprehensive feedback explaining the score." }
  },
  required: ["score", "letterGrade", "summary", "strengths", "improvements", "detailedFeedback"],
};

export const gradeSubmission = async (
  fileContent: string,
  mimeType: string,
  config: GradingConfig
): Promise<GradingResult> => {
  try {
    const promptText = `
      You are an expert academic grader. 
      
      Assignment Description:
      ${config.assignmentPrompt}

      Grading Rubric/Criteria:
      ${config.gradingRubric}

      Instructions:
      1. Analyze the student submission based strictly on the rubric.
      2. **IMPORTANT: Detect the language used in the student submission (e.g., Chinese, English, Spanish).**
      3. **You MUST write the 'summary', 'strengths', 'improvements', and 'detailedFeedback' in the SAME language as the student submission.** 
      4. If the submission is in Chinese, your feedback must be in Chinese.
      5. Provide the output in structured JSON format.
    `;

    const parts: any[] = [{ text: promptText }];

    if (mimeType === 'application/pdf') {
      // Handle PDF via multimodal inlineData
      const base64Data = fileContent.includes('base64,') 
        ? fileContent.split('base64,')[1] 
        : fileContent;
      
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      });
    } else {
      // Handle Text (including code or extracted text from DOCX)
      parts.push({
        text: `[STUDENT SUBMISSION CONTENT START]\n${fileContent}\n[STUDENT SUBMISSION CONTENT END]`
      });
    }

    const response = await ai.models.generateContent({
      model: config.model,
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for consistent grading
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text) as GradingResult;
      return result;
    } else {
      throw new Error("No response text received from model.");
    }

  } catch (error) {
    console.error("Grading Error:", error);
    throw error;
  }
};