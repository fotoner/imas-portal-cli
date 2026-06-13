// Public programmatic surface (also what the future MCP server will wrap).
export * from './schema';
export * from './brands';
export * from './errors';
export { listNews, getArticle, listSchedule, getEvent, search } from './datasource';
export type { NewsQuery, ScheduleQuery, SearchQuery } from './datasource';
export { cacheDir } from './cache';
export { IDOLS, getIdol, resolveIdolTag, idolsByBrand, searchIdols, idolsByBirthday, birthdayKey } from './idols';
export type { Idol } from './idols';
export { fetchIdolProfile } from './idol-detail';
export type { IdolProfile } from './idol-detail';
