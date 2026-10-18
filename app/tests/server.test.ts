import { describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { event, signed } from './webhook.js';
function setup(handle = vi.fn().mockResolvedValue(undefined)) {
  return { ...createServer({ secret: 'secret', allowedRepositories: new Set(['owner/repo']), handle }), handle };
}
describe('webhook boundary', () => {
  it('serves health without credentials', async () => {
    expect((await setup().app.request('/healthz')).status).toBe(200);
  });
  it('rejects absent, forged and body-mismatched signatures before any work', async () => {
    const s = setup();
    for (const sig of ['', 'sha256=' + '0'.repeat(64)]) {
      const req = signed(); req.headers['x-hub-signature-256'] = sig;
      expect((await s.app.request('/webhook', req)).status).toBe(401);
    }
    expect((await s.app.request('/webhook', { ...signed(), body: '{}' })).status).toBe(401);
    expect(s.handle).not.toHaveBeenCalled();
  });
  it('filters events, actions and repositories', async () => {
    const s = setup();
    for (const req of [signed({}, '1', 'ping'), signed({ action: 'closed' }),
      signed({ ...event, repository: { name: 'other', owner: { login: 'owner' } } })]) {
      expect((await s.app.request('/webhook', req)).status).toBe(202);
    }
    expect(s.handle).not.toHaveBeenCalled();
  });
  it('validates event data and deduplicates deliveries', async () => {
    const s = setup();
    expect((await s.app.request('/webhook', signed({ action: 'opened' }))).status).toBe(400);
    await s.app.request('/webhook', signed());
    expect(await (await s.app.request('/webhook', signed())).json()).toEqual({ duplicate: true });
    await s.idle(); expect(s.handle).toHaveBeenCalledTimes(1);
  });
  it('allows failed deliveries to retry and never logs error data', async () => {
    const log = vi.fn(); const handle = vi.fn().mockRejectedValue(new Error('secret TOKEN code'));
    const s = createServer({ secret: 'secret', allowedRepositories: new Set(['owner/repo']), handle, log });
    await s.app.request('/webhook', signed()); await s.idle();
    await s.app.request('/webhook', signed()); await s.idle();
    expect(handle).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/TOKEN|secret/);
  });
});
