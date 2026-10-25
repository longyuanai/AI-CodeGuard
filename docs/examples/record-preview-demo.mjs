// Reproduce the public preview demo with synthetic code and real child output.
// Requires Node ^24.22.0 and curl; never executes scanned sample functions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
assert.ok(major === 24 && minor >= 22, 'Requires Node ^24.22.0');
assert.ok(process.argv[2], 'Usage: node docs/examples/record-preview-demo.mjs <new-output-directory> [previously-downloaded-assets-directory]');
const previousDownloads = process.argv[3] ? resolve(process.argv[3]) : null;
const evidence = resolve(process.argv[2]);
await mkdir(dirname(evidence), { recursive: true });
await mkdir(evidence); // Deliberately refuses to overwrite an existing capture.
const consumer = await mkdtemp(join(tmpdir(), 'codeguard-demo-'));
await writeFile(join(evidence, 'consumer-path.txt'), consumer + '\n');
const source = dirname(fileURLToPath(import.meta.url));
const tag = 'selfhosted-preview-20261022.1';
const expectedHash = 'd8fadbef81e01f257956f3cea5251e70feea9040570fb8e0b2ce830331cc7a82';
const release = `https://github.com/longyuanai/AI-CodeGuard/releases/download/${tag}`;
const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const allowed = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC',
  'PATHEXT', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA']);
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => allowed.has(name.toUpperCase())));
await writeFile(join(consumer, 'user.npmrc'), '');
await writeFile(join(consumer, 'global.npmrc'), '');
Object.assign(environment, { CODEGUARD_E2E: '0', NO_COLOR: '1', FORCE_COLOR: '0', CI: 'true',
  NPM_CONFIG_USERCONFIG: join(consumer, 'user.npmrc'),
  NPM_CONFIG_GLOBALCONFIG: join(consumer, 'global.npmrc'), NPM_CONFIG_CACHE: join(consumer, '.npm-cache') });
const started = process.hrtime.bigint();
const frames = [], transcript = [], checks = [], stages = [];
const timestamp = Math.floor(Date.now() / 1000);
function record(value) {
  const clean = value.replaceAll(consumer, '<DEMO>').replaceAll(consumer.replaceAll('\\', '/'), '<DEMO>')
    .replace(/\r?\n/g, '\r\n');
  frames.push([Number(process.hrtime.bigint() - started) / 1e9, 'o', clean]);
  transcript.push(clean);
}
async function command(executable, args, display, expected = 0) {
  record(`\n$ ${display}\n`);
  const child = spawn(executable, args, { cwd: consumer, env: environment,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  for (const stream of [child.stdout, child.stderr]) {
    const decoder = new StringDecoder('utf8');
    stream.on('data', data => record(decoder.write(data)));
    stream.on('end', () => { const last = decoder.end(); if (last) record(last); });
  }
  const exit = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('close', done);
  });
  record(`[exit=${exit}]\n`);
  checks.push({ command: display, exit, expected });
  assert.equal(exit, expected, display);
  await new Promise(done => setTimeout(done, 500));
}
const node = (args, expected = 0) => command(process.execPath, args, `node ${args.join(' ')}`, expected);
const npm = args => command(process.execPath, [npmCli, ...args], `npm ${args.join(' ')}`);
record(`AI-CodeGuard ${tag} | real scripted terminal-output capture\n`);
record('Prompts, sample headings and exit stamps are scripted; child output and timing are real.\n');
record('Synthetic samples are parsed, never invoked. --dry-run only; no LLM key or paid calls.\n');
let succeeded = false;
try {
  await node(['--version']);
  await npm(['--version']);
  if (previousDownloads) {
    record('# Using local files previously downloaded anonymously; this capture does not claim a new download.\n');
    for (const name of ['ai-codeguard-0.4.0.tgz', 'SHA256SUMS']) {
      await copyFile(join(previousDownloads, name), join(consumer, name));
      record(`# Copied previously downloaded ${name}; SHA256 verification follows.\n`);
    }
  } else {
    for (const name of ['ai-codeguard-0.4.0.tgz', 'SHA256SUMS']) {
      const args = ['-q', '--no-netrc', '--header', 'Authorization:', '--header', 'Cookie:',
        '--proto', '=https', '--proto-redir', '=https', '--fail', '--location', '--silent', '--show-error',
        '--connect-timeout', '20', '--max-time', '90', '--retry', '2', '--retry-all-errors', '--output', name,
        '--write-out', 'HTTP %{http_code} bytes=%{size_download}\n', `${release}/${name}`];
      await command(process.platform === 'win32' ? 'curl.exe' : 'curl', args,
        `curl -q --no-netrc --header 'Authorization:' --header 'Cookie:' --proto '=https' --proto-redir '=https' --fail --location --silent --show-error --connect-timeout 20 --max-time 90 --retry 2 --retry-all-errors --output ${name} --write-out 'HTTP %{http_code} bytes=%{size_download}\\n' ${release}/${name}`);
    }
  }
  await writeFile(join(consumer, 'verify-sha256.mjs'), `import assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nconst hash=createHash('sha256').update(await readFile('ai-codeguard-0.4.0.tgz')).digest('hex');\nconst sums=await readFile('SHA256SUMS','utf8');\nconst lines=sums.split(/\\r?\\n/).filter(line=>/^[a-f0-9]{64}  ai-codeguard-0\\.4\\.0\\.tgz$/.test(line));\nassert.equal(lines.length,1);\nassert.equal(hash,lines[0].split('  ')[0]);\nassert.equal(hash,'${expectedHash}');\nconsole.log('SHA256 OK: '+hash);\n`);
  await node(['verify-sha256.mjs']);
  await npm(['init', '-y']);
  await npm(['install', './ai-codeguard-0.4.0.tgz', '--ignore-scripts', '--omit=dev', '--engine-strict', '--registry=https://registry.npmjs.org']);
  const cli = 'node_modules/ai-codeguard/dist/index.js';
  await node([cli, '--version']);
  await node([cli, '--help']);
  // Show a deliberate execution error before finishing with successful repair.
  await node([cli, 'scan', 'probe.ts', '--dry-run', '--config', 'missing-config.yml'], 2);
  for (const [stage, findings, exit] of [['safe', 0, 0], ['vulnerable', 1, 1], ['fixed', 0, 0]]) {
    await copyFile(join(source, 'github-app', `${stage}.ts`), join(consumer, 'probe.ts'));
    record(`\n# ${stage}: actual probe.ts contents (copied from ${stage}.ts)\n`);
    record(await readFile(join(consumer, 'probe.ts'), 'utf8'));
    await node([cli, 'scan', 'probe.ts', '--dry-run', '--output', 'text', '--fail-on', 'high'], exit);
    const reportName = `${stage}-report.json`;
    await node([cli, 'scan', 'probe.ts', '--dry-run', '--output', 'json', '--fail-on', 'high', '--output-file', reportName], exit);
    const report = JSON.parse(await readFile(join(consumer, reportName), 'utf8'));
    assert.equal(report.scan.files, 1);
    assert.equal(report.scan.totalFindings, findings);
    assert.equal(report.scan.llmCalls, 0);
    assert.equal(report.scan.estimatedCost, 0);
    assert.deepEqual(report.skipped, []);
    if (findings) {
      assert.equal(report.findings[0].ruleId, 'CG-003');
      assert.equal(report.findings[0].severity, 'critical');
      assert.equal(report.findings[0].location.start.line, 3);
    }
    const summary = { stage, files: 1, findings, exit, llmCalls: 0, estimatedCost: 0, skipped: 0 };
    stages.push(summary);
    record(JSON.stringify(summary) + '\n');
    await writeFile(join(evidence, reportName), JSON.stringify(report, null, 2) + '\n');
  }
  succeeded = true;
} finally {
  const header = { version: 2, width: 110, height: 30, timestamp,
    title: `AI-CodeGuard ${tag}: real install -> alert -> repair -> rescan`, env: { TERM: 'xterm-256color' } };
  await writeFile(join(evidence, 'preview-install-demo.cast'), [header, ...frames].map(item => JSON.stringify(item)).join('\n') + '\n');
  await writeFile(join(evidence, 'transcript.log'), transcript.join(''));
  await writeFile(join(evidence, 'checks.json'), JSON.stringify({ succeeded, release: tag,
    node: process.version, expectedHash, downloadSource: previousDownloads ? 'previously downloaded files; reverified in this capture' : 'anonymous requests in this capture',
    checks, stages, sourceExecuted: false, llmCalls: 0 }, null, 2) + '\n');
}
console.log(JSON.stringify({ succeeded, commands: checks.length, stages, captureFrames: frames.length }, null, 2));
