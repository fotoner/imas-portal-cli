# TODOS — imas-portal-cli

Deferred work captured during /office-hours + /plan-eng-review (2026-06-14). All four are
intentional v1 defers, not forgotten scope. Listed with enough context to pick up cold.

## Deferred (post-v1)

### 1. MCP server (`imas mcp` subcommand)
- **What:** A thin `@modelcontextprotocol/sdk` (pin 1.29.x; v2 stable ~2026-07-28) stdio server
  wrapping the shared core, exposing `search_news` / `get_schedule` tools with `structuredContent`.
- **Why:** Non-Claude-Code clients (Claude Desktop, other MCP hosts) can't shell out to the CLI.
- **Context:** Deferred by the user in office-hours — CC agents use the CLI via `skill/SKILL.md`,
  which is lighter. The core already returns canonical typed objects + one Zod schema, so the MCP
  layer reuses that schema as `outputSchema`. The `src/mcp/server.ts` seam stub exists from day 1.
- **Depends on:** stable core + Zod schemas. Trigger: a non-CC client actually needs it.

### 2. `.ics` calendar export (`imas schedule --ics`)
- **What:** Emit iCalendar from schedule data (VTIMEZONE Asia/Tokyo, all-day vs timed, DTEND-exclusive).
- **Why:** Subscribe to iM@S events in Google/Apple Calendar.
- **Context:** User cut this from v1 ("it's a CLI, focus on lookup"). Cheap to add later: schedule
  data already carries `eventStart/eventEnd`. Use the `ics` npm package; mind the +1-day exclusive
  DTEND rule for all-day events.
- **Depends on:** schedule normalization (already in v1).

### 3. ID-enumeration discovery fallback
- **What:** When the CMS list API is down AND the stale cache misses, discover articles by sequential
  `/news/01_{n}` enumeration.
- **Why:** Last-resort discovery if the undocumented API dies permanently (the documented kill-risk).
- **Context:** Deferred in eng review — brittle (can't tell deleted from unpublished, misses
  non-sequential ids, 500s = gaps, impolite request volume). Only build if the day-1 spike OR
  production shows the API + stale-cache combo is insufficient.
- **Depends on:** evidence the API is unreliable. Don't build speculatively.

### 4. On-disk token cache
- **What:** Persist the `Token/get` token (short TTL) across CLI invocations to skip the bootstrap call.
- **Why:** Saves one HTTP round-trip on rapid successive agent calls.
- **Context:** Eng review chose per-process Token/get for v1 (2 requests, < 2s — fine) to avoid a
  read/write race + TTL-staleness surface. Revisit only if latency becomes a real complaint.
- **Depends on:** measured latency problem. Note: the stale RESPONSE cache (Issue 1B) ships in v1;
  this is the separate TOKEN cache.

## Day-1 blocker (NOT a defer — do first)
Capture the real `Token/get` + `Article/list` requests via DevTools and replay with curl to confirm
the public token flow works server-side. If it fails, the data-source design pivots. See design doc.
