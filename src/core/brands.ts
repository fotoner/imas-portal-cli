/**
 * Brand & category vocabulary.
 *
 * Design decision (eng review Issue 3): tolerant ingest + strict input.
 *  - INPUT (`--brand`) is validated against the known set below, so typos are caught.
 *  - INGEST (parsing API responses) does NOT validate — unknown brand codes from the
 *    portal pass straight through (see normalize.ts), so a newly added brand never
 *    crashes the tool.
 */
export const BRANDS: Record<string, string> = {
  IDOLMASTER: 'THE IDOLM@STER (765PRO)',
  CINDERELLAGIRLS: 'シンデレラガールズ',
  MILLIONLIVE: 'ミリオンライブ！',
  SIDEM: 'SideM',
  SHINYCOLORS: 'シャイニーカラーズ',
  GAKUEN: '学園アイドルマスター',
};

export const KNOWN_BRANDS: string[] = Object.keys(BRANDS);

/** Friendly aliases accepted on input and mapped to canonical codes. */
const ALIASES: Record<string, string> = {
  '765': 'IDOLMASTER',
  '765PRO': 'IDOLMASTER',
  IM: 'IDOLMASTER',
  HONKE: 'IDOLMASTER',
  CG: 'CINDERELLAGIRLS',
  CINDERELLA: 'CINDERELLAGIRLS',
  DEREMAS: 'CINDERELLAGIRLS',
  ML: 'MILLIONLIVE',
  MILLION: 'MILLIONLIVE',
  MIRIMAS: 'MILLIONLIVE',
  SM: 'SIDEM',
  SC: 'SHINYCOLORS',
  SHINY: 'SHINYCOLORS',
  SHANIMAS: 'SHINYCOLORS',
  GKMAS: 'GAKUEN',
  GAKUMAS: 'GAKUEN',
  HAKUMAS: 'GAKUEN',
};

/** Normalize a user-supplied brand token to a canonical code, or null if unknown. */
export function resolveBrand(input: string): string | null {
  const up = input.trim().toUpperCase();
  if (up in BRANDS) return up;
  if (up in ALIASES) return ALIASES[up] ?? null;
  return null;
}

export const CATEGORIES = ['NEWS', 'SCHEDULE', 'LIVE-EVENT'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s.toUpperCase());
}
