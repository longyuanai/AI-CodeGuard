// Run from a production-only install, or pipe into `docker exec -i ... node
// --input-type=module`. This checks package layout and performs no API calls.
import { access, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? process.cwd());
const summary = { kind: 'production package smoke', tools: {}, wasm: [], scan: null };
const devTools = new Set(['vitest', '@vitest', 'tinypool', 'tsup', 'vite', 'esbuild']);

// Inspect installed package directories, not require.resolve(), which could
// accidentally find tools in the development checkout above an isolated install.
async function checkModules(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const location = join(directory, entry.name);
    if (devTools.has(entry.name)) throw new Error(`Dev-only tool retained: ${location}`);
    if (entry.name.startsWith('.') || entry.isSymbolicLink() || !entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) { await checkModules(location); continue; }
    await checkModules(join(location, 'node_modules'));
  }
}
await access(join(root, 'node_modules'));
await checkModules(join(root, 'node_modules'));
await checkModules(join(root, 'app/node_modules'));
for (const tool of devTools) summary.tools[tool] = 'absent';
try { await access(join(root, 'node_modules/typescript')); summary.tools.typescript = 'present'; }
catch (error) { if (error.code !== 'ENOENT') throw error; summary.tools.typescript = 'absent'; }

const expected = ['tree-sitter-go.wasm', 'tree-sitter-java.wasm',
  'tree-sitter-javascript.wasm', 'tree-sitter-php.wasm', 'tree-sitter-python.wasm',
  'tree-sitter-tsx.wasm', 'web-tree-sitter.wasm'];
const assetDirectory = join(root, 'dist/tree-sitter');
const actual = (await readdir(assetDirectory)).filter(file => file.endsWith('.wasm')).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Unexpected wasm asset set');
for (const file of actual) {
  const { size } = await stat(join(assetDirectory, file));
  if (!size) throw new Error(`Empty wasm asset: ${file}`);
  summary.wasm.push({ file, bytes: size });
}

const { scan, ConfigSchema } = await import(pathToFileURL(join(root, 'dist/lib.js')).href);
const parent = resolve(tmpdir());
const temporary = await mkdtemp(join(parent, 'codeguard-runtime-'));
try {
  await writeFile(join(temporary, 'probe.php'), '<?php eval($_GET["code"]);');
  const result = await scan({ paths: ['probe.php'], rootDir: temporary,
    config: ConfigSchema.parse({ cache: { enabled: false }, llm: { maxCostUSD: 0 } }),
    dryRun: true, fix: false, output: 'json', verbose: false, report: false });
  if (result.files !== 1 || result.skipped.length || !result.findings.length || result.llmCalls) {
    throw new Error('Production PHP scan failed');
  }
  summary.scan = { files: result.files, findings: result.findings.length,
    skipped: result.skipped.length, llmCalls: result.llmCalls };
  await writeFile(join(temporary, 'safe.php'), '<?php echo "hello";');
  const safe = await scan({ paths: ['safe.php'], rootDir: temporary,
    config: ConfigSchema.parse({ cache: { enabled: false }, llm: { maxCostUSD: 0 } }),
    dryRun: true, fix: false, output: 'json', verbose: false, report: false });
  if (safe.files !== 1 || safe.skipped.length || safe.findings.length || safe.llmCalls) {
    throw new Error('Production safe PHP scan failed');
  }
  summary.safeScan = { files: safe.files, findings: safe.findings.length,
    skipped: safe.skipped.length, llmCalls: safe.llmCalls };
} finally {
  if (dirname(resolve(temporary)) !== parent || !basename(temporary).startsWith('codeguard-runtime-')) {
    throw new Error('Unexpected temporary directory');
  }
  await rm(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 2));
