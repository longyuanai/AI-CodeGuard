import { App } from '@octokit/app';
import { Octokit } from '@octokit/core';
import type { GitHubClient } from './types.js';

export function createInstallationAuth(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = globalThis.fetch,
) {
  if (!env.APP_ID || !/^\d+$/.test(env.APP_ID) || !env.PRIVATE_KEY) {
    throw new Error('APP_ID and PRIVATE_KEY are required.');
  }
  const quiet = () => undefined;
  const app = new App({
    appId: env.APP_ID,
    privateKey: env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    log: { debug: quiet, info: quiet, warn: quiet, error: quiet },
    Octokit: Octokit.defaults({ request: { fetch: async (url: string, init: RequestInit) => {
      if (new URL(url).origin !== 'https://api.github.com') throw new Error('Unexpected GitHub API origin.');
      const response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      if (!response.body) return response;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 32 * 1024 * 1024) throw new Error('GitHub response limit exceeded.');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
    } } }),
  });
  let botLogin: Promise<string> | undefined;
  const installation = async (installationId: number): Promise<GitHubClient> => {
    return app.getInstallationOctokit(installationId);
  };
  return Object.assign(installation, { getBotLogin: () => {
    botLogin ??= app.octokit.request('GET /app').then(({ data }) => {
      if (!data?.slug) throw new Error('Unable to identify GitHub App.');
      return `${data.slug}[bot]`;
    }).catch(() => { botLogin = undefined; throw new Error('Unable to identify GitHub App.'); });
    return botLogin;
  } });
}
