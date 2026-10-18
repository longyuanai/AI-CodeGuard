import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('starts the built Node HTTP service and answers health and signature rejection over loopback', async () => {
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, APP_ID: '1', PRIVATE_KEY: 'offline-test-no-private-material',
      WEBHOOK_SECRET: 'offline-secret', ALLOWED_REPOSITORIES: 'owner/repo', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Service startup timed out')), 10_000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Service exited before startup')); });
      child.stdout.on('data', data => {
        const match = /listening on (\d+)/.exec(String(data));
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
    });
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200); expect(await health.json()).toEqual({ status: 'ok' });
    expect((await fetch(`http://127.0.0.1:${port}/webhook`, { method: 'POST', body: '{}' })).status).toBe(401);
  } finally { child.kill(); }
}, 15_000);
