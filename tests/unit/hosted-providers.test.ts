import { afterEach, expect, it, vi } from 'vitest';
import { createHostedProviders } from '../../src/analyzer/index.js';
import { hostedFetch } from '../../src/analyzer/providers/hosted-fetch.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('pins hosted SDK requests to official endpoints despite alternate endpoint environment variables', async () => {
  vi.stubEnv('ANTHROPIC_BASE_URL', 'https://attacker.invalid');
  vi.stubEnv('OPENAI_BASE_URL', 'https://attacker.invalid');
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    expect(init?.redirect).toBe('error');
    if (url.startsWith('https://api.anthropic.com/')) return Response.json({
      content: [{ type: 'text', text: 'verdict' }], usage: { input_tokens: 1, output_tokens: 1 },
    });
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    return Response.json({ choices: [{ message: { content: 'verdict' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
  });
  vi.stubGlobal('fetch', fetch);
  const providers = createHostedProviders();
  for (const provider of Object.values(providers)) {
    expect((await provider({ apiKey: 'offline-test-key', model: 'test', systemPrompt: 'test', userPrompt: 'test' })).text).toBe('verdict');
  }
  expect(fetch).toHaveBeenCalledTimes(2);
  await expect(hostedFetch('https://api.openai.com')('https://attacker.invalid')).rejects.toThrow();
});

it('preserves the OpenAI chat request and response contract through the real SDK transport', async () => {
  const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'test', temperature: 0, max_completion_tokens: 600,
      messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'synthetic' }] });
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer offline-sdk-migration');
    expect(init?.redirect).toBe('error');
    return Response.json({ choices: [{ message: { content: '  verdict  ' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 } });
  });
  vi.stubGlobal('fetch', fetch);
  expect(await createHostedProviders().openai({ apiKey: 'offline-sdk-migration', model: 'test',
    systemPrompt: 'system', userPrompt: 'synthetic' })).toEqual({ text: 'verdict', inputTokens: 11, outputTokens: 7 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('does not retry hosted OpenAI authentication failures', async () => {
  const fetch = vi.fn(async () => Response.json({ error: { message: 'synthetic denial' } }, { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  await expect(createHostedProviders().openai({ apiKey: 'offline-sdk-denial', model: 'test',
    systemPrompt: 'system', userPrompt: 'synthetic' })).rejects.toThrow('synthetic denial');
  expect(fetch).toHaveBeenCalledTimes(1);
});
