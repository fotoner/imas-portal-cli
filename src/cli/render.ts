import type { Article, ScheduleEvent } from '../core/schema';

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
