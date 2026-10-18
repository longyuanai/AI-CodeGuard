import { fingerprintFinding, formatGitHubReview, SEVERITY_RANK, type Finding, type Severity } from 'ai-codeguard';
import { scanPR, type PipelineDependencies, type PRScan } from './pipeline.js';
import type { GitHubClient, PRJob } from './types.js';

const SUMMARY_MARK = '<!-- ai-codeguard-summary:v1 -->';
const CHECK = 'AI-CodeGuard';
export interface ReviewOptions extends PipelineDependencies { botLogin: string; failOn: Severity | 'none' }

export async function processPR(client: GitHubClient, job: PRJob, options: ReviewOptions): Promise<void> {
  const repo = { owner: job.owner, repo: job.repo };
  const external_id = `codeguard:${job.number}:${job.headSha}`;
  const { data: checks } = await client.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
    ...repo, ref: job.headSha, check_name: CHECK, per_page: 100,
  });
  const existing = checks.check_runs.find(c => c.external_id === external_id && `${c.app?.slug}[bot]` === options.botLogin);
  const { data: check } = existing
    ? await client.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
      ...repo, check_run_id: existing.id, status: 'in_progress', started_at: new Date().toISOString(),
    })
    : await client.request('POST /repos/{owner}/{repo}/check-runs', {
      ...repo, name: CHECK, head_sha: job.headSha, external_id, status: 'in_progress',
    });
  const finish = (conclusion: 'neutral' | 'success' | 'failure', summary: string) => client.request(
    'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
      ...repo, check_run_id: check.id, status: 'completed', conclusion,
      output: { title: CHECK, summary: summary.slice(0, 60_000) },
    },
  );
  try {
    const scanned = await scanPR(client, job, options);
    if (!scanned) { await finish('neutral', 'Superseded or closed PR; no review posted.'); return; }
    const summary = await publishReview(client, job, scanned, options.botLogin);
    await finish(checkConclusion(scanned, options.failOn), summary);
  } catch {
    await finish('neutral', 'Scan or review failed. No clean result is claimed. Redeliver the webhook after checking service configuration.');
    throw new Error('PR processing failed.');
  }
}

export function checkConclusion(scan: PRScan, failOn: Severity | 'none') {
  if (failOn !== 'none' && scan.result.findings.some(f => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[failOn])) return 'failure';
  return scan.incomplete ? 'neutral' : 'success';
}

export async function publishReview(client: GitHubClient, job: PRJob, scan: PRScan, botLogin: string): Promise<string> {
  const base = { owner: job.owner, repo: job.repo, pull_number: job.number };
  const previous = await listComments(client, job, true);
  const counts = new Map<string, number>();
  for (const c of previous) {
    if (c.user?.login !== botLogin) continue;
    const fp = /<!-- codeguard-fp: ([a-f0-9]{16}) -->$/.exec(c.body ?? '')?.[1];
    if (fp) counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const payload = JSON.parse(formatGitHubReview(scan.result)) as {
    event: 'COMMENT'; body: string; comments: Array<{ path: string; line: number; side: 'RIGHT'; body: string }>;
  };
  const fallback: string[] = [];
  const comments = payload.comments.flatMap((comment, index) => {
    const finding = scan.result.findings[index];
    const fp = fingerprintFinding(finding);
    const occurrence = (seen.get(fp) ?? 0) + 1; seen.set(fp, occurrence);
    if (occurrence <= (counts.get(fp) ?? 0)) return [];
    const line = anchorLine(finding, scan);
    if (scan.largePR || line === undefined) {
      fallback.push(`${escapeText(finding.file)}:${finding.location.start.line} — ${escapeText(finding.ruleId)} (${finding.severity})`);
      return [];
    }
    const mode = scan.dryRun ? '**Stage 1 only — 未经 AI 分诊.**\n\n' : '';
    return [{ ...comment, line, body: mode + comment.body.slice(0, 58_000) + `\n\n<!-- codeguard-fp: ${fp} -->` }];
  });
  // The PR might have moved while scanning; don't attach an old scan to a new head.
  const { data: current } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', base);
  if (current.head.sha !== job.headSha || current.state !== 'open') throw new Error('PR head changed.');
  if (comments.length) {
    try {
      // Bound API payloads; later deliveries deduplicate any successful batches.
      for (let i = 0; i < comments.length; i += 50) {
        await client.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
          ...base, commit_id: job.headSha, event: 'COMMENT', body: 'AI-CodeGuard findings (see the summary comment for scan mode).',
          comments: comments.slice(i, i + 50),
        });
      }
    } catch (error) {
      if ((error as { status?: number }).status !== 422) throw error;
      scan.incomplete = true;
      scan.notes.push('GitHub rejected inline anchors (422); findings remain in this summary.');
      fallback.push(...comments.map(c => `${escapeText(c.path)}:${c.line} — ${c.body}`));
    }
  }
  const summary = summaryBody(scan, fallback, job.headSha);
  const issueComments = await listComments(client, job, false);
  const old = issueComments.find(c => c.user?.login === botLogin && c.body?.endsWith(SUMMARY_MARK));
  if (old) {
    await client.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
      owner: job.owner, repo: job.repo, comment_id: old.id, body: summary,
    });
  } else {
    await client.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: job.owner, repo: job.repo, issue_number: job.number, body: summary,
    });
  }
  return summary;
}

function anchorLine(f: Finding, scan: PRScan) {
  const lines = scan.changed.get(f.file);
  for (let line = f.location.start.line; line <= f.location.end.line; line++) if (lines?.has(line)) return line;
}
async function listComments(client: GitHubClient, job: PRJob, review: boolean) {
  const out: Array<{ id: number; body?: string | null; user: { login: string } | null }> = [];
  for (let page = 1; page <= 100; page++) {
    const { data } = review
      ? await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', { owner: job.owner, repo: job.repo, pull_number: job.number, per_page: 100, page })
      : await client.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', { owner: job.owner, repo: job.repo, issue_number: job.number, per_page: 100, page });
    out.push(...data);
    if (data.length < 100) return out;
  }
  throw new Error('Comment pagination limit exceeded.');
}
function escapeText(text: string) { return text.replace(/[&<>`[\]*_@]/g, ch => `&#${ch.charCodeAt(0)};`); }
function summaryBody(scan: PRScan, fallback: string[], headSha: string) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of scan.result.findings) counts[f.severity]++;
  const mode = scan.dryRun ? '**Stage 1 only — 未经 AI 分诊 (no deployment LLM key).**' : 'Stage 1 + Stage 2 (BYO-key).';
  const lines = ['## AI-CodeGuard', mode, `Head: \`${headSha}\` · ${scan.result.files} files scanned.`,
    Object.entries(counts).map(([s, n]) => `${s}: ${n}`).join(' · '),
    `Baseline: ${scan.result.baselined} · Suppressed: ${scan.result.suppressed} · Outside diff: ${scan.result.diffFiltered}`,
    `LLM calls: ${scan.result.llmCalls} · Estimated cost: $${scan.result.estimatedCost.toFixed(6)}`];
  if (scan.incomplete) lines.push('**Partial scan / untriaged candidates: a clean result is not claimed.**');
  lines.push(...scan.notes.map(n => `- ${escapeText(n)}`));
  if (fallback.length) lines.push('<details><summary>Findings without inline comments</summary>\n', ...fallback, '\n</details>');
  if (scan.result.dismissedFindings?.length) lines.push('<details><summary>Stage 2 dismissed</summary>\n',
    ...scan.result.dismissedFindings.map(f => `${escapeText(f.file)}:${f.location.start.line} ${f.ruleId} — ${escapeText(f.llmAnalysis?.reasoning ?? '')}`), '\n</details>');
  for (const [label, findings] of [['dismissed-by-budget (not AI dismissed)', scan.budgetDeferred], ['Untriaged after provider errors', scan.untriaged]] as const) {
    if (findings?.length) lines.push(`<details><summary>${label}: ${findings.length}</summary>\n`,
      ...findings.map(f => `${escapeText(f.file)}:${f.location.start.line} ${f.ruleId}`), '\n</details>');
  }
  return lines.join('\n\n').slice(0, 60_000) + `\n\n${SUMMARY_MARK}`;
}
