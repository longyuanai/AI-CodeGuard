import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { parseDocument, visit } from 'yaml';
import { ConfigSchema, detectLanguage, parseUnifiedDiff, scan, type ScanResult, type ChangedLines } from 'ai-codeguard';
import type { GitHubClient, PRJob } from './types.js';

const MAX_FILES = 300;
const MAX_FILE = 1024 * 1024;
const MAX_TOTAL = 20 * MAX_FILE;
export interface PRScan {
  result: ScanResult;
  changed: ChangedLines;
  dryRun: boolean;
  notes: string[];
  incomplete: boolean;
  largePR: boolean;
}
export interface PipelineDependencies { scan?: typeof scan }

export async function scanPR(client: GitHubClient, job: PRJob, deps: PipelineDependencies = {}): Promise<PRScan | undefined> {
  const base = { owner: job.owner, repo: job.repo, pull_number: job.number };
  const { data: pr } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', base);
  if (pr.state !== 'open' || pr.head.sha !== job.headSha) return;
  if (pr.head.repo?.owner.login !== job.headOwner || pr.head.repo?.name !== job.headRepo) throw new Error('Head repository mismatch.');
  const largePR = pr.changed_files > MAX_FILES;
  const notes: string[] = largePR ? ['PR exceeds 300 files: first 300 only; inline comments disabled.'] : [];
  let incomplete = largePR;
  const files: Array<{ filename: string; status: string }> = [];
  for (let page = 1; page <= MAX_FILES / 100; page++) {
    const { data } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { ...base, per_page: 100, page });
    files.push(...data);
    if (data.length < 100) break;
  }
  if (files.length < Math.min(pr.changed_files, MAX_FILES)) throw new Error('Incomplete PR file list.');
  const diffResponse = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { ...base, mediaType: { format: 'diff' } });
  const diff = diffResponse.data as unknown as string;
  if (typeof diff !== 'string' || Buffer.byteLength(diff) > MAX_TOTAL) throw new Error('Invalid or oversized PR diff.');
  const changed = parseUnifiedDiff(diff);
  const temp = await mkdtemp(join(tmpdir(), 'codeguard-'));
  try {
    const rootDir = join(temp, 'repo');
    await mkdir(rootDir);
    const paths: string[] = [];
    let total = 0;
    async function download(path: string, limit: number, optional = false): Promise<string | undefined> {
      const target = safePath(rootDir, path);
      let data;
      try {
        ({ data } = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: job.headOwner, repo: job.headRepo, path, ref: job.headSha,
        }));
      } catch (error) {
        if (optional && (error as { status?: number }).status === 404) return;
        throw new Error('Unable to download PR content.');
      }
      if (Array.isArray(data) || data.type !== 'file' || !('content' in data)
        || data.encoding !== 'base64' || data.size > limit || data.content.length > Math.ceil(limit / 3) * 4 + 100_000) {
        throw new Error('Unsupported or oversized file.');
      }
      const content = Buffer.from(data.content, 'base64');
      if (content.length > limit || total + content.length > MAX_TOTAL || content.includes(0)) throw new Error('File limit exceeded.');
      total += content.length;
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, { flag: 'wx' });
      return content.toString('utf8');
    }
    for (const file of files.slice(0, MAX_FILES)) {
      if (file.status === 'removed' || !detectLanguage(file.filename)) continue;
      if (!changed.get(file.filename)?.size) {
        // Binary diffs / truncated hunks cannot be reported as a clean scan.
        if (file.status !== 'renamed') { notes.push(`No changed lines available: ${file.filename}`); incomplete = true; }
        continue;
      }
      try { await download(file.filename, MAX_FILE); paths.push(file.filename); }
      catch { notes.push(`Skipped unavailable, unsafe or oversized file: ${file.filename}`); incomplete = true; }
    }
    const yaml = await download('.codeguard.yml', 64 * 1024, true);
    const baseline = await download('.codeguard-baseline.json', MAX_FILE, true);
    const config = repositoryConfig(yaml);
    const diffPath = join(temp, 'pr.diff');
    await writeFile(diffPath, diff);
    // Do not expand empty paths into a whole-directory scan.
    const result = paths.length ? await (deps.scan ?? scan)({
      paths, rootDir, config, diffPath,
      baselinePath: baseline === undefined ? undefined : join(rootDir, '.codeguard-baseline.json'),
      dryRun: true, fix: false, output: 'json', verbose: false, report: false,
    }) : emptyResult();
    if (result.skipped.length) incomplete = true;
    const { data: latest } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', base);
    if (latest.state !== 'open' || latest.head.sha !== job.headSha) return;
    return { result, changed, notes, incomplete, largePR, dryRun: true };
  } finally {
    // Only this freshly created, absolute temporary directory is removed.
    await rm(temp, { recursive: true, force: true });
  }
}

function repositoryConfig(source?: string) {
  const doc = parseDocument(source ?? '', { uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length) throw new Error('Invalid repository YAML.');
  visit(doc, { Alias() { throw new Error('YAML aliases are not supported.'); } });
  const raw = doc.toJS({ maxAliasCount: 0 }) as Record<string, unknown> | null;
  if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('Invalid repository config.');
  // Repository data cannot select credentials, providers, endpoints, custom code,
  // output paths or persistent cache directories. JS/TS configs are never loaded.
  const parsed = ConfigSchema.parse({ scan: raw?.scan, rules: raw?.rules });
  parsed.rules.custom = undefined;
  return parsed;
}

export function safePath(root: string, path: string): string {
  if (path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..'
    || [...part].some(char => char.charCodeAt(0) < 32) || /[<>:"|?*]/.test(part) || /[. ]$/.test(part)
    || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe path.');
  const target = resolve(root, path);
  if (!target.startsWith(resolve(root) + sep)) throw new Error('Path escapes root.');
  return target;
}

export function emptyResult(): ScanResult {
  return { files: 0, suspicious: 0, suppressed: 0, baselined: 0, diffFiltered: 0,
    findings: [], dismissedFindings: [], skipped: [], duration: 0, llmCalls: 0, estimatedCost: 0, cacheHits: 0 };
}
