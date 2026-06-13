// Public programmatic surface (also what the future MCP server will wrap).
export * from './schema';
export * from './brands';
export * from './errors';
export { listNews, getArticle, listSchedule, getEvent, search } from './datasource';
export type { NewsQuery, ScheduleQuery, SearchQuery } from './datasource';
export { cacheDir } from './cache';
