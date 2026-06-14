import { getText } from './http';
import { HttpError, ImasError } from './errors';
import { stripControl } from './normalize';

/**
 * L2 of the idol encyclopedia (アイドル名鑑). Each idol's roster record links to a
 * static profile page (idollist.idolmaster-official.jp/search/detail/{id}) that
 * server-renders the full profile as <dl><dt>label</dt><dd>value</dd></dl> pairs,
 * plus CV in <p><span>CV</span>…</p>. No JS / auth needed — same static-scrape
 * approach as the news detail pages.
 */
export interface IdolProfile {
  cv: string | null;
  /** all <dt>→<dd> profile fields, label-keyed (年齢, 血液型, 星座, 身長, 体重, スリーサイズ, 出身地, 趣味, …) */
  fields: Record<string, string>;
}

const DL_RE = /<dl>\s*<dt>(.*?)<\/dt>\s*<dd>(.*?)<\/dd>\s*<\/dl>/gs;
const CV_RE = /<span>\s*CV\s*<\/span>\s*([^<]+)/i;

function stripTags(s: string): string {
  return stripControl(s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchIdolProfile(detailUrl: string): Promise<IdolProfile> {
  let html: string;
  try {
    html = await getText(detailUrl);
  } catch (e) {
    if (e instanceof HttpError && (e.status === 404 || e.status === 500)) {
      throw new ImasError('NOT_FOUND', `idol profile page not found (HTTP ${e.status})`);
    }
    throw new ImasError('API_DOWN', `idol profile fetch failed: ${(e as Error).message}`);
  }

  const fields: Record<string, string> = {};
  for (const m of html.matchAll(DL_RE)) {
    const label = stripTags(m[1] ?? '');
    const value = stripTags(m[2] ?? '');
    if (label && value) fields[label] = value;
  }
  if (!Object.keys(fields).length) {
    throw new ImasError('PARSE_FAILED', `no profile fields found on ${detailUrl} (page shape changed?)`);
  }

  const cvMatch = CV_RE.exec(html);
  const cv = cvMatch ? stripTags(cvMatch[1] ?? '').trim() || null : null;

  return { cv, fields };
}
