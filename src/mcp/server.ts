/**
 * Deferred MCP server seam (see design doc + TODOS.md).
 *
 * v1 ships CLI + Claude Code skill only. When a non-Claude-Code MCP client needs
 * this, implement a thin @modelcontextprotocol/sdk stdio server here that wraps the
 * shared core in ../core and reuses the Zod schemas in ../core/schema as each tool's
 * `outputSchema` (the schema is the single source of truth — same shape as `--json`):
 *
 *   search_news({ brand?, category?, limit })  -> core.listNews
 *   get_schedule({ brand?, from?, to? })        -> core.listSchedule
 *   get_article({ id })                         -> core.getArticle
 *
 * Pin @modelcontextprotocol/sdk to the 1.29.x line (v2 stable ~2026-07-28).
 */
export function notImplemented(): never {
  throw new Error('MCP server not implemented yet (deferred). Use the CLI + skill.');
}
