import { getText } from './http';
import { HttpError, ImasError } from './errors';
import type { RawArticle } from './cms-api';

/**
 * Secondary acquisition + body source.
 *
 * The list API returns metadata only (its `content` field is a path, not the body).
 * Each article detail page server-pre-renders the FULL article (incl. inline HTML
 * body) into `<script id="__NEXT_DATA__">` props.pageProps.data — no auth, no
 * headless browser. `imas show <id>` always uses this. It is also the fallback body
 * source. Missing/unpublished ids return HTTP 500 -> NOT_FOUND.
 */
const PORTAL = 'https://idolmaster-official.jp';
const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

export async function fetchArticleDetail(id: string): Promise<RawArticle> {
  const url = `${PORTAL}/news/${encodeURIComponent(id)}`;
  let html: string;
  try {
    html = await getText(url);
  } catch (e) {
    if (e instanceof HttpError && (e.status === 404 || e.status === 500)) {
      throw new ImasError('NOT_FOUND', `Article ${id} not found (HTTP ${e.status})`);
    }
    throw new ImasError('API_DOWN', `Detail fetch failed for ${id}: ${(e as Error).message}`);
  }

  const match = NEXT_DATA_RE.exec(html);
  if (!match || !match[1]) {
    throw new ImasError('PARSE_FAILED', `__NEXT_DATA__ not found on ${url}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new ImasError('PARSE_FAILED', `__NEXT_DATA__ is not valid JSON on ${url}`);
  }

  const data = (parsed as { props?: { pageProps?: { data?: unknown } } })?.props?.pageProps
    ?.data as RawArticle | undefined;
  if (!data || typeof data !== 'object' || !data.title) {
    throw new ImasError('PARSE_FAILED', `Unexpected __NEXT_DATA__ shape on ${url}`);
  }
  return data;
}
