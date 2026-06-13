---
name: imas-portal
description: >-
  Look up THE iDOLM@STER (アイマス) official portal news and live/event schedule.
  Use when the user asks about iM@S news, upcoming lives/events, release dates, or
  brand-specific updates (765 / Cinderella Girls / Million Live / SideM / Shiny
  Colors / Gakuen). Wraps the `imas` CLI; always read with `--json`.
---

# iM@S Portal lookup

You have a CLI, `imas`, that queries the official portal (idolmaster-official.jp).
ALWAYS pass `--json` so you get structured data. Parse it; don't show raw JSON to the user.

If `imas` is not installed, run it with npx: `npx -y imas-portal-cli <args>`.

## Commands

```bash
imas news --json [--brand <CODE>...] [--limit N] [--category NEWS|SCHEDULE|LIVE-EVENT]
imas schedule --json [--brand <CODE>...] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]
imas search <keyword> --json [--brand <CODE>...] [--category NEWS|LIVE-EVENT] [--limit N]
imas idols [query] --json [--brand <CODE>...]   # roster: find an idol's tag slug
imas show <id> --json          # one NEWS article incl. full body text (id like 01_7869)
imas event <id> --json         # one LIVE/EVENT incl. sub-events (id from `imas schedule`)
imas brands --json             # the known brand codes
```

`show` is for news articles; `event` is for live/event schedule items (their detail
lives on a different route). If `show` returns NOT_FOUND for a schedule id, use `event`.

Brand codes: `IDOLMASTER` (765), `CINDERELLAGIRLS`, `MILLIONLIVE`, `SIDEM`,
`SHINYCOLORS`, `GAKUEN`. Aliases like `cg`, `gakumas`, `765` also work.

## Output shape

`news` / `schedule` print `{"items":[...],"total":N,"stale":false}`.
Each item: `id, title, url, category, brands[], publishedAt (ISO +09:00), displayDate, hashtags[]`.
Schedule items also have: `eventStart, eventEnd, eventPlace, eventUrl, eventDisplayDate, eventType[], eventArea[]`.
`show` adds `bodyText` (and `bodyHtml`).

## Examples

- "이번 달 데레마스 라이브 일정?" →
  `imas schedule --json --brand CINDERELLAGIRLS --from 2026-06-01 --to 2026-06-30`
  then summarize each event's `title`, `eventDisplayDate`, `eventPlace`, `eventUrl`.
- "아이마스 최신 뉴스 5개" → `imas news --json --limit 5`, list `title` + `publishedAt` + `url`.
- "OOO 관련 뉴스 찾아줘" → `imas search "OOO" --json [--limit 200]`. Searches title /
  hashtags / idol names over the most recent `--limit` items (a window, not all history;
  raise `--limit` to search deeper). `matches` in the output is the hit count.
- "특정 아이돌 뉴스 전부" → use the server-side tag facet (searches ALL history, exact):
  `imas news --tag <idol> --json`. `--tag` accepts the slug (`mirai_kasuga`), the kanji
  name (`春日未来`), or kana (`かすがみらい`) — names are resolved to slugs from the bundled
  341-idol roster. `--subcategory <CODE>` (GOODS, LIVE-EVENT, ...) works the same way.
  Use `imas idols <name>` to look up an idol's exact slug/brand if a name is ambiguous.
- "그 기사 내용 알려줘" (user references a news item) → `imas show <id> --json`, summarize `bodyText`.
- "그 라이브 상세 알려줘" (user references a schedule item) → `imas event <id> --json`,
  summarize `eventDisplayDate`, `eventPlace`, `eventUrl`, and any `children` (sub-events).

## Notes for the agent

- Errors come back as `{"error":{"kind":"...","message":"..."}}` with a non-zero exit:
  `API_DOWN` (portal unreachable), `NOT_FOUND` (`show` with a bad id), `BAD_ARG`
  (unknown brand/category — run `imas brands` to list valid codes), `PARSE_FAILED`
  (the portal changed shape; report it, don't retry blindly).
- An empty list is success, not an error.
- `"stale": true` means the portal API was down and you got cached (older) data — say so.
- Always link back to `url`; don't reproduce full article bodies verbatim for redistribution.
- Dates are JST (+09:00).
