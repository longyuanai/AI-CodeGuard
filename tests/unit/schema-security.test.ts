import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { ConfigSchema } from '../../src/config/schema.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { validateCustomRules } from '../../src/rules/custom.js';

describe('bounded configuration validation', () => {
  it.each(['include', 'exclude', 'disable'])('rejects oversized %s before reading any element', field => {
    const values = Array(1025).fill(null);
    Object.defineProperty(values, 0, { get() { throw new Error('element validation must not run'); } });
    const section = field === 'disable' ? 'rules' : 'scan';
    const result = ConfigSchema.safeParse({ [section]: { [field]: values } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]).toMatchObject({ code: 'too_big', path: [section, field] });
    }
  });

  it('accepts a collection at the documented limit', () => {
    expect(ConfigSchema.parse({ rules: { disable: Array(1024).fill('CG-001') } }).rules.disable).toHaveLength(1024);
  });

  it.each([{}, { scan: undefined, rules: undefined, llm: undefined, output: undefined, cache: undefined }])(
    'preserves all nested defaults for omitted sections: %j', input => {
      expect(ConfigSchema.parse(input)).toEqual(DEFAULT_CONFIG);
    },
  );

  it('rejects null sections and preserves useful error paths', () => {
    const result = ConfigSchema.safeParse({ llm: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['llm']);
  });
});

describe('custom-rule collection limits', () => {
  it.each(['match', 'on', 'arguments', 'patterns', 'exclude', 'languages', 'rules'])(
    'rejects oversized %s through the actual YAML loader', async field => {
      const pattern: Record<string, unknown> = { type: 'function_call', function: { match: ['eval'] } };
      const rule: Record<string, unknown> = { id: 'CR-BOUNDS', name: 'synthetic rule', severity: 'high',
        category: 'injection', languages: ['typescript'], description: 'scan-only fixture', patterns: [pattern] };
      let document: unknown = rule;
      if (field === 'match' || field === 'on') {
        (pattern.function as Record<string, unknown>)[field] = Array(1025).fill('eval');
      } else if (field === 'arguments') pattern.arguments = Array(1025).fill({ type: 'literal' });
      else if (field === 'languages') rule.languages = Array(1025).fill('typescript');
      else if (field === 'rules') document = { rules: Array.from({ length: 1025 }, (_, id) => ({ ...rule, id: `CR-${id}` })) };
      else rule[field] = Array(1025).fill(pattern);
      const parent = resolve(tmpdir());
      const temporary = await mkdtemp(join(parent, 'codeguard-schema-'));
      try {
        const file = join(temporary, 'rules.yml');
        await writeFile(file, stringify(document, { aliasDuplicateObjects: false }));
        await expect(validateCustomRules(file)).rejects.toThrow('Invalid custom rules');
      } finally {
        if (dirname(temporary) !== parent || !basename(temporary).startsWith('codeguard-schema-')) throw new Error('Unexpected temporary path');
        await rm(temporary, { recursive: true, force: true });
      }
    },
  );
});
