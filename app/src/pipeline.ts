import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { parseDocument, visit } from 'yaml';
import { ConfigSchema, resolveConfig, createHostedProviders, detectLanguage, parseUnifiedDiff, scan,
  type ScanResult, type ChangedLines, type Finding, type AnalyzeFindingsDependencies } from 'ai-codeguard';
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
  budgetDeferred?: Finding[];
  untriaged?: Finding[];
}
export interface PipelineDependencies {
  scan?: typeof scan;
  /** Explicit trusted deployment environment; tests default to no credentials. */
  env?: NodeJS.ProcessEnv;
  analyzer?: AnalyzeFindingsDependencies;
}

export async function scanPR(client: GitHubClient, job: PRJob, deps: PipelineDependencies = {}): Promise<PRScan | undefined> {
  const base = { owner: job.owner, repo: job.repo, pull_number: job.number };
  const { data: pr } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', base);
  if (pr.state !== 'open' || pr.head.sha !== job.headSha) return;
  if (pr.head.repo?.owner.login !== job.headOwner || pr.head.repo?.name !== job.headRepo) throw new Error('Head repository mismatch.');
  const largePR = pr.changed_files > MAX_FILES;
  const notes: string[] = largePR ? ['PR exceeds 300 files: first 300 only; inline comments disabled.'] : [];
  let incomplete = largePR;
  const files: Array<{ filename: string; status: string; additions?: number }> = [];
  for (let page = 1; page <= MAX_FILES / 100; page++) {
    const { data } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { ...base, per_page: 100, page });
    files.push(...data);
    if (data.length < 100) break;
  }
  if (files.length < Math.min(pr.changed_files, MAX_FILES)) throw new Error('Incomplete PR file list.');
  const diffResponse = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { ...base, mediaType: { format: 'diff' } });
  const diff = diffResponse.data as unknown as string;
  if (typeof diff !== 'string' || Buffer.byteLength(diff) > MAX_TOTAL) throw new Error('Invalid or oversized PR diff.');
  // Pure renames can lack +++ headers; zero-count binary edits are not renames.
  const binaryDiff = /^(?:Binary files |GIT binary patch$)/m.test(diff);
  const onlyRenames = !binaryDiff && files.every(file => file.status === 'removed'
    || (file.status === 'renamed' && file.additions === 0));
  const changed: ChangedLines = onlyRenames ? new Map() : parseUnifiedDiff(diff);
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
        // A rename is safe to omit only when GitHub confirms zero additions.
        if (file.status !== 'renamed' || file.additions !== 0 || binaryDiff) {
          notes.push(`No changed lines available: ${file.filename}`); incomplete = true;
        }
        continue;
      }
      if (file.additions !== undefined && changed.get(file.filename)!.size !== file.additions) {
        notes.push(`Incomplete changed lines: ${file.filename}`);
        incomplete = true;
      }
      try { await download(file.filename, MAX_FILE); paths.push(file.filename); }
      catch { notes.push(`Skipped unavailable, unsafe or oversized file: ${file.filename}`); incomplete = true; }
    }
    const yaml = await download('.codeguard.yml', 64 * 1024, true);
    const baseline = await download('.codeguard-baseline.json', MAX_FILE, true);
    const config = repositoryConfig(yaml, deps.env ?? {});
    const dryRun = !config.llm.apiKey;
    const budgetDeferred: Finding[] = [];
    const diffPath = join(temp, 'pr.diff');
    await writeFile(diffPath, diff);
    const { data: beforeScan } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', base);
    if (beforeScan.state !== 'open' || beforeScan.head.sha !== job.headSha) return;
    // Do not expand empty paths into a whole-directory scan.
    const result = paths.length ? await (deps.scan ?? scan)({
      paths, rootDir, config, diffPath,
      baselinePath: baseline === undefined ? undefined : join(rootDir, '.codeguard-baseline.json'),
      dryRun, fix: false, output: 'json', verbose: false, report: false,
    }, { ...deps.analyzer, providers: deps.analyzer?.providers ?? createHostedProviders(),
      reserveBudget: true, onBudgetSkipped: finding => budgetDeferred.push(finding) }) : emptyResult();
    const deferred = new Set(budgetDeferred.map(f => f.id));
    const untriaged = dryRun ? [] : result.findings.filter(f => !f.llmAnalysis && !deferred.has(f.id));
    if (!dryRun) result.findings = result.findings.filter(f => f.llmAnalysis?.confirmed === true);
    if (budgetDeferred.length || untriaged.length) incomplete = true;
    if (result.skipped.length) incomplete = true;
    const { data: latest } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', base);
    if (latest.state !== 'open' || latest.head.sha !== job.headSha) return;
    return { result, changed, notes, incomplete, largePR, dryRun, budgetDeferred, untriaged };
  } finally {
    // Only this freshly created, absolute temporary directory is removed.
    await rm(temp, { recursive: true, force: true });
  }
}

export function repositoryConfig(source?: string, env: NodeJS.ProcessEnv = {}) {
  const doc = parseDocument(source ?? '', { uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length) throw new Error('Invalid repository YAML.');
  visit(doc, { Alias() { throw new Error('YAML aliases are not supported.'); } });
  const raw = doc.toJS({ maxAliasCount: 0 }) as Record<string, unknown> | null;
  if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('Invalid repository config.');
  // Repository data cannot select credentials, providers, endpoints, custom code,
  // output paths or persistent cache directories. JS/TS configs are never loaded.
  const parsed = ConfigSchema.parse({ scan: raw?.scan, rules: raw?.rules });
  parsed.rules.custom = undefined;
  // Explicit changed-file paths make include globs unnecessary. Limit exclude
  // patterns to simple stars/questions; don't expose brace/extglob expansion
  // in the core's existing glob dependencies to untrusted repository config.
  parsed.scan.include = [];
  if (parsed.scan.exclude.length > 100 || parsed.scan.exclude.some(p => p.length > 256 || /[{}()[\]!]/.test(p))) {
    throw new Error('Repository excludes must use simple glob patterns.');
  }
  const serverCap = Number(env.CODEGUARD_MAX_COST ?? '1');
  const repoLLM = raw?.llm as { maxCostUSD?: unknown } | undefined;
  const repoCap = repoLLM?.maxCostUSD ?? serverCap;
  if (!Number.isFinite(serverCap) || serverCap < 0 || typeof repoCap !== 'number'
    || !Number.isFinite(repoCap) || repoCap < 0) throw new Error('Invalid cost limit.');
  const provider = env.CODEGUARD_PROVIDER ?? 'claude';
  if (!['claude', 'openai'].includes(provider)) throw new Error('Invalid deployment provider.');
  const config = resolveConfig({ ...parsed, llm: {
    provider, model: provider === 'openai' ? 'gpt-4o-mini' : parsed.llm.model,
  } }, env);
  config.llm.maxConcurrency = 1;
  config.llm.maxCostUSD = Math.min(serverCap, repoCap);
  return config;
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
