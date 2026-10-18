/** Credentials are allowed only at the explicitly selected provider's origin. */
export function hostedFetch(origin: string): typeof globalThis.fetch {
  return async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? new URL(input) : new URL(input.url);
    if (url.origin !== origin) throw new Error('Unexpected LLM API origin.');
    return globalThis.fetch(input, { ...init, redirect: 'error' });
  };
}
