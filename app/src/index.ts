import { serve } from '@hono/node-server';
import type { Severity } from 'ai-codeguard';
import { createInstallationAuth } from './auth.js';
import { createServer } from './server.js';
import { processPR } from './review.js';

const env = process.env;
if (!env.WEBHOOK_SECRET || !env.ALLOWED_REPOSITORIES) throw new Error('WEBHOOK_SECRET and ALLOWED_REPOSITORIES are required.');
const allowedRepositories = new Set(env.ALLOWED_REPOSITORIES.split(',').map(s => s.trim().toLowerCase()));
if ([...allowedRepositories].some(s => !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(s))) throw new Error('Invalid repository allowlist.');
const failOn = env.CODEGUARD_FAIL_ON ?? 'high';
if (!['none', 'low', 'medium', 'high', 'critical'].includes(failOn)) throw new Error('Invalid CODEGUARD_FAIL_ON.');
const port = Number(env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT.');
const auth = createInstallationAuth(env);
const service = createServer({
  secret: env.WEBHOOK_SECRET, allowedRepositories,
  log: message => console.error(message),
  handle: async job => processPR(await auth(job.installationId), job, {
    env, botLogin: await auth.getBotLogin(), failOn: failOn as Severity | 'none',
  }),
});
const server = serve({ fetch: service.app.fetch, hostname: '0.0.0.0', port }, info => {
  console.log(`AI-CodeGuard listening on ${info.port}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close();
  void service.idle().then(() => process.exit(0));
});
