/**
 * A cast failure carrying a `chrome.cast.ErrorCode`.
 *
 * The SDK is inconsistent about how it reports failures: some paths reject with
 * a bare ErrorCode string, some with a `chrome.cast.Error` object, and
 * `requestSession()` *resolves* with one rather than rejecting. `errorCodeOf`
 * flattens all of those to a code so callers have one thing to check.
 */
export class CastError extends Error {
  constructor(public readonly code: string) {
    super(`cast failed: ${code}`);
    this.name = 'CastError';
  }
}

export function errorCodeOf(error: unknown): string {
  if (error instanceof CastError) {
    return error.code;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'unknown';
}
