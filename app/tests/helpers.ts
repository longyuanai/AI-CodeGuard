import { vi } from 'vitest';
import type { GitHubClient, PRJob } from '../src/types.js';

export const job: PRJob = { owner: 'owner', repo: 'repo', number: 1, installationId: 42,
  headSha: 'a'.repeat(40), headOwner: 'owner', headRepo: 'repo' };
export function mockGitHub(source: string, diff: string, extra: Record<string, string> = {}) {
  const contents = { 'src/code.ts': source, ...extra };
  const pr = { state: 'open', changed_files: 1,
    head: { sha: job.headSha, repo: { name: job.headRepo, owner: { login: job.headOwner } } } };
  const request = vi.fn(async (route: string, args: Record<string, any>) => {
    if (route.endsWith('/files')) return { data: [{ filename: 'src/code.ts', status: 'modified' }] };
    if (route.endsWith('/contents/{path}')) {
      expectHead(args);
      const text = contents[args.path as keyof typeof contents];
      if (text === undefined) throw Object.assign(new Error('not found'), { status: 404 });
      return { data: { type: 'file', encoding: 'base64', size: Buffer.byteLength(text), content: Buffer.from(text).toString('base64') } };
    }
    if (args.mediaType?.format === 'diff') return { data: diff };
    return { data: pr };
  });
  return { request, client: { request } as unknown as GitHubClient, pr };
}
export function reviewClient(source = 'eval(req.query.new);', diff = '--- a/src/code.ts\n+++ b/src/code.ts\n@@ -0,0 +1 @@\n+eval(req.query.new);\n') {
  const inline: Array<{ id: number; body: string; user: { login: string } }> = [];
  const summaries: typeof inline = [];
  const checks: Array<Record<string, unknown>> = [];
  const gh = mockGitHub(source, diff);
  const request = vi.fn(async (route: string, args: Record<string, any>) => {
    if (route.endsWith('/check-runs') && route.startsWith('GET')) return { data: { check_runs: checks } };
    if (route.startsWith('POST') && route.endsWith('/check-runs')) {
      checks.push({ ...args, id: 9, app: { slug: 'guard' } }); return { data: { id: 9 } };
    }
    if (route.includes('/check-runs')) return { data: { id: 9 } };
    if (route.endsWith('/reviews')) {
      inline.push(...args.comments.map((c: { body: string }) => ({ ...c, id: inline.length + 1, user: { login: 'guard[bot]' } })));
      return { data: {} };
    }
    if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments') return { data: inline };
    if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments') return { data: summaries };
    if (route.startsWith('POST') && route.endsWith('/comments')) {
      summaries.push({ id: 5, body: args.body, user: { login: 'guard[bot]' } }); return { data: {} };
    }
    if (route.startsWith('PATCH') && route.includes('/issues/comments/')) { summaries[0].body = args.body; return { data: {} }; }
    return gh.request(route, args);
  });
  return { request, inline, summaries, checks, client: { request } as unknown as GitHubClient };
}
function expectHead(args: Record<string, unknown>) {
  if (args.ref !== job.headSha || args.owner !== job.headOwner || args.repo !== job.headRepo) throw new Error('Head SHA required');
}
