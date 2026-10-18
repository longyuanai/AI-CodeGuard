import { expect, it, vi } from 'vitest';
import type { Finding } from 'ai-codeguard';
import { checkConclusion, processPR, publishReview } from '../src/review.js';
import { emptyResult, type PRScan } from '../src/pipeline.js';
import type { GitHubClient } from '../src/types.js';
import { job, reviewClient } from './helpers.js';

const finding: Finding = { id: '1', ruleId: 'CG-003', title: 'Eval', description: 'Unsafe eval', severity: 'critical',
  file: 'src/code.ts', snippet: 'eval(x)', location: { start: { line: 1, column: 0 }, end: { line: 2, column: 5 } } };
function scanned(): PRScan {
  return { result: { ...emptyResult(), findings: [finding] }, changed: new Map([['src/code.ts', new Set([2])]]),
    dryRun: true, notes: [], incomplete: false, largePR: false };
}
it('deduplicates fingerprints, updates a single summary, and posts only new findings', async () => {
  const gh = reviewClient(); const s = scanned();
  await publishReview(gh.client, job, s, 'guard[bot]');
  expect(gh.inline).toHaveLength(1);
  const first = gh.request.mock.calls.find(([route]) => route.endsWith('/reviews'))![1];
  expect(first.commit_id).toBe(job.headSha); expect(first.comments[0].line).toBe(2);
  await publishReview(gh.client, job, s, 'guard[bot]');
  expect(gh.inline).toHaveLength(1); expect(gh.summaries).toHaveLength(1);
  s.result.findings.push({ ...finding, snippet: 'eval(y)' });
  await publishReview(gh.client, job, s, 'guard[bot]'); expect(gh.inline).toHaveLength(2);
  expect(gh.request.mock.calls.filter(([r]) => r.startsWith('PATCH') && r.includes('/issues/comments/'))).toHaveLength(2);
  expect(gh.summaries[0].body).toContain('未经 AI 分诊');
});
it('preserves occurrence counts and ignores forged markers from other users', async () => {
  const gh = reviewClient(); const s = scanned(); s.result.findings.push(finding);
  await publishReview(gh.client, job, s, 'guard[bot]'); expect(gh.inline).toHaveLength(2);
  gh.inline[0].user.login = 'attacker';
  await publishReview(gh.client, job, s, 'guard[bot]'); expect(gh.inline).toHaveLength(3);
});
it('maps thresholds and partial/error outcomes honestly', async () => {
  const s = scanned(); expect(checkConclusion(s, 'high')).toBe('failure');
  expect(checkConclusion(s, 'none')).toBe('success'); s.incomplete = true;
  expect(checkConclusion(s, 'none')).toBe('neutral');
  s.result.findings = []; s.incomplete = false; expect(checkConclusion(s, 'high')).toBe('success');
  const gh = reviewClient();
  await expect(processPR(gh.client, job, { botLogin: 'guard[bot]', failOn: 'high', scan: async () => { throw new Error('TOKEN sensitive code'); } })).rejects.toThrow();
  const updates = gh.request.mock.calls.filter(([r]) => r.startsWith('PATCH'));
  expect(updates.at(-1)![1].conclusion).toBe('neutral');
  expect(JSON.stringify(updates)).not.toMatch(/TOKEN|sensitive code/);
});
it('falls back to summary on invalid anchors and on large PRs', async () => {
  const gh = reviewClient(); const s = scanned(); s.largePR = true;
  await publishReview(gh.client, job, s, 'guard[bot]');
  expect(gh.inline).toHaveLength(0); expect(gh.summaries[0].body).toContain('Findings without inline');
});
it('retains findings in the summary when GitHub rejects a review with 422', async () => {
  const gh = reviewClient();
  const request = vi.fn(async (route: string, args: Record<string, unknown>) => {
    if (route.endsWith('/reviews')) throw Object.assign(new Error('invalid anchor'), { status: 422 });
    return gh.request(route, args);
  });
  const s = scanned();
  await publishReview({ request } as unknown as GitHubClient, job, s, 'guard[bot]');
  expect(s.incomplete).toBe(true); expect(gh.summaries[0].body).toContain('422');
  expect(gh.summaries[0].body).toContain('Unsafe eval');
});
