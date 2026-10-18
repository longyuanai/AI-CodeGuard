import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { Webhooks } from '@octokit/webhooks';
import type { PRJob } from './types.js';

export interface ServerOptions {
  secret: string;
  allowedRepositories: ReadonlySet<string>;
  handle: (job: PRJob) => Promise<void>;
  log?: (message: string) => void;
}

export function createServer(options: ServerOptions) {
  const app = new Hono();
  const webhooks = new Webhooks({ secret: options.secret });
  const deliveries = new Map<string, number>();
  let queue = Promise.resolve();
  let pending = 0;
  app.get('/healthz', c => c.json({ status: 'ok' }));
  app.use('/webhook', bodyLimit({ maxSize: 1024 * 1024 }));
  app.post('/webhook', async c => {
    const body = await c.req.text();
    const signature = c.req.header('x-hub-signature-256') ?? '';
    if (!await webhooks.verify(body, signature).catch(() => false)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
    if (c.req.header('x-github-event') !== 'pull_request') return c.json({ ignored: true }, 202);
    let job: PRJob | undefined;
    try { job = parseJob(JSON.parse(body)); } catch { return c.json({ error: 'Invalid event' }, 400); }
    if (!job) return c.json({ ignored: true }, 202);
    if (!options.allowedRepositories.has(`${job.owner}/${job.repo}`.toLowerCase())) {
      return c.json({ ignored: true }, 202);
    }
    const id = c.req.header('x-github-delivery');
    if (!id || id.length > 200) return c.json({ error: 'Missing delivery ID' }, 400);
    for (const [key, time] of deliveries) if (time < Date.now() - 3_600_000) deliveries.delete(key);
    if (deliveries.has(id)) return c.json({ duplicate: true }, 202);
    if (pending >= 10) return c.json({ error: 'Queue full; redeliver later' }, 503);
    if (deliveries.size >= 1000) deliveries.delete(deliveries.keys().next().value!);
    deliveries.set(id, Date.now());
    pending++;
    // ACK within GitHub's timeout; one bounded worker serializes PR mutations.
    queue = queue.then(() => options.handle(job!)).catch(() => {
      deliveries.delete(id);
      options.log?.('PR processing failed; inspect the neutral check and redeliver.');
    }).finally(() => { pending--; });
    return c.json({ accepted: true }, 202);
  });
  app.onError((_error, c) => c.json({ error: 'Request failed' }, 500));
  return { app, idle: () => queue };
}

function parseJob(payload: unknown): PRJob | undefined {
  const p = payload as {
    action: string; number: number; installation?: { id: number };
    repository?: { name: string; owner?: { login: string } };
    pull_request?: { head?: { sha: string; repo?: { name: string; owner?: { login: string } } } };
  };
  if (!p || typeof p !== 'object') throw new Error('Invalid PR');
  if (!['opened', 'synchronize', 'reopened'].includes(p.action)) return;
  const name = /^[A-Za-z0-9_.-]+$/;
  const job: PRJob = {
    owner: p.repository?.owner?.login ?? '', repo: p.repository?.name ?? '',
    number: p.number, installationId: p.installation?.id ?? 0,
    headSha: p.pull_request?.head?.sha ?? '',
    headOwner: p.pull_request?.head?.repo?.owner?.login ?? '',
    headRepo: p.pull_request?.head?.repo?.name ?? '',
  };
  if (![job.owner, job.repo, job.headOwner, job.headRepo].every(x => typeof x === 'string' && name.test(x))
    || !Number.isSafeInteger(job.number) || job.number < 1
    || !Number.isSafeInteger(job.installationId) || job.installationId < 1
    || typeof job.headSha !== 'string' || !/^[a-f0-9]{40}$/i.test(job.headSha)) throw new Error('Invalid PR');
  return job;
}
