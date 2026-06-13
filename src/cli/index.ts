import { Command } from 'commander';
import { listNews, listSchedule, getArticle, getEvent, search } from '../core/datasource';
import { resolveBrand, isCategory, BRANDS, KNOWN_BRANDS } from '../core/brands';
import { resolveIdolTag, idolsByBrand, searchIdols, idolsByBirthday, getIdol } from '../core/idols';
import { fetchIdolProfile } from '../core/idol-detail';
import type { Idol } from '../core/idols';
import { ImasError } from '../core/errors';
import type { Article, ScheduleEvent } from '../core/schema';
import { renderArticles, renderSchedule, renderArticleDetail, renderEventDetail, renderIdol } from './render';

const VERSION = '0.1.0';

function emitError(err: unknown, json: boolean): never {
  const kind = err instanceof ImasError ? err.kind : 'API_DOWN';
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    process.stdout.write(`${JSON.stringify({ error: { kind, message } })}\n`);
  } else {
    process.stderr.write(`error [${kind}]: ${message}\n`);
  }
  process.exit(kind === 'BAD_ARG' ? 2 : 1);
}

function resolveBrands(input: string[] | undefined, json: boolean): string[] | undefined {
  if (!input || !input.length) return undefined;
  const out: string[] = [];
  for (const token of input) {
    const code = resolveBrand(token);
    if (!code) {
      emitError(
        new ImasError('BAD_ARG', `unknown brand "${token}". valid: ${KNOWN_BRANDS.join(', ')}`),
        json,
      );
    }
    out.push(code);
  }
  return out;
}

/** Map each --tag value through idol name/kana/slug resolution; pass non-idol tags raw. */
function resolveTags(input: string[] | undefined): string[] | undefined {
  if (!input || !input.length) return undefined;
  return input.map((t) => resolveIdolTag(t) ?? t.toLowerCase());
}

/** Resolve a query to exactly one idol, or emit a helpful error. */
function resolveOneIdol(query: string, json: boolean): Idol {
  const code = resolveIdolTag(query);
  if (code) {
    const idol = getIdol(code);
    if (idol) return idol;
  }
  const hits = searchIdols(query);
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) {
    emitError(new ImasError('NOT_FOUND', `no idol matches "${query}". try \`imas idols ${query}\``), json);
  }
  emitError(
    new ImasError(
      'BAD_ARG',
      `"${query}" matches ${hits.length} idols: ${hits.slice(0, 8).map((i) => i.code).join(', ')}${hits.length > 8 ? ' …' : ''}. be more specific.`,
    ),
    json,
  );
}

/** today's date as MM/DD in JST (idols are Japanese). */
function mmddTodayJst(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const mo = parts.find((p) => p.type === 'month')?.value ?? '01';
  const da = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${mo}/${da}`;
}

function normalizeMmdd(s: string | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  return `${m[1]!.padStart(2, '0')}/${m[2]!.padStart(2, '0')}`;
}

function warnStale(stale: boolean, since?: string): void {
  if (stale) {
    process.stderr.write(
      `⚠ stale data${since ? ` (cached ${since})` : ''}: the portal API was unreachable\n`,
    );
  }
}

const program = new Command();
program
  .name('imas')
  .description('Query THE iDOLM@STER official portal news & schedule (human + agent friendly).')
  .version(VERSION);

program
  .command('news')
  .description('list portal news, newest first')
  .option('-b, --brand <code...>', 'filter by brand code or alias (see `imas brands`)')
  .option('-c, --category <code>', 'NEWS | SCHEDULE | LIVE-EVENT', 'NEWS')
  .option('-t, --tag <slug...>', 'filter by idol/topic tag slug, server-side (e.g. mirai_kasuga)')
  .option('-s, --subcategory <code...>', 'filter by subcategory, server-side (e.g. GOODS)')
  .option('-n, --limit <n>', 'max items', '20')
  .option('--json', 'machine-readable JSON output')
  .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
      const category = String(opts.category).toUpperCase();
      if (!isCategory(category)) {
        emitError(
          new ImasError('BAD_ARG', `unknown category "${opts.category}". valid: NEWS, SCHEDULE, LIVE-EVENT`),
          json,
        );
      }
      const brands = resolveBrands(opts.brand, json);
      const res = await listNews({
        brands,
        category,
        tags: resolveTags(opts.tag),
        subcategories: opts.subcategory,
        limit: Number(opts.limit),
      });
      warnStale(res.stale, res.staleSince);
      if (json) {
        process.stdout.write(`${JSON.stringify({ items: res.items, total: res.total, stale: res.stale })}\n`);
      } else {
        process.stdout.write(`${renderArticles(res.items as Article[])}\n`);
      }
    } catch (e) {
      emitError(e, json);
    }
  });

program
  .command('schedule')
  .description('list live / event schedule, newest first')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('--from <date>', 'only events on/after YYYY-MM-DD (JST)')
  .option('--to <date>', 'only events on/before YYYY-MM-DD (JST)')
  .option('-n, --limit <n>', 'max items to fetch before date filtering', '50')
  .option('--json', 'machine-readable JSON output')
  .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
      const brands = resolveBrands(opts.brand, json);
      const res = await listSchedule({
        brands,
        from: opts.from,
        to: opts.to,
        limit: Number(opts.limit),
      });
      warnStale(res.stale, res.staleSince);
      if (json) {
        process.stdout.write(`${JSON.stringify({ items: res.items, total: res.total, stale: res.stale })}\n`);
      } else {
        process.stdout.write(`${renderSchedule(res.items as ScheduleEvent[])}\n`);
      }
    } catch (e) {
      emitError(e, json);
    }
  });

program
  .command('show')
  .argument('<id>', 'article id, e.g. 01_7869')
  .description('show one article with its full body')
  .option('--json', 'machine-readable JSON output')
  .action(async (id: string, opts) => {
    const json = Boolean(opts.json);
    try {
      const article = await getArticle(id);
      if (json) process.stdout.write(`${JSON.stringify(article)}\n`);
      else process.stdout.write(`${renderArticleDetail(article)}\n`);
    } catch (e) {
      emitError(e, json);
    }
  });

program
  .command('search')
  .argument('<query>', 'keyword: title / hashtag / idol name')
  .description('keyword search over recent news or schedule (within the fetched window)')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('-c, --category <code>', 'NEWS | SCHEDULE | LIVE-EVENT', 'NEWS')
  .option('-t, --tag <slug...>', 'narrow to an idol/topic tag slug, server-side')
  .option('-s, --subcategory <code...>', 'narrow to a subcategory, server-side')
  .option('-n, --limit <n>', 'how many recent items to search through', '100')
  .option('--json', 'machine-readable JSON output')
  .action(async (query: string, opts) => {
    const json = Boolean(opts.json);
    try {
      const category = String(opts.category).toUpperCase();
      if (!isCategory(category)) {
        emitError(
          new ImasError('BAD_ARG', `unknown category "${opts.category}". valid: NEWS, SCHEDULE, LIVE-EVENT`),
          json,
        );
      }
      const brands = resolveBrands(opts.brand, json);
      const limit = Number(opts.limit);
      const res = await search(query, {
        brands,
        category,
        tags: resolveTags(opts.tag),
        subcategories: opts.subcategory,
        limit,
      });
      warnStale(res.stale, res.staleSince);
      if (json) {
        process.stdout.write(
          `${JSON.stringify({ query, items: res.items, matches: res.total, searched: limit, stale: res.stale })}\n`,
        );
      } else if (!res.items.length) {
        process.stderr.write(`no matches for "${query}" in the last ${limit} ${category} items (raise --limit to search deeper)\n`);
        process.exit(0);
      } else {
        const isSchedule = category === 'LIVE-EVENT' || category === 'SCHEDULE';
        const body = isSchedule
          ? renderSchedule(res.items as ScheduleEvent[])
          : renderArticles(res.items as Article[]);
        process.stdout.write(`${body}\n`);
      }
    } catch (e) {
      emitError(e, json);
    }
  });

program
  .command('event')
  .argument('<id>', 'live-event id from `imas schedule`, e.g. 01_18484')
  .description('show one live/event with full detail and sub-events')
  .option('--json', 'machine-readable JSON output')
  .action(async (id: string, opts) => {
    const json = Boolean(opts.json);
    try {
      const event = await getEvent(id);
      if (json) process.stdout.write(`${JSON.stringify(event)}\n`);
      else process.stdout.write(`${renderEventDetail(event)}\n`);
    } catch (e) {
      emitError(e, json);
    }
  });

program
  .command('idols')
  .argument('[query]', 'optional name / kana / slug to search (e.g. 手毬, temari)')
  .description('browse the idol roster — find the slug to use with `--tag`')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('--json', 'machine-readable JSON output')
  .action((query: string | undefined, opts) => {
    const json = Boolean(opts.json);
    const brands = resolveBrands(opts.brand, json);
    let list = brands ? idolsByBrand().filter((i) => brands.includes(i.brand)) : idolsByBrand();
    if (query) {
      const hits = new Set(searchIdols(query).map((i) => i.code));
      list = list.filter((i) => hits.has(i.code));
    }
    if (json) {
      process.stdout.write(`${JSON.stringify(list)}\n`);
      return;
    }
    if (!query && !brands) {
      // overview: per-brand counts
      const counts = new Map<string, number>();
      for (const i of list) counts.set(i.brand, (counts.get(i.brand) ?? 0) + 1);
      const lines = [...counts.entries()].map(([b, n]) => `  ${b.padEnd(16)} ${n}`);
      process.stdout.write(
        `${list.length} idols. Filter with --brand or a name/slug query, e.g. \`imas idols --brand gakumas\`:\n${lines.join('\n')}\n`,
      );
      return;
    }
    if (!list.length) {
      process.stderr.write(`no idol matches${query ? ` for "${query}"` : ''}\n`);
      process.exit(0);
    }
    const body = list
      .map((i) => `  ${i.code.padEnd(22)} ${i.name}${i.kana ? `  (${i.kana})` : ''}  [${i.brand}]`)
      .join('\n');
    process.stdout.write(`${body}\n`);
  });

program
  .command('idol')
  .argument('<query>', 'idol name / kana / slug, e.g. 月村手毬 or temari_tsukimura')
  .description("show one idol's encyclopedia profile (--full scrapes CV, height, etc.)")
  .option('--full', 'fetch the full 名鑑 profile (CV, blood type, zodiac, height, hobby, …)')
  .option('--json', 'machine-readable JSON output')
  .action(async (query: string, opts) => {
    const json = Boolean(opts.json);
    try {
      const idol = resolveOneIdol(query, json);
      const profile = opts.full && idol.detailUrl ? await fetchIdolProfile(idol.detailUrl) : null;
      if (json) {
        process.stdout.write(`${JSON.stringify({ ...idol, profile })}\n`);
      } else {
        process.stdout.write(`${renderIdol(idol, profile)}\n`);
      }
    } catch (e) {
      emitError(e, json);
    }
  });

program
  .command('birthdays')
  .description('list idols whose birthday falls in a MM/DD..MM/DD range (default: today, JST)')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('--from <mmdd>', 'range start MM/DD (default: today, JST)')
  .option('--to <mmdd>', 'range end MM/DD (default: same as --from)')
  .option('--json', 'machine-readable JSON output')
  .action((opts) => {
    const json = Boolean(opts.json);
    const from = normalizeMmdd(opts.from) ?? mmddTodayJst();
    const to = normalizeMmdd(opts.to) ?? from;
    const brands = resolveBrands(opts.brand, json);
    let list = idolsByBirthday(from, to);
    if (brands) list = list.filter((i) => brands.includes(i.brand));
    if (json) {
      process.stdout.write(`${JSON.stringify({ from, to, count: list.length, items: list })}\n`);
      return;
    }
    if (!list.length) {
      process.stderr.write(`no idol birthdays in ${from}..${to}\n`);
      process.exit(0);
    }
    const body = list
      .map((i) => `  ${i.birthday}  ${i.name}${i.kana ? `  (${i.kana})` : ''}  [${i.brand}]`)
      .join('\n');
    process.stdout.write(`birthdays ${from}..${to}  (${list.length})\n${body}\n`);
  });

program
  .command('brands')
  .description('list known brand codes')
  .option('--json', 'machine-readable JSON output')
  .action((opts) => {
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(BRANDS)}\n`);
    } else {
      const body = KNOWN_BRANDS.map((c) => `  ${c.padEnd(16)} ${BRANDS[c]}`).join('\n');
      process.stdout.write(`known brand codes:\n${body}\n`);
    }
  });

program
  .command('mcp')
  .description('(deferred) start an MCP stdio server — not yet implemented')
  .action(() => {
    process.stderr.write(
      'MCP server is deferred (see TODOS.md). Use the CLI directly or the skill at skill/SKILL.md.\n',
    );
    process.exit(70);
  });

program.parseAsync(process.argv).catch((e) => emitError(e, process.argv.includes('--json')));
