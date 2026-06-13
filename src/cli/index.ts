import { Command } from 'commander';
import { listNews, listSchedule, getArticle } from '../core/datasource';
import { resolveBrand, isCategory, BRANDS, KNOWN_BRANDS } from '../core/brands';
import { ImasError } from '../core/errors';
import type { Article, ScheduleEvent } from '../core/schema';
import { renderArticles, renderSchedule, renderArticleDetail } from './render';

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
      const res = await listNews({ brands, category, limit: Number(opts.limit) });
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
