# imas-portal-cli

Query **THE iDOLM@STER** official portal ([idolmaster-official.jp](https://idolmaster-official.jp/))
news and live/event schedule from your terminal, or from an LLM agent.

It is a clean CLI with a `--json` mode and a bundled Claude Code skill. The primary
consumer is an agent (the skill tells it how to call the CLI); humans use the same
commands for quick lookups.

> Unofficial. Reads the portal's public content API + pages for personal/agent use.
> Be polite, link back to the source, and don't redistribute article bodies/images.

## Install

```bash
npm install -g imas-portal-cli
# or run without installing:
npx -y imas-portal-cli news --limit 5
```

Requires Node 20+.

## Usage

```bash
imas news [--brand <CODE>...] [--category NEWS|SCHEDULE|LIVE-EVENT] [--limit N] [--json]
imas schedule [--brand <CODE>...] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N] [--json]
imas search <keyword> [--brand <CODE>...] [--category NEWS|LIVE-EVENT] [--limit N] [--json]
imas idols [query] [--brand <CODE>...] [--json]   # browse the 341-idol roster (find tag slugs)
imas idol <name> [--full] [--json]                # one idol's profile (--full: CV, height, …)
imas birthdays [--from MM/DD] [--to MM/DD] [--brand <CODE>...] [--json]  # birthday range
imas show <id> [--json]        # one NEWS article + full body, e.g. imas show 01_7869
imas event <id> [--json]       # one LIVE/EVENT + sub-events, id from `imas schedule`
imas brands [--json]           # list known brand codes
```

`search` filters the most recent `--limit` items (default 100) by keyword over
title / hashtags / idol names. The portal API has no server-side full-text search,
so this is a recent-window search; raise `--limit` to go deeper.

For exact, full-history filtering use the server-side facets the portal's own search
uses: `--tag <slug>` (idol/topic, e.g. `mirai_kasuga`) and `--subcategory <CODE>`
(e.g. `GOODS`). Slugs are visible in each item's `tags` field (`--json`):

`--tag` also accepts an idol's name (kanji or kana), resolved to a slug via the bundled
341-idol roster (`imas idols` to browse it):

```bash
imas news --tag mirai_kasuga --json          # by slug
imas news --tag 月村手毬                       # by kanji name (resolved to temari_tsukimura)
imas news --subcategory GOODS --brand SIDEM  # all SideM goods news
imas idols --brand gakumas                   # list Gakumas idols + their slugs
imas idol 月村手毬 --full                      # full encyclopedia profile (CV, height, …)
imas birthdays --from 06/01 --to 06/30        # June birthdays, all brands
```

## Idol encyclopedia

The roster is the portal's own idol master (`cdn/jsons/idols/idol_list.json`), bundled
offline. `imas idol <name> --full` additionally scrapes the アイドル名鑑 profile page for CV,
blood type, zodiac, height, weight, measurements, hometown, and hobby. `imas birthdays`
uses the bundled birthday data (no network) and supports any MM/DD range, with year-end
wraparound and brand filtering.

`show` reads a news article's detail page; `event` reads a live/event entry (their
detail lives on a different route, so they are separate commands).

Default output is a compact table; `--json` emits structured data for machines/agents.

### Examples

```bash
imas news --limit 5
imas news --brand CINDERELLAGIRLS --json
imas search "ミリオン" --limit 200
imas schedule --brand SIDEM --from 2026-07-01 --to 2026-07-31
imas show 01_7869
```

Brand codes: `IDOLMASTER` (765), `CINDERELLAGIRLS`, `MILLIONLIVE`, `SIDEM`,
`SHINYCOLORS`, `GAKUEN`. Aliases like `cg`, `gakumas`, `765` work too.

## Agent / Claude Code skill

`skill/SKILL.md` documents the CLI for an agent. Point your agent at it (or copy it into
your skills dir) and it can answer things like "이번 달 데레마스 라이브 일정?" by shelling
out to `imas schedule --json --brand CINDERELLAGIRLS ...`.

## JSON shape

`news`/`schedule` → `{ "items": [...], "total": N, "stale": false }`.
Each item: `id, title, url, category, brands[], publishedAt` (ISO-8601 +09:00),
`displayDate, hashtags[]`. Schedule items add `eventStart, eventEnd, eventPlace,
eventUrl, eventDisplayDate, eventType[], eventArea[]`. `show` adds `bodyText`/`bodyHtml`.

Errors → `{ "error": { "kind": "API_DOWN|NOT_FOUND|BAD_ARG|PARSE_FAILED", "message": "..." } }`
with a non-zero exit. An empty list is success. `"stale": true` means the portal API was
unreachable and you got cached data.

## How it works

The portal is a Next.js SPA on S3/CloudFront with no public feed. News + schedule come
from an undocumented CMS content API reached via a short token bootstrap
(`Token/get` → `Article/list`). Article bodies are read from each detail page's embedded
`__NEXT_DATA__`. No headless browser, no auth. See the design doc for the full story.

## Develop

```bash
npm install
npm test          # vitest, offline (recorded fixtures via undici MockAgent)
npm run dev -- news --limit 3
npm run build     # tsup -> dist/imas.js
```

## License

MIT
