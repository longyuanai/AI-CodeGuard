import { readFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, it, vi } from 'vitest';
import { scan, fingerprintFinding } from 'ai-codeguard';
import { safePath, scanPR } from '../src/pipeline.js';
import { job, mockGitHub } from './helpers.js';
import type { GitHubClient } from '../src/types.js';
import { checkConclusion } from '../src/review.js';

const source = 'eval(req.query.old);\neval(req.query.new);\n';
const diff = '--- a/src/code.ts\n+++ b/src/code.ts\n@@ -1 +1,2 @@\n eval(req.query.old);\n+eval(req.query.new);\n';
it('scans a renamed file with Git-quoted UTF-8 paths and anchors its changed line', async () => {
  const quotedDiff = [String.raw`--- "a/src/old.ts"`, String.raw`+++ "b/src/\344\270\255.ts"`,
    '@@ -1 +1,2 @@', ' eval(req.query.old);', '+eval(req.query.new);'].join('\n');
  const gh = mockGitHub(source, quotedDiff, { 'src/中.ts': source });
  const request = vi.fn(async (route: string, args: Record<string, unknown>) => {
    if (route.endsWith('/files')) return { data: [{ filename: 'src/中.ts', status: 'renamed', additions: 1 }] };
    return gh.request(route, args);
  });
  const result = await scanPR({ request } as unknown as GitHubClient, job);
  expect(result?.result.files).toBe(1);
  expect(result?.result.findings).toHaveLength(1);
  expect(result?.changed.get('src/中.ts')).toEqual(new Set([2]));
  expect(checkConclusion(result!, 'high')).toBe('failure');
});

it('never claims success for a renamed file with additions but no usable diff lines', async () => {
  const gh = mockGitHub(source, '');
  const request = vi.fn(async (route: string, args: Record<string, unknown>) => {
    if (route.endsWith('/files')) return { data: [{ filename: 'src/code.ts', status: 'renamed', additions: 1 }] };
    return gh.request(route, args);
  });
  const result = await scanPR({ request } as unknown as GitHubClient, job);
  expect(result?.incomplete).toBe(true);
  expect(checkConclusion(result!, 'high')).toBe('neutral');
});
it('marks a partially available diff incomplete but still reports visible findings', async () => {
  const gh = mockGitHub(source, diff);
  const request = vi.fn(async (route: string, args: Record<string, unknown>) => {
    if (route.endsWith('/files')) return { data: [{ filename: 'src/code.ts', status: 'modified', additions: 2 }] };
    return gh.request(route, args);
  });
  const result = await scanPR({ request } as unknown as GitHubClient, job);
  expect(result?.result.findings).toHaveLength(1);
  expect(result?.incomplete).toBe(true);
  expect(checkConclusion(result!, 'none')).toBe('neutral');
});
it('permits a pure rename with confirmed zero additions without claiming a partial scan', async () => {
  const gh = mockGitHub(source, 'diff --git a/old.ts b/src/code.ts\nsimilarity index 100%\nrename from old.ts\nrename to src/code.ts\n');
  const request = vi.fn(async (route: string, args: Record<string, unknown>) => {
    if (route.endsWith('/files')) return { data: [{ filename: 'src/code.ts', status: 'renamed', additions: 0 }] };
    return gh.request(route, args);
  });
  const result = await scanPR({ request } as unknown as GitHubClient, job);
  expect(result?.incomplete).toBe(false);
  expect(result?.result.files).toBe(0);
});
it('runs the real scanner with changed-line filtering and removes downloaded files', async () => {
  const gh = mockGitHub(source, diff);
  let temp = '';
  const run: typeof scan = async options => { temp = dirname(options.rootDir!); return scan(options); };
  const result = await scanPR(gh.client, job, { scan: run });
  expect(result?.result.findings).toHaveLength(1);
  expect(result?.result.findings[0].location.start.line).toBe(2);
  expect(result?.result.diffFiltered).toBe(1);
  expect(result?.result.llmCalls).toBe(0);
  await expect(access(temp)).rejects.toThrow();
});
it('cleans up on scanner errors and never logs or writes a report', async () => {
  let temp = '';
  const gh = mockGitHub(source, diff);
  await expect(scanPR(gh.client, job, { scan: async options => {
    temp = dirname(options.rootDir!); expect(options.report).toBe(false); throw new Error('injected');
  } })).rejects.toThrow('injected');
  await expect(access(temp)).rejects.toThrow();
});
it('ignores executable config, repository credentials, custom rules and cache paths', async () => {
  const gh = mockGitHub(source, diff, { '.codeguard.yml': 'llm:\n  apiKey: hostile\n  provider: openai\n  baseURL: https://example.org\nrules:\n  custom: /outside\ncache:\n  enabled: true\n  directory: /outside\noutput:\n  file: /outside' });
  const run = vi.fn<typeof scan>(async opts => {
    expect(opts.config.llm.apiKey).toBeUndefined(); expect(opts.config.rules.custom).toBeUndefined();
    expect(opts.config.cache.enabled).toBe(false); expect(opts.config.output.file).toBeUndefined();
    expect(await readFile(opts.rootDir! + '/src/code.ts', 'utf8')).toBe(source);
    return scan(opts);
  });
  await scanPR(gh.client, job, { scan: run });
  expect(run).toHaveBeenCalledOnce();
  expect(gh.request.mock.calls.some(([, args]) => String(args.path).endsWith('.js'))).toBe(false);
});
it('rejects traversal, Windows aliases and ambiguous paths', () => {
  for (const path of ['../bad.ts', '/abs.ts', 'a\\b.ts', 'C:/bad.ts', 'a/../b.ts', 'NUL.ts', 'x./b.ts', 'x//b.ts']) {
    expect(() => safePath(process.cwd(), path)).toThrow();
  }
});
it('skips stale webhook heads without downloading anything', async () => {
  const gh = mockGitHub(source, diff); gh.pr.head.sha = 'b'.repeat(40);
  expect(await scanPR(gh.client, job)).toBeUndefined();
  expect(gh.request).toHaveBeenCalledTimes(1);
});
it('reuses repository-relative baseline fingerprints and inline suppression', async () => {
  const baseline = { version: 1, fingerprints: {
    [fingerprintFinding({ ruleId: 'CG-003', file: 'src/code.ts', snippet: 'eval(req.query.new)' })]: 1,
  } };
  const gh = mockGitHub(source, diff, { '.codeguard-baseline.json': JSON.stringify(baseline) });
  const result = await scanPR(gh.client, job);
  expect(result?.result.baselined).toBe(1); expect(result?.result.findings).toHaveLength(0);
  const suppressed = await scanPR(mockGitHub(source.replace('eval(req.query.new);', 'eval(req.query.new); // codeguard-ignore CG-003'), diff).client, job);
  expect(suppressed?.result.suppressed).toBe(1); expect(suppressed?.result.findings).toHaveLength(0);
});
it('marks oversized files incomplete, without expanding empty paths into a scan', async () => {
  const gh = mockGitHub('x'.repeat(1024 * 1024 + 1), diff);
  const run = vi.fn<typeof scan>();
  const result = await scanPR(gh.client, job, { scan: run });
  expect(run).not.toHaveBeenCalled(); expect(result?.incomplete).toBe(true);
  expect(result?.notes.join()).toContain('Skipped');
});
it('rejects executable YAML tags and aliases', async () => {
  for (const yaml of ['!!js/function function(){}', 'a: &a [*a]']) {
    const gh = mockGitHub(source, diff, { '.codeguard.yml': yaml });
    await expect(scanPR(gh.client, job)).rejects.toThrow();
  }
});
