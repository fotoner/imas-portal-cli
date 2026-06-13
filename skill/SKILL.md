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
imas show <id> --json          # one article incl. full body text (id like 01_7869)
imas brands --json             # the known brand codes
```

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
- "그 기사 내용 알려줘" (user references an item) → `imas show <id> --json`, summarize `bodyText`.

## Notes for the agent

- Errors come back as `{"error":{"kind":"...","message":"..."}}` with a non-zero exit:
  `API_DOWN` (portal unreachable), `NOT_FOUND` (`show` with a bad id), `BAD_ARG`
  (unknown brand/category — run `imas brands` to list valid codes), `PARSE_FAILED`
  (the portal changed shape; report it, don't retry blindly).
- An empty list is success, not an error.
- `"stale": true` means the portal API was down and you got cached (older) data — say so.
- Always link back to `url`; don't reproduce full article bodies verbatim for redistribution.
- Dates are JST (+09:00).
