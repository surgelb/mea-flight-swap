import OpenAI from 'openai';

const apiKey = process.env.OPENROUTER_API_KEY;

export const openai = apiKey
  ? new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.NEXT_PUBLIC_SITE_TITLE || 'MEA Flight Swap',
      },
    })
  : null;

interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export async function generateContentWithFallback(
  input: string | Array<GeminiContentPart | string>,
  config?: { responseMimeType?: string; maxTokens?: number }
) {
  if (!openai) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  // Convert Google Gen AI inputs to OpenAI Chat Completion messages format
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  const responseFormatJson = config?.responseMimeType === 'application/json';

  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    for (const item of input) {
      if (typeof item === 'string') {
        userContent.push({ type: 'text', text: item });
      } else {
        const part = item as GeminiContentPart;
        if (part.text) {
          userContent.push({ type: 'text', text: part.text });
        } else if (part.inlineData) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            },
          });
        }
      }
    }
    messages.push({ role: 'user', content: userContent });
  }

  // OpenRouter models to cascade try (defaulting to fast, reliable, JSON-capable options)
  const models = [
    'google/gemini-2.5-flash',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct',
    'meta-llama/llama-3.3-70b-instruct:free',
  ];
  let lastError: unknown = null;

  for (const model of models) {
    try {
      console.log(`[OpenRouter] Attempting completion with model: ${model}`);
      
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
        response_format: responseFormatJson ? { type: 'json_object' } : undefined,
        max_tokens: config?.maxTokens || 4000,
      };

      const response = await openai.chat.completions.create(completionParams);
      console.log(`[OpenRouter] Completion successful with model: ${model}`);
      return {
        text: response.choices[0]?.message?.content || '',
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[OpenRouter] Model ${model} failed. Error:`,
        errMsg
      );
      lastError = error;
      // Continue to next model in the cascade
    }
  }

  throw lastError || new Error('All OpenRouter models failed to generate content');
}
