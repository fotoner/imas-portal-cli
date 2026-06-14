import { ImasError } from './errors';

/**
 * Input validators shared by the CLI. Each throws `ImasError('BAD_ARG', …)` on bad
 * input so the CLI's single catch can map it to exit code 2 — and so they stay pure
 * and unit-testable (no `process.exit`, no commander coupling).
 */

/** Parse a `--limit`-style flag as a positive integer, or throw BAD_ARG. */
export function parsePositiveInt(input: string, flag = '--limit'): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ImasError('BAD_ARG', `${flag} must be a positive integer, got "${input}"`);
  }
  return n;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a `--from`/`--to`-style YYYY-MM-DD flag (JST). Returns the trimmed string,
 * passes `undefined` through, or throws BAD_ARG. Rejects both bad shapes ("yesterday")
 * and impossible dates ("2026-13-45"), so a typo surfaces as an error instead of a
 * silently-empty result.
 */
export function parseIsoDate(input: string | undefined, flag: string): string | undefined {
  if (input == null) return undefined;
  const s = input.trim();
  if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00+09:00`))) {
    throw new ImasError('BAD_ARG', `${flag} must be a valid YYYY-MM-DD date (JST), got "${input}"`);
  }
  return s;
}

const MMDD = /^(\d{1,2})\/(\d{1,2})$/;

/**
 * Validate a `--from`/`--to`-style MM/DD flag (used by `birthdays`). Returns a
 * zero-padded "MM/DD", passes `undefined` through (so the caller can default it), or
 * throws BAD_ARG. A malformed value errors instead of silently falling back to today.
 */
export function parseMmdd(input: string | undefined, flag: string): string | undefined {
  if (input == null) return undefined;
  const m = MMDD.exec(input.trim());
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    }
  }
  throw new ImasError('BAD_ARG', `${flag} must be MM/DD, got "${input}"`);
}
