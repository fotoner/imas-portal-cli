import { fetchArticleList } from './cms-api';
import type { RawArticle } from './cms-api';
import { fetchArticleDetail } from './detail-scrape';
import { normalizeArticle } from './normalize';
import { ImasError } from './errors';
import { writeCache, readCache } from './cache';
import type { Article, ScheduleEvent, ListResult } from './schema';

/**
 * Orchestration. Asymmetry to respect (eng review Issue 1):
 *   - listNews / listSchedule : CMS API only (discovery lives here). On API_DOWN we
 *     serve the stale on-disk cache, flagged `stale: true`.
 *   - getArticle              : detail-page scrape (the body only exists there).
 */
export interface NewsQuery {
  brands?: string[];
  category?: string;
  subcategories?: string[];
  tags?: string[];
  limit?: number;
}

export interface ScheduleQuery {
  brands?: string[];
  limit?: number;
  from?: string;
  to?: string;
}

interface ListPayload {
  items: (Article | ScheduleEvent)[];
  total?: number;
}

async function listWithStaleFallback(
  cacheKey: unknown,
  fetcher: () => Promise<ListPayload>,
): Promise<ListResult<Article | ScheduleEvent>> {
  try {
    const { items, total } = await fetcher();
    await writeCache(cacheKey, { items, total });
    return { items, total, stale: false };
  } catch (e) {
    if (e instanceof ImasError && e.kind === 'API_DOWN') {
      const cached = await readCache<ListPayload>(cacheKey);
      if (cached) {
        return {
          items: cached.value.items,
          total: cached.value.total,
          stale: true,
          staleSince: cached.savedAt,
        };
      }
    }
    throw e; // PARSE_FAILED / BAD_ARG / API_DOWN-without-cache propagate (loud)
  }
}

export async function listNews(q: NewsQuery = {}): Promise<ListResult<Article | ScheduleEvent>> {
  const category = (q.category ?? 'NEWS').toUpperCase();
  const limit = q.limit ?? 20;
  const cacheKey = {
    op: 'news',
    category,
    brands: q.brands ?? [],
    subcategory: q.subcategories ?? [],
    tag: q.tags ?? [],
    limit,
  };
  return listWithStaleFallback(cacheKey, async () => {
    const { articles, total } = await fetchArticleList({
      category,
      brands: q.brands,
      subcategory: q.subcategories,
      tag: q.tags,
      limit,
    });
    return { items: articles.map(normalizeArticle), total };
  });
}

export async function listSchedule(q: ScheduleQuery = {}): Promise<ListResult<ScheduleEvent>> {
  const limit = q.limit ?? 50;
  const cacheKey = { op: 'schedule', brands: q.brands ?? [], limit, from: q.from, to: q.to };
  const res = await listWithStaleFallback(cacheKey, async () => {
    const { articles, total } = await fetchArticleList({
      category: 'LIVE-EVENT',
      brands: q.brands,
      limit,
    });
    const items = filterByDate(articles.map(normalizeArticle) as ScheduleEvent[], q.from, q.to);
    return { items, total };
  });
  return res as ListResult<ScheduleEvent>;
}

export interface SearchQuery {
  brands?: string[];
  category?: string;
  subcategories?: string[];
  tags?: string[];
  limit?: number;
}

/**
 * Searchable text for a raw article: title + hashtags + idol names + subcategory,
 * plus venue / event display date for live-events (so venue search works).
 */
function haystack(a: RawArticle): string {
  const parts: string[] = [];
  if (a.title) parts.push(a.title);
  if (a.hashtag) parts.push(a.hashtag);
  if (Array.isArray(a.tags_name)) parts.push(a.tags_name.join(' '));
  if (Array.isArray(a.tags)) parts.push(a.tags.join(' '));
  const sub = (a.categories?.subcategory ?? []).map((s) => s.name).filter(Boolean).join(' ');
  if (sub) parts.push(sub);
  if (a.event_place) parts.push(a.event_place);
  if (a.event_dspdate) parts.push(a.event_dspdate);
  return parts.join(' ').toLowerCase();
}

/**
 * Keyword search. The CMS API has no server-side freeword search (unknown query
 * keys zero out results), so this fetches the most recent `limit` items in the
 * category and filters client-side over title / hashtags / idol names. It searches
 * a recent WINDOW, not the full ~11k-item history — raise `limit` to search deeper.
 */
export async function search(
  query: string,
  q: SearchQuery = {},
): Promise<ListResult<Article | ScheduleEvent>> {
  const category = (q.category ?? 'NEWS').toUpperCase();
  const limit = q.limit ?? 100;
  const needle = query.trim().toLowerCase();
  const cacheKey = {
    op: 'search',
    q: needle,
    category,
    brands: q.brands ?? [],
    subcategory: q.subcategories ?? [],
    tag: q.tags ?? [],
    limit,
  };
  return listWithStaleFallback(cacheKey, async () => {
    const { articles } = await fetchArticleList({
      category,
      brands: q.brands,
      subcategory: q.subcategories,
      tag: q.tags,
      limit,
    });
    const matched = articles.filter((a) => needle === '' || haystack(a).includes(needle));
    return { items: matched.map(normalizeArticle), total: matched.length };
  });
}

/** Client-side date filtering on normalized eventStart (robust; no guessing API params). */
function filterByDate(items: ScheduleEvent[], from?: string, to?: string): ScheduleEvent[] {
  if (!from && !to) return items;
  const fromT = from ? Date.parse(`${from}T00:00:00+09:00`) : Number.NEGATIVE_INFINITY;
  const toT = to ? Date.parse(`${to}T23:59:59+09:00`) : Number.POSITIVE_INFINITY;
  return items.filter((it) => {
    if (!it.eventStart) return false;
    const t = Date.parse(it.eventStart);
    return !Number.isNaN(t) && t >= fromT && t <= toT;
  });
}

export async function getArticle(id: string): Promise<Article | ScheduleEvent> {
  return normalizeArticle(await fetchArticleDetail(id));
}

/**
 * Single live/event detail by id. Live-event detail does NOT live at /news/{id}
 * (that's `getArticle`/`imas show`, news only). The whole LIVE-EVENT catalog is
 * small (~220 items) and the list item already carries full detail incl. children,
 * so we fetch the full list once (stale-cached) and find the id. Reliable, one call.
 */
export async function getEvent(id: string): Promise<ScheduleEvent> {
  const res = await listWithStaleFallback({ op: 'event-all' }, async () => {
    const { articles, total } = await fetchArticleList({ category: 'LIVE-EVENT', limit: 400 });
    return { items: articles.map(normalizeArticle), total };
  });
  const found = (res.items as ScheduleEvent[]).find((e) => e.id === id);
  if (!found) {
    throw new ImasError('NOT_FOUND', `live event "${id}" not found. Run \`imas schedule\` to see valid ids.`);
  }
  return found;
}
