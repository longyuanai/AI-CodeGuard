/** Small, side-effect-free API shared by the CLI and the GitHub App. */
export { scan, type ScanOptions } from './scanner/orchestrator.js';
export { loadConfig, DEFAULT_CONFIG } from './config/loader.js';
export { ConfigSchema } from './config/schema.js';
export { formatGitHubReview } from './reporter/github.js';
export { fingerprintFinding } from './scanner/baseline.js';
export { parseUnifiedDiff, overlapsChangedLines, type ChangedLines } from './scanner/diff.js';
export { detectLanguage } from './parser/index.js';
export { SEVERITY_RANK } from './types/index.js';
export type { CodeGuardConfig, ScanResult, Finding, Severity } from './types/index.js';
export type { AnalyzeFindingsDependencies } from './analyzer/index.js';
