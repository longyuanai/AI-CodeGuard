import { generateKeyPairSync } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createInstallationAuth } from '../src/auth.js';

it('exchanges an App JWT for an installation token and pins credential destinations', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const authorization = (init.headers as Record<string, string>).authorization;
    if (url.endsWith('/app/installations/42/access_tokens')) {
      expect(authorization).toMatch(/^bearer ey/i);
      return Response.json({ token: 'installation-test-token', expires_at: new Date(Date.now() + 3600000).toISOString() });
    }
    expect(authorization).toBe('token installation-test-token');
    return Response.json({ ok: true });
  });
  const client = await createInstallationAuth({ APP_ID: '1', PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }, fetch)(42);
  await client.request('GET /repos/{owner}/{repo}', { owner: 'owner', repo: 'repo' });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.every(([, init]) => init.redirect === 'error')).toBe(true);
  await expect(client.request('GET https://example.org/steal')).rejects.toThrow('Unexpected GitHub API origin');
  expect(fetch).toHaveBeenCalledTimes(2);
});
