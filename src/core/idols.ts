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
