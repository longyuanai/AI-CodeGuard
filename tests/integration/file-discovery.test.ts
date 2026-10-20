import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan } from '../../src/scanner/orchestrator.js';
import { ConfigSchema } from '../../src/config/schema.js';

describe('file discovery glob compatibility', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'codeguard-glob-'));
    for (const name of ['src/a.ts', 'src/b.js', 'src/nested/c.ts', 'src/.hidden.ts',
      'src/a.test.ts', 'src/[code]{a,b}.ts', 'src/1.ts', 'src/2.ts', 'other/d.py']) {
      await mkdir(join(root, name, '..'), { recursive: true });
      await writeFile(join(root, name), name.endsWith('.py') ? 'x = 1' : 'const x = 1;');
    }
  });
  afterAll(async () => { await rm(root, { recursive: true, force: true }); });

  async function discover(paths: string[], include = ['**/*.{ts,js,py}'], exclude = ['**/*.test.*']) {
    const result = await scan({ paths, rootDir: root,
      config: ConfigSchema.parse({ scan: { include, exclude }, cache: { enabled: false } }),
      dryRun: true, fix: false, output: 'json', verbose: false, report: false });
    expect(result.skipped).toEqual([]);
    expect(result.llmCalls).toBe(0);
    return result.files;
  }

  it('preserves recursive braces, exclusions, hidden-file and duplicate behavior', async () => {
    expect(await discover(['src', 'src/a.ts'])).toBe(6);
  });
  it('preserves extglobs and negative patterns', async () => {
    expect(await discover(['src/**/@(a|b|c).{ts,js}', '!**/nested/**'])).toBe(2);
  });
  it('preserves numeric brace ranges', async () => {
    expect(await discover(['src/{1..2}.ts'])).toBe(2);
  });
  it('escapes literal filenames containing glob characters', async () => {
    expect(await discover(['src/[code]{a,b}.ts'])).toBe(1);
  });
  it('uses configured include patterns when no paths are given', async () => {
    expect(await discover([], ['other/**/*.py'])).toBe(1);
  });
  it('handles deeply nested braces without exhausting the stack', async () => {
    expect(await discover(['{'.repeat(2000) + 'absent' + '}'.repeat(2000)])).toBe(0);
  }, 3000);
});
