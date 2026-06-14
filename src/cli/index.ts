import { Command } from 'commander';
import pkg from '../../package.json';
import { listNews, listSchedule, getArticle, getEvent, search } from '../core/datasource';
import { resolveBrand, isCategory, BRANDS, KNOWN_BRANDS } from '../core/brands';
import { resolveIdolTag, idolsByBrand, searchIdols, idolsByBirthday, getIdol } from '../core/idols';
import { fetchIdolProfile } from '../core/idol-detail';
import type { Idol } from '../core/idols';
import { ImasError } from '../core/errors';
import { parsePositiveInt, parseIsoDate, parseMmdd } from '../core/validate';
import type { Article, ScheduleEvent } from '../core/schema';
import { renderArticles, renderSchedule, renderArticleDetail, renderEventDetail, renderIdol } from './render';

const VERSION = pkg.version;

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

/**
 * Run a command body with uniform error handling. The body throws `ImasError` on bad
 * input or upstream failure; we catch it once here and map it to the right exit code.
 * Returns the promise so commander's parseAsync awaits async bodies.
 */
function run(opts: { json?: boolean }, body: (json: boolean) => Promise<void> | void): Promise<void> {
  const json = Boolean(opts.json);
  return Promise.resolve()
    .then(() => body(json))
    .catch((e) => emitError(e, json));
}

/** Write a result as JSON (machine) or via a text renderer (human), with a trailing newline. */
function emit(json: boolean, jsonValue: unknown, text: () => string): void {
  process.stdout.write(`${json ? JSON.stringify(jsonValue) : text()}\n`);
}

/** Map user brand tokens to canonical codes; throws BAD_ARG on an unknown token. */
function resolveBrands(input: string[] | undefined): string[] | undefined {
  if (!input || !input.length) return undefined;
  return input.map((token) => {
    const code = resolveBrand(token);
    if (!code) {
      throw new ImasError('BAD_ARG', `unknown brand "${token}". valid: ${KNOWN_BRANDS.join(', ')}`);
    }
    return code;
  });
}

/** Map each --tag value through idol name/kana/slug resolution; pass non-idol tags raw. */
function resolveTags(input: string[] | undefined): string[] | undefined {
  if (!input || !input.length) return undefined;
  return input.map((t) => resolveIdolTag(t) ?? t.toLowerCase());
}

/** Resolve a query to exactly one idol, or throw a helpful BAD_ARG / NOT_FOUND. */
function resolveOneIdol(query: string): Idol {
  const code = resolveIdolTag(query);
  if (code) {
    const idol = getIdol(code);
    if (idol) return idol;
  }
  const hits = searchIdols(query);
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) {
    throw new ImasError('NOT_FOUND', `no idol matches "${query}". try \`imas idols ${query}\``);
  }
  throw new ImasError(
    'BAD_ARG',
    `"${query}" matches ${hits.length} idols: ${hits.slice(0, 8).map((i) => i.code).join(', ')}${hits.length > 8 ? ' …' : ''}. be more specific.`,
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
  .action((opts) =>
    run(opts, async (json) => {
      const category = String(opts.category).toUpperCase();
      if (!isCategory(category)) {
        throw new ImasError('BAD_ARG', `unknown category "${opts.category}". valid: NEWS, SCHEDULE, LIVE-EVENT`);
      }
      const res = await listNews({
        brands: resolveBrands(opts.brand),
        category,
        tags: resolveTags(opts.tag),
        subcategories: opts.subcategory,
        limit: parsePositiveInt(opts.limit),
      });
      warnStale(res.stale, res.staleSince);
      emit(json, { items: res.items, count: res.count, total: res.total, stale: res.stale }, () =>
        renderArticles(res.items as Article[]),
      );
    }),
  );

program
  .command('schedule')
  .description('list live / event schedule, newest first')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('--from <date>', 'only events on/after YYYY-MM-DD (JST)')
  .option('--to <date>', 'only events on/before YYYY-MM-DD (JST)')
  .option('-n, --limit <n>', 'max items to fetch before date filtering', '50')
  .option('--json', 'machine-readable JSON output')
  .action((opts) =>
    run(opts, async (json) => {
      const res = await listSchedule({
        brands: resolveBrands(opts.brand),
        from: parseIsoDate(opts.from, '--from'),
        to: parseIsoDate(opts.to, '--to'),
        limit: parsePositiveInt(opts.limit),
      });
      warnStale(res.stale, res.staleSince);
      emit(json, { items: res.items, count: res.count, total: res.total, stale: res.stale }, () =>
        renderSchedule(res.items as ScheduleEvent[]),
      );
    }),
  );

program
  .command('show')
  .argument('<id>', 'article id, e.g. 01_7869')
  .description('show one article with its full body')
  .option('--json', 'machine-readable JSON output')
  .action((id: string, opts) =>
    run(opts, async (json) => {
      const article = await getArticle(id);
      emit(json, article, () => renderArticleDetail(article));
    }),
  );

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
  .action((query: string, opts) =>
    run(opts, async (json) => {
      const category = String(opts.category).toUpperCase();
      if (!isCategory(category)) {
        throw new ImasError('BAD_ARG', `unknown category "${opts.category}". valid: NEWS, SCHEDULE, LIVE-EVENT`);
      }
      const limit = parsePositiveInt(opts.limit);
      const res = await search(query, {
        brands: resolveBrands(opts.brand),
        category,
        tags: resolveTags(opts.tag),
        subcategories: opts.subcategory,
        limit,
      });
      warnStale(res.stale, res.staleSince);
      if (json) {
        process.stdout.write(
          `${JSON.stringify({ query, items: res.items, count: res.count, total: res.total, searched: limit, stale: res.stale })}\n`,
        );
        return;
      }
      if (!res.items.length) {
        process.stderr.write(`no matches for "${query}" in the last ${limit} ${category} items (raise --limit to search deeper)\n`);
        process.exit(0);
      }
      const isSchedule = category === 'LIVE-EVENT' || category === 'SCHEDULE';
      const body = isSchedule
        ? renderSchedule(res.items as ScheduleEvent[])
        : renderArticles(res.items as Article[]);
      process.stdout.write(`${body}\n`);
    }),
  );

program
  .command('event')
  .argument('<id>', 'live-event id from `imas schedule`, e.g. 01_18484')
  .description('show one live/event with full detail and sub-events')
  .option('--json', 'machine-readable JSON output')
  .action((id: string, opts) =>
    run(opts, async (json) => {
      const event = await getEvent(id);
      emit(json, event, () => renderEventDetail(event));
    }),
  );

program
  .command('idols')
  .argument('[query]', 'optional name / kana / slug to search (e.g. 手毬, temari)')
  .description('browse the idol roster — find the slug to use with `--tag`')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('--json', 'machine-readable JSON output')
  .action((query: string | undefined, opts) =>
    run(opts, (json) => {
      const brands = resolveBrands(opts.brand);
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
    }),
  );

program
  .command('idol')
  .argument('<query>', 'idol name / kana / slug, e.g. 月村手毬 or temari_tsukimura')
  .description("show one idol's encyclopedia profile (--full scrapes CV, height, etc.)")
  .option('--full', 'fetch the full 名鑑 profile (CV, blood type, zodiac, height, hobby, …)')
  .option('--json', 'machine-readable JSON output')
  .action((query: string, opts) =>
    run(opts, async (json) => {
      const idol = resolveOneIdol(query);
      const profile = opts.full && idol.detailUrl ? await fetchIdolProfile(idol.detailUrl) : null;
      emit(json, { ...idol, profile }, () => renderIdol(idol, profile));
    }),
  );

program
  .command('birthdays')
  .description('list idols whose birthday falls in a MM/DD..MM/DD range (default: today, JST)')
  .option('-b, --brand <code...>', 'filter by brand code or alias')
  .option('--from <mmdd>', 'range start MM/DD (default: today, JST)')
  .option('--to <mmdd>', 'range end MM/DD (default: same as --from)')
  .option('--json', 'machine-readable JSON output')
  .action((opts) =>
    run(opts, (json) => {
      const from = parseMmdd(opts.from, '--from') ?? mmddTodayJst();
      const to = parseMmdd(opts.to, '--to') ?? from;
      const brands = resolveBrands(opts.brand);
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
    }),
  );

program
  .command('brands')
  .description('list known brand codes')
  .option('--json', 'machine-readable JSON output')
  .action((opts) =>
    run(opts, (json) => {
      emit(json, BRANDS, () => `known brand codes:\n${KNOWN_BRANDS.map((c) => `  ${c.padEnd(16)} ${BRANDS[c]}`).join('\n')}`);
    }),
  );

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
