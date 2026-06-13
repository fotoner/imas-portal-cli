import { fetchArticleList } from './cms-api';
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
  const cacheKey = { op: 'news', category, brands: q.brands ?? [], limit };
  return listWithStaleFallback(cacheKey, async () => {
    const { articles, total } = await fetchArticleList({ category, brands: q.brands, limit });
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
