import { describe, expect, it } from 'vitest';
import { CastError, errorCodeOf } from '~/utils/castError';

describe('errorCodeOf', () => {
  it('reads the code off a CastError', () => {
    expect(errorCodeOf(new CastError('session_error'))).toBe('session_error');
  });

  it('accepts a bare ErrorCode string — some SDK paths reject with one', () => {
    expect(errorCodeOf('cancel')).toBe('cancel');
  });

  it('accepts a chrome.cast.Error object', () => {
    expect(errorCodeOf({ code: 'receiver_unavailable', description: null })).toBe(
      'receiver_unavailable',
    );
  });

  it('falls back to "unknown" for anything else', () => {
    expect(errorCodeOf(new TypeError('boom'))).toBe('unknown');
    expect(errorCodeOf(null)).toBe('unknown');
    expect(errorCodeOf({ code: 42 })).toBe('unknown');
  });
});
