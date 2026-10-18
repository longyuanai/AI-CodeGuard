import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, ConfigSchema } from 'ai-codeguard';

describe('built library with bundled wasm', () => {
  it('scans six fixture languages from an explicit root without changing cwd', async () => {
    const cwd = process.cwd();
    const rootDir = fileURLToPath(new URL('../../tests/fixtures', import.meta.url));
    const result = await scan({
      paths: ['vulnerable'], rootDir, config: ConfigSchema.parse({}),
      dryRun: true, fix: false, output: 'json', verbose: false, report: false,
    });
    expect(result.skipped).toEqual([]);
    expect(result.findings.length).toBeGreaterThan(50);
    for (const ext of ['ts', 'py', 'go', 'java', 'php']) {
      expect(result.findings.some(f => f.file.endsWith(`.${ext}`))).toBe(true);
    }
    expect(result.findings.every(f => f.file.startsWith('vulnerable/'))).toBe(true);
    expect(process.cwd()).toBe(cwd);
  });
});
it('treats existing filenames containing glob syntax as literal paths', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'codeguard-literal-'));
  try {
    await writeFile(join(rootDir, '[code]{a,b}.ts'), 'eval(req.query.input);');
    const result = await scan({ paths: ['[code]{a,b}.ts'], rootDir, config: ConfigSchema.parse({}),
      dryRun: true, fix: false, output: 'json', verbose: false, report: false });
    expect(result.files).toBe(1); expect(result.findings).toHaveLength(1);
  } finally { await rm(rootDir, { recursive: true, force: true }); }
});
