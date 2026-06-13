import idolsData from './idols.json';

/**
 * Idol roster master, sourced from the portal's own
 * https://idolmaster-official.jp/cdn/jsons/idols/idol_list.json (341 idols).
 * `code` is the tag slug used by `--tag`; `name`/`kana` enable name lookup.
 */
export interface Idol {
  brand: string;
  code: string;
  name: string;
  kana: string | null;
  age: string | null;
  birthday: string | null; // "MM/DD"
  images: string[];
  detailUrl: string | null; // idol encyclopedia (名鑑) profile page
}

export const IDOLS: Idol[] = idolsData as Idol[];

/** strip spaces (incl. full-width / nakaguro) and lowercase for fuzzy matching */
function norm(s: string): string {
  return s.replace(/[\s　・]/g, '').toLowerCase();
}

const byCode = new Map<string, Idol>();
const byNorm = new Map<string, string>();
for (const idol of IDOLS) {
  byCode.set(idol.code, idol);
  byNorm.set(norm(idol.name), idol.code);
  if (idol.kana) byNorm.set(norm(idol.kana), idol.code);
}

export function getIdol(code: string): Idol | undefined {
  return byCode.get(code);
}

/**
 * Resolve a slug, kanji name, or kana reading to an idol_code (tag slug).
 * Returns null if not found or ambiguous (so the caller can fall back to the
 * raw input — not every `--tag` is an idol).
 */
export function resolveIdolTag(input: string): string | null {
  const raw = input.trim();
  if (byCode.has(raw)) return raw; // exact slug
  const n = norm(raw);
  const exact = byNorm.get(n);
  if (exact) return exact; // exact name / kana
  const low = raw.toLowerCase();
  const codeHits = IDOLS.filter((i) => i.code.includes(low));
  if (codeHits.length === 1) return codeHits[0]!.code;
  const nameHits = IDOLS.filter(
    (i) => norm(i.name).includes(n) || (i.kana ? norm(i.kana).includes(n) : false),
  );
  if (nameHits.length === 1) return nameHits[0]!.code;
  return null;
}

export function idolsByBrand(brand?: string): Idol[] {
  return brand ? IDOLS.filter((i) => i.brand === brand) : IDOLS;
}

export function searchIdols(query: string): Idol[] {
  const n = norm(query);
  const low = query.toLowerCase();
  return IDOLS.filter(
    (i) => i.code.includes(low) || norm(i.name).includes(n) || (i.kana ? norm(i.kana).includes(n) : false),
  );
}

/** "MM/DD" -> sortable month*100+day, or null. */
export function birthdayKey(birthday: string | null): number | null {
  if (!birthday) return null;
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(birthday.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return month * 100 + day;
}

/**
 * Idols whose birthday falls in [from, to] inclusive (each "MM/DD").
 * Supports a year-end wraparound range (e.g. from 12/25 to 01/05). Sorted by date.
 */
export function idolsByBirthday(from: string, to: string, brand?: string): Idol[] {
  const fromK = birthdayKey(from);
  const toK = birthdayKey(to);
  if (fromK == null || toK == null) return [];
  const inRange = (k: number): boolean =>
    fromK <= toK ? k >= fromK && k <= toK : k >= fromK || k <= toK;
  const wraps = fromK > toK;
  const sortKey = (i: Idol): number => {
    const k = birthdayKey(i.birthday)!;
    return wraps && k <= toK ? k + 1300 : k; // year-end wrap: early-year dates sort last
  };
  return IDOLS.filter((i) => {
    if (brand && i.brand !== brand) return false;
    const k = birthdayKey(i.birthday);
    return k != null && inRange(k);
  }).sort((a, b) => sortKey(a) - sortKey(b));
}
