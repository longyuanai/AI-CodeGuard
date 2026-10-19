import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('starts the built Node HTTP service and answers health and signature rejection over loopback', async () => {
  // Constrain the test child to loopback without changing the container's bind
  // address or adding service configuration. Hono uses positional listen args.
  const bootstrap = `
    import { Server } from 'node:net';
    const listen = Server.prototype.listen;
    Server.prototype.listen = function (port, _host, callback) {
      console.log('Test listener: 127.0.0.1');
      return listen.call(this, port, '127.0.0.1', callback);
    };
    await import(${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)});
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', bootstrap], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, APP_ID: '1', PRIVATE_KEY: 'offline-test-no-private-material',
      WEBHOOK_SECRET: 'offline-secret', ALLOWED_REPOSITORIES: 'owner/repo', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  try {
    let loopback = false;
    let stdout = '';
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Service startup timed out')), 10_000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Service exited before startup')); });
      child.stdout.on('data', data => {
        stdout += String(data);
        if (stdout.includes('Test listener: 127.0.0.1')) loopback = true;
        const match = /listening on (\d+)/.exec(stdout);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
    });
    expect(loopback).toBe(true);
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200); expect(await health.json()).toEqual({ status: 'ok' });
    expect((await fetch(`http://127.0.0.1:${port}/webhook`, { method: 'POST', body: '{}' })).status).toBe(401);
  } finally { child.kill(); }
}, 15_000);
