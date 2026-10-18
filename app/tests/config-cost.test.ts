import { expect, it, vi } from 'vitest';
import { repositoryConfig, scanPR } from '../src/pipeline.js';
import { job, mockGitHub } from './helpers.js';

const source = 'eval(req.query.a);\neval(req.query.b);\neval(req.query.c);\n';
const diff = '--- a/src/code.ts\n+++ b/src/code.ts\n@@ -0,0 +1,3 @@\n+eval(req.query.a);\n+eval(req.query.b);\n+eval(req.query.c);\n';
const env = { CODEGUARD_API_KEY: 'server-test-key', CODEGUARD_MODEL: 'claude-sonnet-5' };
it('reuses environment key precedence while ignoring repository credential and provider settings', () => {
  const config = repositoryConfig('llm:\n  apiKey: attacker\n  provider: openai\n  model: hostile\n  maxCostUSD: 999', { ...env, CODEGUARD_MAX_COST: '0.5' });
  expect(config.llm.apiKey).toBe('server-test-key'); expect(config.llm.provider).toBe('claude');
  expect(config.llm.model).toBe('claude-sonnet-5'); expect(config.llm.maxCostUSD).toBe(0.5);
  expect(repositoryConfig('llm:\n  maxCostUSD: 0', env).llm.maxCostUSD).toBe(0);
  const openai = repositoryConfig('', { CODEGUARD_PROVIDER: 'openai', OPENAI_API_KEY: 'openai-test' });
  expect(openai.llm.apiKey).toBe('openai-test'); expect(openai.llm.model).toBe('gpt-4o-mini');
  for (const value of ['-1', '.nan', 'hostile']) expect(() => repositoryConfig(`llm:\n  maxCostUSD: ${value}`, env)).toThrow();
});
it('runs Stage 2 only on changed candidates with a BYO deployment key', async () => {
  const gh = mockGitHub(source, diff);
  const provider = vi.fn(async (request: { apiKey: string; userPrompt: string }) => {
    expect(request.apiKey).toBe(env.CODEGUARD_API_KEY);
    expect(request.userPrompt).not.toContain(env.CODEGUARD_API_KEY);
    return { text: JSON.stringify({ confirmed: false, confidence: 0.9, reasoning: 'fixture verdict' }), inputTokens: 100, outputTokens: 20 };
  });
  const result = await scanPR(gh.client, job, { env, analyzer: { providers: { claude: provider } } });
  expect(provider).toHaveBeenCalledTimes(3); expect(result?.dryRun).toBe(false);
  expect(result?.result.findings).toHaveLength(0); expect(result?.result.dismissedFindings).toHaveLength(3);
  expect(JSON.stringify(result)).not.toContain(env.CODEGUARD_API_KEY);
});
it('enforces zero and small budgets before requests and records deferred candidates', async () => {
  for (const cost of ['0', '0.0001', '0.03']) {
    const gh = mockGitHub(source, diff, { '.codeguard.yml': `llm:\n  maxCostUSD: ${cost}` });
    const provider = vi.fn(async () => ({ text: JSON.stringify({ confirmed: true, confidence: 0.9, reasoning: 'fixture verdict' }), inputTokens: 100, outputTokens: 20 }));
    const result = await scanPR(gh.client, job, { env, analyzer: { providers: { claude: provider } } });
    expect(result?.incomplete).toBe(true); expect(result?.budgetDeferred?.length).toBeGreaterThan(0);
    expect(result?.result.estimatedCost).toBeLessThanOrEqual(Number(cost));
    expect(result?.result.findings.length! + result?.budgetDeferred?.length!).toBe(3);
    if (cost !== '0.03') expect(provider).not.toHaveBeenCalled();
    else expect(provider).toHaveBeenCalledTimes(1);
  }
});
it('keeps provider failures untriaged rather than presenting them as AI confirmation', async () => {
  const result = await scanPR(mockGitHub(source, diff).client, job, { env,
    analyzer: { providers: { claude: async () => { throw new Error('key=' + env.CODEGUARD_API_KEY); } } } });
  expect(result?.incomplete).toBe(true); expect(result?.untriaged).toHaveLength(3);
  expect(result?.result.findings).toHaveLength(0); expect(JSON.stringify(result)).not.toContain(env.CODEGUARD_API_KEY);
});
it('rejects expansive untrusted exclude globs before scanning', () => {
  for (const pattern of ['{1..100000000}', '**/@(a|b)', 'x'.repeat(257)]) {
    expect(() => repositoryConfig(`scan:\n  exclude: [${JSON.stringify(pattern)}]`)).toThrow();
  }
});
