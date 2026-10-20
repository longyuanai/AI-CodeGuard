import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../scripts/check-runtime.mjs', import.meta.url));
const parent = resolve(tmpdir());
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(parent, 'codeguard-package-test-'));
  await mkdir(join(directory, 'node_modules'));
});
afterEach(async () => {
  if (dirname(resolve(directory)) !== parent || !basename(directory).startsWith('codeguard-package-test-')) {
    throw new Error('Unexpected test directory');
  }
  await rm(directory, { recursive: true, force: true });
});

it('rejects development worker tools retained in nested production dependencies', async () => {
  await mkdir(join(directory, 'node_modules/package/node_modules/tinypool'), { recursive: true });
  const result = spawnSync(process.execPath, [script, directory], { encoding: 'utf8', windowsHide: true });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Dev-only tool retained:');
  expect(result.stderr).toContain('tinypool');
});

it('rejects a production package missing bundled parser assets', async () => {
  await mkdir(join(directory, 'dist/tree-sitter'), { recursive: true });
  const result = spawnSync(process.execPath, [script, directory], { encoding: 'utf8', windowsHide: true });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Unexpected wasm asset set');
});
