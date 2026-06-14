import { describe, it, expect } from 'vitest';
import { parsePositiveInt, parseIsoDate, parseMmdd } from '../src/core/validate';
import { ImasError } from '../src/core/errors';

describe('parsePositiveInt', () => {
  it('accepts a positive integer', () => {
    expect(parsePositiveInt('20')).toBe(20);
    expect(parsePositiveInt('1')).toBe(1);
  });
  it('rejects non-numbers, zero, negatives, floats, and NaN', () => {
    for (const bad of ['abc', '0', '-5', '2.5', '', 'NaN']) {
      expect(() => parsePositiveInt(bad)).toThrowError(ImasError);
    }
  });
  it('names the flag in the error', () => {
    expect(() => parsePositiveInt('x', '--limit')).toThrow(/--limit/);
  });
});

describe('parseIsoDate', () => {
  it('passes undefined through', () => {
    expect(parseIsoDate(undefined, '--from')).toBeUndefined();
  });
  it('accepts a valid YYYY-MM-DD', () => {
    expect(parseIsoDate('2026-06-14', '--from')).toBe('2026-06-14');
  });
  it('rejects bad shapes and impossible dates', () => {
    for (const bad of ['yesterday', '2026/06/14', '2026-13-45', '2026-6-1']) {
      expect(() => parseIsoDate(bad, '--from')).toThrowError(ImasError);
    }
  });
});

describe('parseMmdd', () => {
  it('passes undefined through and zero-pads', () => {
    expect(parseMmdd(undefined, '--from')).toBeUndefined();
    expect(parseMmdd('6/14', '--from')).toBe('06/14');
    expect(parseMmdd('12/25', '--to')).toBe('12/25');
  });
  it('rejects malformed and out-of-range', () => {
    for (const bad of ['garbage', '13/01', '00/10', '06/32', '2026-06-14']) {
      expect(() => parseMmdd(bad, '--from')).toThrowError(ImasError);
    }
  });
});
