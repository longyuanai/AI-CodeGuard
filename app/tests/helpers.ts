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
function expectHead(args: Record<string, unknown>) {
  if (args.ref !== job.headSha || args.owner !== job.headOwner || args.repo !== job.headRepo) throw new Error('Head SHA required');
}
