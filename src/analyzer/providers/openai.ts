import OpenAI from 'openai';
import { hostedFetch } from './hosted-fetch.js';

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;
let cachedHosted = false;

function getClient(apiKey: string, hosted: boolean): OpenAI {
  if (cachedClient && cachedApiKey === apiKey && cachedHosted === hosted) {
    return cachedClient;
  }
  cachedClient = new OpenAI({ apiKey, ...(hosted ? {
    baseURL: 'https://api.openai.com/v1', maxRetries: 0, timeout: 30_000,
    fetch: hostedFetch('https://api.openai.com'),
  } : {}) });
  cachedApiKey = apiKey;
  cachedHosted = hosted;
  return cachedClient;
}

export async function analyzeWithOpenAI(request: {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}, hosted = false): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const client = getClient(request.apiKey, hosted);

  const response = await client.chat.completions.create({
    model: request.model,
    temperature: 0,
    max_completion_tokens: 600,
    messages: [
      {
        role: 'system',
        content: request.systemPrompt,
      },
      {
        role: 'user',
        content: request.userPrompt,
      },
    ],
  });

  return {
    text: response.choices[0]?.message?.content?.trim() ?? '',
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}
