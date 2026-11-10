import { dirname, isAbsolute, resolve } from 'node:path';
import { cosmiconfig } from 'cosmiconfig';
import { ConfigSchema } from './schema.js';
import type { CodeGuardConfig } from '../types/index.js';

const MODULE_NAME = 'codeguard';

export async function loadConfig(configPath?: string): Promise<CodeGuardConfig> {
  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      '.codeguard.yml',
      '.codeguard.yaml',
      '.codeguard.json',
      'codeguard.config.js',
      'codeguard.config.ts',
    ],
  });

  let rawConfig: Record<string, unknown> = {};
  let configDir: string | undefined;

  if (configPath) {
    const result = await explorer.load(configPath);
    if (result) {
      rawConfig = result.config as Record<string, unknown>;
      if (result.filepath) {
        configDir = dirname(resolve(result.filepath));
      }
    }
  } else {
    const result = await explorer.search();
    if (result) {
      rawConfig = result.config as Record<string, unknown>;
      if (result.filepath) {
        configDir = dirname(resolve(result.filepath));
      }
    }
  }

  return resolveConfig(rawConfig, process.env, configDir);
}

/** Parse data-only configuration; callers choose the trusted environment. */
export function resolveConfig(
  raw: Record<string, unknown> = {},
  env: NodeJS.ProcessEnv = process.env,
  baseDir?: string,
): CodeGuardConfig {
  const rawConfig = structuredClone(raw);
  applyEnvOverrides(rawConfig, env);

  // Validate and apply defaults via Zod
  const parsed = ConfigSchema.parse(rawConfig) as CodeGuardConfig;

  if (baseDir && parsed.rules.custom && !isAbsolute(parsed.rules.custom)) {
    parsed.rules.custom = resolve(baseDir, parsed.rules.custom);
  }

  return parsed;
}

function applyEnvOverrides(config: Record<string, unknown>, env: NodeJS.ProcessEnv): void {
  const llm = (config.llm ?? {}) as Record<string, unknown>;
  const provider = (llm.provider as string) ?? 'claude';

  const providerKey = provider === 'openai'
    ? env.OPENAI_API_KEY
    : env.ANTHROPIC_API_KEY;
  const apiKey = env.CODEGUARD_API_KEY || providerKey;

  if (apiKey) {
    llm.apiKey = apiKey;
    config.llm = llm;
  }

  if (env.CODEGUARD_MODEL) {
    const llm = (config.llm ?? {}) as Record<string, unknown>;
    llm.model = env.CODEGUARD_MODEL;
    config.llm = llm;
  }

  if (env.CODEGUARD_MAX_COST) {
    const llm = (config.llm ?? {}) as Record<string, unknown>;
    llm.maxCostUSD = parseFloat(env.CODEGUARD_MAX_COST);
    config.llm = llm;
  }
}

export { DEFAULT_CONFIG } from './defaults.js';
