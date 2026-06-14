import { z } from 'zod';

/**
 * Canonical, typed result objects — the single source of truth.
 * CLI `--json` output == these types == (future) MCP `outputSchema`.
 *
 *   category   = single code (NEWS | SCHEDULE | LIVE-EVENT | ...)  [tolerant: plain string]
 *   brands     = array of brand codes                              [tolerant: plain strings]
 *   *At fields = ISO-8601 with an explicit +09:00 (Asia/Tokyo, fixed, no DST)
 */
export const SubcategorySchema = z.object({
  code: z.string(),
  name: z.string().optional(),
});

export const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  category: z.string(),
  subcategories: z.array(SubcategorySchema).default([]),
  brands: z.array(z.string()).default([]),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  displayDate: z.string().optional(),
  thumbnail: z.string().nullable().optional(),
  hashtags: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]), // idol/topic slugs (use with `--tag`)
  tagNames: z.array(z.string()).default([]), // human-readable tag names
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

/** A sub-event inside a multi-leg live/event (e.g. a tour's individual shows). */
export const SubEventSchema = z.object({
  title: z.string().optional(),
  eventDisplayDate: z.string().nullable().optional(),
  eventStart: z.string().nullable().optional(),
  eventEnd: z.string().nullable().optional(),
  eventPlace: z.string().nullable().optional(),
});
export type SubEvent = z.infer<typeof SubEventSchema>;

export const ScheduleEventSchema = ArticleSchema.extend({
  eventStart: z.string().nullable().optional(),
  eventEnd: z.string().nullable().optional(),
  eventPlace: z.string().nullable().optional(),
  eventUrl: z.string().nullable().optional(),
  eventDisplayDate: z.string().nullable().optional(),
  eventType: z.array(z.string()).default([]),
  eventArea: z.array(z.string()).default([]),
  children: z.array(SubEventSchema).default([]),
});
export type ScheduleEvent = z.infer<typeof ScheduleEventSchema>;

export interface ListResult<T> {
  items: T[];
  /** Number of items actually returned, after all client-side filtering. Always === items.length. */
  count: number;
  /**
   * Total available at the SOURCE for the server-side query (the CMS API's total_count),
   * if the API reports one. NOT reduced by the client-side limit, date range, or keyword
   * filter — so for schedule/search it can be larger than `count`. Undefined when unknown.
   */
  total?: number;
  stale: boolean;
  staleSince?: string;
}
