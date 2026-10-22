// Synthetic scan-only fixture. Do not invoke this function during rehearsal.
export function parsePayload(input: string): unknown {
  return JSON.parse(input);
}
