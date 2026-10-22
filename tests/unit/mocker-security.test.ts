import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createManualModuleSource, interceptorPlugin } from '@vitest/mocker/node';
import { normalizePath, resolveConfig } from 'vite';
import ts from 'typescript';

// Exercise the installed public mocker API. Payloads are parsed as text only;
// no generated JavaScript is executed and no dev server or socket is opened.
describe('mocker security boundaries', () => {
  it('keeps an adversarial manual mock URL as a single string argument', () => {
    const url = 'x"); globalThis.__codeguardInjected = true; void("';
    const source = createManualModuleSource(url, ['value']);
    const parsed = ts.createSourceFile('mock.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const identifiers: string[] = [];
    const argumentsFound: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isIdentifier(node)) identifiers.push(node.text);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'getFactoryModule') {
        expect(node.arguments).toHaveLength(1);
        expect(ts.isStringLiteral(node.arguments[0])).toBe(true);
        if (ts.isStringLiteral(node.arguments[0])) argumentsFound.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(argumentsFound).toEqual([url]);
    expect(identifiers).not.toContain('__codeguardInjected');
  });

  it('preserves quoted/newline export names without producing invalid module syntax', () => {
    const name = 'quoted"export\nname';
    const source = createManualModuleSource('/synthetic.ts', [name]);
    const parsed = ts.createSourceFile('mock.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    // TypeScript exposes parser diagnostics on the source file at runtime.
    expect((parsed as ts.SourceFile & { parseDiagnostics: readonly unknown[] }).parseDiagnostics).toEqual([]);
    const aliases: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isExportSpecifier(node) && ts.isStringLiteral(node.name)) aliases.push(node.name.text);
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(aliases).toEqual([name]);
  });

  it.each([
    ['inside root', 'traversal:./inside.txt', 'SYNTHETIC_INSIDE'],
    ['forward-slash traversal', 'traversal:../outside.txt', undefined],
    ['Windows backslash traversal', 'traversal:..\\outside.txt', undefined],
  ])('enforces the filesystem boundary for %s', async (_label, redirect, expected) => {
    const parent = resolve(tmpdir());
    const temporary = await mkdtemp(join(parent, 'codeguard-mocker-'));
    try {
      const root = normalizePath(join(temporary, 'root'));
      await mkdir(root);
      await writeFile(join(root, 'inside.txt'), 'SYNTHETIC_INSIDE');
      await writeFile(join(temporary, 'outside.txt'), 'SYNTHETIC_OUTSIDE');
      const config = await resolveConfig({ root, configFile: false, logLevel: 'silent',
        server: { fs: { strict: true, allow: [root] } } }, 'serve');
      const handlers = new Map<string, (event: unknown) => void>();
      const plugin = interceptorPlugin();
      const configure = plugin.configureServer as (server: unknown) => unknown;
      await configure({ config, ws: { on: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler), send: () => undefined } });
      const register = handlers.get('vitest:interceptor:register');
      expect(register).toBeDefined();
      const id = join(root, 'probe.js');
      register!({ type: 'redirect', raw: '', id, url: '/probe.js', redirect });
      const load = plugin.load as { handler: (id: string) => Promise<string | undefined> };
      await expect(load.handler(id)).resolves.toBe(expected);
    } finally {
      if (dirname(resolve(temporary)) !== parent || !basename(temporary).startsWith('codeguard-mocker-')) {
        throw new Error('Unexpected temporary cleanup path');
      }
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
