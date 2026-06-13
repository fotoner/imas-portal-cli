import { describe, it, expect } from 'vitest';
import {
  IDOLS,
  resolveIdolTag,
  idolsByBrand,
  searchIdols,
  getIdol,
  idolsByBirthday,
  birthdayKey,
} from '../src/core/idols';

describe('idol roster', () => {
  it('loads the full roster across brands', () => {
    expect(IDOLS.length).toBeGreaterThan(300);
    const brands = new Set(IDOLS.map((i) => i.brand));
    expect(brands.has('GAKUEN')).toBe(true);
    expect(brands.has('CINDERELLAGIRLS')).toBe(true);
  });
  it('carries enriched fields (age / birthday / images / detailUrl)', () => {
    const t = getIdol('temari_tsukimura')!;
    expect(t.birthday).toBe('06/03');
    expect(t.age).toBe('15');
    expect(t.images.length).toBeGreaterThan(0);
    expect(t.detailUrl).toContain('idollist');
  });
});

describe('birthdays', () => {
  it('birthdayKey parses MM/DD to a sortable number', () => {
    expect(birthdayKey('06/03')).toBe(603);
    expect(birthdayKey('12/25')).toBe(1225);
    expect(birthdayKey(null)).toBeNull();
    expect(birthdayKey('99/99')).toBeNull();
  });
  it('finds idols whose birthday is in a range', () => {
    const list = idolsByBirthday('06/03', '06/03');
    expect(list.some((i) => i.code === 'temari_tsukimura')).toBe(true);
  });
  it('handles a year-end wraparound range', () => {
    const list = idolsByBirthday('12/30', '01/03');
    expect(list.every((i) => {
      const k = birthdayKey(i.birthday)!;
      return k >= 1230 || k <= 103;
    })).toBe(true);
  });
  it('filters birthdays by brand', () => {
    const list = idolsByBirthday('01/01', '12/31', 'GAKUEN');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.brand === 'GAKUEN')).toBe(true);
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
