import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJst, stripHtml, normalizeArticle } from '../src/core/normalize';
import type { ScheduleEvent } from '../src/core/schema';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

describe('toJst', () => {
  it('converts unix seconds to JST ISO with an explicit +09:00', () => {
    // 2023-02-08 12:00 JST (startdate of /news/01_7869)
    expect(toJst(1675825200)).toBe('2023-02-08T12:00:00+09:00');
  });
  it('returns undefined for the far-future "no end" sentinel', () => {
    expect(toJst(32503561140)).toBeUndefined();
  });
  it('returns undefined for null / 0', () => {
    expect(toJst(null)).toBeUndefined();
    expect(toJst(0)).toBeUndefined();
  });
});

describe('stripHtml', () => {
  it('reduces markup to text', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });
});

describe('normalizeArticle', () => {
  it('normalizes a real news item', () => {
    const raw = fixture('news-list.json').data.article_list[0];
    const a = normalizeArticle(raw);
    expect(a.id).toMatch(/^01_/);
    expect(a.url).toContain('/news/01_');
    expect(a.category).toBe('NEWS');
    expect(a.brands.length).toBeGreaterThan(0);
    expect(a.publishedAt).toMatch(/\+09:00$/);
  });

  it('normalizes a live-event into a schedule event with event fields', () => {
    const raw = fixture('live-event-list.json').data.article_list[0];
    const e = normalizeArticle(raw) as ScheduleEvent;
    expect(e.category).toBe('LIVE-EVENT');
    expect(e.eventStart).toMatch(/\+09:00$/);
    expect(e.eventPlace).toBeTruthy();
    expect(Array.isArray(e.eventType)).toBe(true);
  });

  it('normalizes sub-events (children) of a multi-leg event', () => {
    const e = normalizeArticle({
      path: '01_tour',
      title: 'tour',
      categories: { code: 'LIVE-EVENT' },
      event_startdate: 1675825200,
      children: [
        { title: 'leg 1', event_dspdate: '2026/08/20', event_startdate: 1787000000, event_place: 'Fukui' },
        { title: 'leg 2', event_dspdate: '2026/09/05', event_place: 'Fukuoka' },
      ],
    }) as ScheduleEvent;
    expect(e.children).toHaveLength(2);
    expect(e.children[0]!.title).toBe('leg 1');
    expect(e.children[0]!.eventPlace).toBe('Fukui');
  });

  it('keeps an unknown brand code (tolerant ingest)', () => {
    const a = normalizeArticle({
      path: '01_test',
      title: 't',
      startdate: 1675825200,
      brand: [{ code: 'NEWBRAND2027', name: '???' }],
      categories: { code: 'NEWS' },
    });
    expect(a.brands).toContain('NEWBRAND2027');
  });
});
