import { z } from 'zod';

// Leading bounds let patched Zod reject oversized collections before parsing
// their elements (GHSA-mrhx-c7xc-m3w5). Shared with custom-rule data schemas.
export const MAX_CONFIG_ITEMS = 1024;

export const ConfigSchema = z.object({
  scan: z.object({
    include: z.array(z.string()).max(MAX_CONFIG_ITEMS).default(['**/*.{ts,js,py,go,java,php}']),
    exclude: z.array(z.string()).max(MAX_CONFIG_ITEMS).default(['node_modules', '**/*.test.*', '**/*.spec.*', '**/*.min.js', 'dist', 'build']),
  }).prefault({}),

  rules: z.object({
    preset: z.enum(['owasp-top-10', 'all', 'none']).default('owasp-top-10'),
    custom: z.string().optional(),
    disable: z.array(z.string()).max(MAX_CONFIG_ITEMS).default([]),
  }).prefault({}),

  llm: z.object({
    provider: z.enum(['claude', 'openai']).default('claude'),
    model: z.string().default('claude-sonnet-5'),
    apiKey: z.string().optional(),
    maxConcurrency: z.number().min(1).max(20).default(5),
    maxCostUSD: z.number().optional(),
  }).prefault({}),

  output: z.object({
    format: z.enum(['sarif', 'json', 'text']).default('text'),
    file: z.string().optional(),
  }).prefault({}),

  cache: z.object({
    enabled: z.boolean().default(false),
    directory: z.string().default('.codeguard-cache'),
    ttl: z.number().default(86400),
  }).prefault({}),
});

export type ParsedConfig = z.infer<typeof ConfigSchema>;
