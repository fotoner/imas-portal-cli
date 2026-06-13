import { describe, it, expect } from 'vitest';
import { resolveBrand, isCategory, KNOWN_BRANDS } from '../src/core/brands';

describe('resolveBrand (strict input validation)', () => {
  it('resolves canonical codes case-insensitively', () => {
    expect(resolveBrand('cinderellagirls')).toBe('CINDERELLAGIRLS');
    expect(resolveBrand('GAKUEN')).toBe('GAKUEN');
  });
  it('resolves friendly aliases', () => {
    expect(resolveBrand('cg')).toBe('CINDERELLAGIRLS');
    expect(resolveBrand('gakumas')).toBe('GAKUEN');
    expect(resolveBrand('765')).toBe('IDOLMASTER');
  });
  it('returns null for an unknown brand', () => {
    expect(resolveBrand('totally-not-a-brand')).toBeNull();
  });
});

describe('brand set', () => {
  it('has the six portal brands incl. GAKUEN', () => {
    expect(KNOWN_BRANDS).toContain('GAKUEN');
    expect(KNOWN_BRANDS).toHaveLength(6);
  });
});

describe('isCategory', () => {
  it('accepts the three queryable categories case-insensitively', () => {
    expect(isCategory('news')).toBe(true);
    expect(isCategory('LIVE-EVENT')).toBe(true);
    expect(isCategory('schedule')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isCategory('bogus')).toBe(false);
  });
});
