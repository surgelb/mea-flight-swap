import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function generateContentWithFallback(
  contents: any,
  config?: any
) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Define fallback models: we try 2.5-flash first, then robust 1.5-flash, then 2.0-flash as a third option
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Gemini] Attempting content generation with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      console.log(`[Gemini] Content generation successful with model: ${model}`);
      return response;
    } catch (error: any) {
      console.warn(`[Gemini] Model ${model} failed. Error details:`, error?.message || error);
      lastError = error;
      // Continue loop to try the next model
    }
  }

  throw lastError || new Error('All Gemini models failed to generate content');
}
