import type { Article, ScheduleEvent } from '../core/schema';
import type { Idol } from '../core/idols';
import type { IdolProfile } from '../core/idol-detail';

/** Truncate to a display width, counting CJK/full-width chars as 2 columns. */
function truncate(s: string, max: number): string {
  let width = 0;
  let out = '';
  for (const ch of s) {
    const w = ch.codePointAt(0)! > 0x1100 ? 2 : 1;
    if (width + w > max) return `${out}…`;
    width += w;
    out += ch;
  }
  return out;
}

function dateOnly(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : '——————————';
}

export function renderArticles(items: Article[]): string {
  if (!items.length) return '(no results)';
  const cols = process.stdout.columns ?? 100;
  const titleWidth = Math.max(24, cols - 42);
  return items
    .map((a) => {
      const brand = (a.brands[0] ?? '—').slice(0, 15).padEnd(15);
      return `${dateOnly(a.publishedAt)}  ${brand}  ${truncate(a.title, titleWidth)}`;
    })
    .join('\n');
}

export function renderSchedule(items: ScheduleEvent[]): string {
  if (!items.length) return '(no results)';
  return items
    .map((e) => {
      const when = (e.eventDisplayDate ?? dateOnly(e.eventStart)).replace(/\s+/g, ' ');
      const brand = (e.brands[0] ?? '—').slice(0, 14).padEnd(14);
      const place = e.eventPlace ? `  @ ${e.eventPlace.split(' / ')[0]}` : '';
      return `${when}  ${brand}  ${truncate(e.title, 48)}${place}`;
    })
    .join('\n');
}

export function renderEventDetail(e: ScheduleEvent): string {
  const when =
    e.eventDisplayDate ??
    (e.eventStart ? `${e.eventStart}${e.eventEnd ? ` ~ ${e.eventEnd}` : ''}` : '—');
  const lines = [
    e.title,
    `  ${e.eventUrl ?? e.url}`,
    `  when:   ${when.replace(/\n+/g, ' ')}`,
    `  place:  ${e.eventPlace ?? '—'}`,
    `  brands: ${e.brands.join(', ') || '—'}`,
  ];
  const tags = [...e.eventType, ...e.eventArea];
  if (tags.length) lines.push(`  type:   ${tags.join(', ')}`);
  if (e.children.length) {
    lines.push('', '  sub-events:');
    for (const c of e.children) {
      const w = c.eventDisplayDate ?? c.eventStart ?? '';
      const p = c.eventPlace ? ` @ ${c.eventPlace}` : '';
      lines.push(`   - ${c.title ?? ''}  ${w}${p}`.replace(/\n+/g, ' '));
    }
  }
  return lines.join('\n');
}

export function renderIdol(i: Idol, profile: IdolProfile | null): string {
  const lines = [`${i.name}${i.kana ? `  (${i.kana})` : ''}   [${i.brand}]  ·  ${i.code}`];
  const basics: string[] = [];
  if (i.age) basics.push(`age ${i.age}`);
  if (i.birthday) basics.push(`birthday ${i.birthday}`);
  if (basics.length) lines.push(`  ${basics.join('   ·   ')}`);
  if (profile) {
    if (profile.cv) lines.push(`  CV: ${profile.cv}`);
    for (const [k, v] of Object.entries(profile.fields)) {
      if (k === '年齢' || k === '誕生日') continue; // already shown from the roster
      lines.push(`  ${k}: ${v}`);
    }
  }
  if (i.detailUrl) lines.push(`  ${i.detailUrl}`);
  if (i.images[0]) lines.push(`  image: ${i.images[0]}`);
  return lines.join('\n');
}

export function renderArticleDetail(a: Article): string {
  const lines = [
    a.title,
    `  ${a.url}`,
    `  date: ${a.publishedAt ?? '—'}   brands: ${a.brands.join(', ') || '—'}   category: ${a.category}`,
  ];
  if (a.hashtags.length) lines.push(`  tags: ${a.hashtags.join(' ')}`);
  if (a.bodyText) lines.push('', a.bodyText);
  return lines.join('\n');
}
