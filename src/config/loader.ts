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

  if (configPath) {
    const result = await explorer.load(configPath);
    if (result) {
      rawConfig = result.config as Record<string, unknown>;
    }
  } else {
    const result = await explorer.search();
    if (result) {
      rawConfig = result.config as Record<string, unknown>;
    }
  }

  return resolveConfig(rawConfig);
}

/** Parse data-only configuration; callers choose the trusted environment. */
export function resolveConfig(raw: Record<string, unknown> = {}, env: NodeJS.ProcessEnv = process.env): CodeGuardConfig {
  const rawConfig = structuredClone(raw);
  applyEnvOverrides(rawConfig, env);

  // Validate and apply defaults via Zod
  const parsed = ConfigSchema.parse(rawConfig);

  return parsed as CodeGuardConfig;
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
