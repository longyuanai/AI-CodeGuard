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
    Octokit: Octokit.defaults({ request: { fetch: (url: string, init: RequestInit) => {
      if (new URL(url).origin !== 'https://api.github.com') throw new Error('Unexpected GitHub API origin.');
      return fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    } } }),
  });
  return async (installationId: number): Promise<GitHubClient> => {
    return app.getInstallationOctokit(installationId);
  };
}
