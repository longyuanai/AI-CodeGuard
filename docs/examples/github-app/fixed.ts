// Synthetic scan-only fixture. Do not invoke this function during rehearsal.
export function parsePayload(input: string): unknown {
  const payload: unknown = JSON.parse(input);
  return payload;
}
