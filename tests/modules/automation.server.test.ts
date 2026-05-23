import { describe, it, expect } from 'vitest';
import { classifyError } from '~/modules/automation.server';

describe('classifyError', () => {
  describe('4xx: terminal (human intervention required)', () => {
    it.each([
      ['400 Bad Request', 'API failed (400): malformed request'],
      ['401 Unauthorized', 'Twitter create tweet failed (401): unauthorized'],
      ['402 CreditsDepleted', 'Twitter create tweet failed (402): {"title":"CreditsDepleted"}'],
      ['403 Forbidden', 'Bluesky post failed (403): forbidden'],
      ['404 Not Found', 'Misskey note failed (404): not found'],
      ['422 Unprocessable', 'API failed (422): validation error'],
    ])('%s → terminal', (_label, msg) => {
      expect(classifyError(new Error(msg))).toBe('terminal');
    });
  });

  describe('retryable: rate limits, timeouts, server errors', () => {
    it.each([
      ['408 Request Timeout', 'API failed (408): timeout'],
      ['429 Too Many Requests', 'API failed (429): rate limit'],
      ['500 Internal Server Error', 'API failed (500): server error'],
      ['502 Bad Gateway', 'API failed (502)'],
      ['503 Service Unavailable', 'API failed (503)'],
      ['504 Gateway Timeout', 'API failed (504)'],
    ])('%s → retryable', (_label, msg) => {
      expect(classifyError(new Error(msg))).toBe('retryable');
    });
  });

  describe('network errors: ambiguous (delivery unknown)', () => {
    it.each([
      ['ECONNRESET', 'fetch failed: ECONNRESET'],
      ['ECONNREFUSED', 'connect ECONNREFUSED 1.2.3.4:443'],
      ['ETIMEDOUT', 'request ETIMEDOUT'],
      ['fetch failed (no status)', 'fetch failed'],
    ])('%s → ambiguous', (_label, msg) => {
      expect(classifyError(new Error(msg))).toBe('ambiguous');
    });
  });

  describe('unknown patterns', () => {
    it('non-Error value is coerced to string', () => {
      expect(classifyError('Twitter create tweet failed (402): nope')).toBe('terminal');
    });

    it('does not falsely match 3-digit codes inside JSON bodies', () => {
      // Twitter error codes (e.g. "code":416) live inside JSON without parentheses
      expect(classifyError(new Error('something: {"code":416,"message":"x"}'))).toBe('ambiguous');
    });

    it('completely unknown error → ambiguous', () => {
      expect(classifyError(new Error('something exploded'))).toBe('ambiguous');
    });
  });
});
