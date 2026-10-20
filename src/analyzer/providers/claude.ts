import Anthropic from '@anthropic-ai/sdk';
import { hostedFetch } from './hosted-fetch.js';

let cachedClient: Anthropic | null = null;
let cachedApiKey: string | null = null;
let cachedHosted = false;

function getClient(apiKey: string, hosted: boolean): Anthropic {
  if (cachedClient && cachedApiKey === apiKey && cachedHosted === hosted) {
    return cachedClient;
  }
  cachedClient = new Anthropic({ apiKey, ...(hosted ? {
    baseURL: 'https://api.anthropic.com', maxRetries: 0, timeout: 30_000,
    fetch: hostedFetch('https://api.anthropic.com'),
  } : {}) });
  cachedApiKey = apiKey;
  cachedHosted = hosted;
  return cachedClient;
}

export async function analyzeWithClaude(request: {
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

  const response = await client.messages.create({
    model: request.model,
    max_tokens: 600,
    system: request.systemPrompt,
    messages: [
      {
        role: 'user',
        content: request.userPrompt,
      },
    ],
  });

  const text = response.content
    .flatMap(block => block.type === 'text' ? [block.text] : [])
    .join('\n')
    .trim();

  return {
    text,
    inputTokens: response.usage.input_tokens
      + (response.usage.cache_creation_input_tokens ?? 0)
      + (response.usage.cache_read_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
  };
}
