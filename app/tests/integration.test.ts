import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import { processPR } from '../src/review.js';
import { reviewClient } from './helpers.js';
import { signed } from './webhook.js';

it('processes a signed fixture webhook through the real scanner, reviews, summary and reused check', async () => {
  const source = await readFile(new URL('../../tests/fixtures/vulnerable/injection.ts', import.meta.url), 'utf8');
  const lines = source.split('\n');
  const line = lines.findIndex(s => s.includes('return eval(expr)')) + 1;
  const diff = `--- a/src/code.ts\n+++ b/src/code.ts\n@@ -${line - 1},0 +${line},1 @@\n+${lines[line - 1]}\n`;
  const gh = reviewClient(source, diff);
  const setup = () => createServer({ secret: 'secret', allowedRepositories: new Set(['owner/repo']),
    handle: job => processPR(gh.client, job, { botLogin: 'guard[bot]', failOn: 'high' }) });
  const service = setup();
  expect((await service.app.request('/webhook', signed())).status).toBe(202);
  await service.idle();
  expect(gh.inline).toHaveLength(1); expect(gh.summaries).toHaveLength(1);
  const review = gh.request.mock.calls.find(([r]) => r.endsWith('/reviews'))![1];
  expect(review.comments[0].line).toBe(line); expect(review.comments[0].body).toContain('未经 AI 分诊');
  const firstRoutes = gh.request.mock.calls.map(([r]) => r);
  expect(firstRoutes.indexOf('POST /repos/{owner}/{repo}/check-runs')).toBeLessThan(firstRoutes.findIndex(r => r.includes('/contents/')));
  const last = gh.request.mock.calls.at(-1)![1];
  expect(last.conclusion).toBe('failure'); expect(last.status).toBe('completed');
  const apiCalls = gh.request.mock.calls.length;
  await service.app.request('/webhook', signed()); await service.idle();
  expect(gh.request).toHaveBeenCalledTimes(apiCalls);
  // Simulate a process restart: durable comment markers still prevent duplicates.
  const restarted = setup();
  await restarted.app.request('/webhook', signed()); await restarted.idle();
  expect(gh.inline).toHaveLength(1); expect(gh.summaries).toHaveLength(1); expect(gh.checks).toHaveLength(1);
  expect(gh.request.mock.calls.some(([r]) => r.startsWith('PATCH') && r.includes('/issues/comments/'))).toBe(true);
});
