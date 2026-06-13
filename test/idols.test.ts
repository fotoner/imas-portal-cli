import { describe, it, expect } from 'vitest';
import { IDOLS, resolveIdolTag, idolsByBrand, searchIdols, getIdol } from '../src/core/idols';

describe('idol roster', () => {
  it('loads the full roster across brands', () => {
    expect(IDOLS.length).toBeGreaterThan(300);
    const brands = new Set(IDOLS.map((i) => i.brand));
    expect(brands.has('GAKUEN')).toBe(true);
    expect(brands.has('CINDERELLAGIRLS')).toBe(true);
  });
});

describe('resolveIdolTag', () => {
  it('passes an exact slug through', () => {
    expect(resolveIdolTag('temari_tsukimura')).toBe('temari_tsukimura');
  });
  it('resolves a kanji name (space-insensitive) to the slug', () => {
    expect(resolveIdolTag('月村手毬')).toBe('temari_tsukimura');
    expect(resolveIdolTag('月村 手毬')).toBe('temari_tsukimura');
  });
  it('resolves a kana reading to the slug', () => {
    const code = resolveIdolTag('つきむらてまり');
    expect(getIdol(code!)?.name).toContain('手毬');
  });
  it('returns null for an unknown name', () => {
    expect(resolveIdolTag('絶対に存在しないアイドル')).toBeNull();
  });
});

describe('idolsByBrand / searchIdols', () => {
  it('filters by brand', () => {
    const gk = idolsByBrand('GAKUEN');
    expect(gk.length).toBeGreaterThan(0);
    expect(gk.every((i) => i.brand === 'GAKUEN')).toBe(true);
  });
  it('searches by partial name', () => {
    const hits = searchIdols('手毬');
    expect(hits.some((i) => i.code === 'temari_tsukimura')).toBe(true);
  });
});
