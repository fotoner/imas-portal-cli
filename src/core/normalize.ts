import type { RawArticle } from './cms-api';
import type { Article, ScheduleEvent, SubEvent } from './schema';

const PORTAL = 'https://idolmaster-official.jp';
/** The CMS uses ~year-3000 timestamps as a "no end date" sentinel. */
const FAR_FUTURE = 32_503_000_000;
const SCHEDULE_CATEGORIES = new Set(['SCHEDULE', 'LIVE-EVENT']);

/** Unix seconds -> ISO-8601 in Asia/Tokyo with an explicit +09:00 offset. */
export function toJst(unix?: number | string | null): string | undefined {
  if (unix == null) return undefined;
  const n = typeof unix === 'string' ? Number(unix) : unix;
  if (!Number.isFinite(n) || n <= 0 || n >= FAR_FUTURE) return undefined;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(n * 1000));
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}+09:00`;
}

/** Best-effort HTML -> plain text for `imas show`. Not a sanitizer. */
export function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isInlineHtml(content?: string): boolean {
  return typeof content === 'string' && content.trim().startsWith('<');
}

function normalizeSubEvent(raw: RawArticle): SubEvent {
  return {
    title: raw.title,
    eventDisplayDate: raw.event_dspdate ?? null,
    eventStart: toJst(raw.event_startdate) ?? null,
    eventEnd: toJst(raw.event_enddate) ?? null,
    eventPlace: raw.event_place ? raw.event_place.replace(/\s*\n\s*/g, ' / ').trim() : null,
  };
}

/**
 * Raw CMS article (from list OR detail page) -> canonical Article / ScheduleEvent.
 * Tolerant ingest: brand/category codes pass through as plain strings (no enum), so
 * a brand the portal adds tomorrow never throws.
 */
export function normalizeArticle(raw: RawArticle): Article | ScheduleEvent {
  const id = String(raw.path ?? raw._id ?? '');
  const category = raw.categories?.code ?? 'NEWS';

  const base: Article = {
    id,
    title: raw.title ?? '(untitled)',
    url: id ? `${PORTAL}/news/${id}` : PORTAL,
    category,
    subcategories: (raw.categories?.subcategory ?? [])
      .filter((s) => s && s.code)
      .map((s) => ({ code: s.code as string, name: s.name })),
    brands: (raw.brand ?? [])
      .map((b) => b.code)
      .filter((c): c is string => typeof c === 'string' && c.length > 0),
    publishedAt: toJst(raw.startdate),
    updatedAt: toJst(raw.updated),
    displayDate: raw.dspdate,
    thumbnail: raw.thumbnail ?? null,
    hashtags: raw.hashtag
      ? raw.hashtag.split(/\s+/).map((h) => h.trim()).filter(Boolean)
      : [],
  };

  if (isInlineHtml(raw.content)) {
    base.bodyHtml = raw.content;
    base.bodyText = stripHtml(raw.content);
  }

  if (!SCHEDULE_CATEGORIES.has(category)) return base;

  const event: ScheduleEvent = {
    ...base,
    eventStart: toJst(raw.event_startdate) ?? null,
    eventEnd: toJst(raw.event_enddate) ?? null,
    eventPlace: raw.event_place ? raw.event_place.replace(/\s*\n\s*/g, ' / ').trim() : null,
    eventUrl: raw.event_url ?? null,
    eventDisplayDate: raw.event_dspdate ?? null,
    eventType: raw.event_type ?? [],
    eventArea: raw.event_area ?? [],
    children: (raw.children ?? []).map(normalizeSubEvent),
    allDay: false,
  };
  return event;
}
