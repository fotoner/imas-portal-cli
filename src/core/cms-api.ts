import { getJson } from './http';
import { getToken } from './token';
import { ImasError } from './errors';

/**
 * Primary acquisition layer: the portal's undocumented CMS content API.
 * Reverse-engineered + corroborated by RSSHub's idolmaster/news route (MIT).
 *
 *   GET .../idolmaster/Article/list
 *       ?site=jp&ip=idolmaster&token=<fresh>&sort=new&limit=N
 *       &data={"category":["NEWS"|"SCHEDULE"|"LIVE-EVENT"],"brand":[...]}
 *
 * Returns { statusCode, data: { article_list, total_count, count } } on success,
 * or { statusCode: 404, data: false } when the token is stale (-> refresh + retry).
 */
const LIST_URL =
  'https://cmsapi-frontend.idolmaster-official.jp/sitern/api/idolmaster/Article/list';

export interface RawArticle {
  path?: string;
  _id?: string;
  title?: string;
  startdate?: number;
  enddate?: number;
  updated?: number;
  dspdate?: string;
  thumbnail?: string;
  content?: string;
  hashtag?: string;
  brand?: Array<{ code?: string; name?: string }>;
  categories?: {
    code?: string;
    name?: string;
    subcategory?: Array<{ code?: string; name?: string }>;
  };
  event_dspdate?: string;
  event_startdate?: number;
  event_enddate?: number;
  event_place?: string;
  event_url?: string;
  event_type?: string[];
  event_area?: string[];
  [key: string]: unknown;
}

interface ListResponse {
  statusCode?: number;
  data?:
    | { article_list?: RawArticle[]; total_count?: number; count?: number }
    | false
    | null;
}

export interface ListQuery {
  category: string;
  brands?: string[];
  limit?: number;
  sort?: string;
  /** extra keys merged into the `data` JSON (e.g. target_start_date) */
  extra?: Record<string, unknown>;
}

export interface RawListResult {
  articles: RawArticle[];
  total?: number;
}

function buildUrl(token: string, q: ListQuery): string {
  const data: Record<string, unknown> = { category: [q.category], ...(q.extra ?? {}) };
  if (q.brands && q.brands.length) data.brand = q.brands;
  const params = new URLSearchParams({
    site: 'jp',
    ip: 'idolmaster',
    token,
    sort: q.sort ?? 'new',
    limit: String(q.limit ?? 20),
    data: JSON.stringify(data),
  });
  return `${LIST_URL}?${params.toString()}`;
}

async function safeGet(url: string): Promise<ListResponse> {
  try {
    return await getJson<ListResponse>(url);
  } catch (e) {
    if (e instanceof ImasError) throw e;
    throw new ImasError('API_DOWN', `Article/list request failed: ${(e as Error).message}`);
  }
}

function isStale(res: ListResponse): boolean {
  return res.statusCode === 404 || res.data === false || res.data == null;
}

export async function fetchArticleList(q: ListQuery): Promise<RawListResult> {
  let token = await getToken();
  let res = await safeGet(buildUrl(token, q));

  if (isStale(res)) {
    token = await getToken(true); // refresh once
    res = await safeGet(buildUrl(token, q));
  }

  // A valid query that still has no data means "no matching articles" — empty, not an error.
  if (isStale(res)) return { articles: [], total: 0 };

  const list = (res.data as { article_list?: RawArticle[] }).article_list;
  if (!Array.isArray(list)) {
    throw new ImasError('PARSE_FAILED', 'Article/list: unexpected response shape (no article_list)');
  }
  return { articles: list, total: (res.data as { total_count?: number }).total_count };
}
