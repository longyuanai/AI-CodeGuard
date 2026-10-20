import { createHmac } from 'node:crypto';
export const event = {
  action: 'opened', number: 1, installation: { id: 42 },
  repository: { name: 'repo', owner: { login: 'owner' } },
  pull_request: { head: { sha: 'a'.repeat(40), repo: { name: 'repo', owner: { login: 'owner' } } } },
};
export function signed(body: unknown = event, id = 'delivery-1', type = 'pull_request') {
  const raw = JSON.stringify(body);
  return { method: 'POST', body: raw, headers: {
    'x-hub-signature-256': 'sha256=' + createHmac('sha256', 'secret').update(raw).digest('hex'),
    'x-github-event': type, 'x-github-delivery': id,
  } };
}
