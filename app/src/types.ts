export interface PRJob {
  owner: string;
  repo: string;
  number: number;
  installationId: number;
  headSha: string;
  headOwner: string;
  headRepo: string;
}

export interface GitHubClient {
  // The small surface lets offline tests exercise the real pipeline.
  request: import('@octokit/app').App['octokit']['request'];
}
