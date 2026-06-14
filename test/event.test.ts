import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEvent } from '../src/core/datasource';
import { _resetTokenCache } from '../src/core/token';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

const CMS = 'https://cmsapi-frontend.idolmaster-official.jp';
let agent: MockAgent;

beforeEach(() => {
  _resetTokenCache();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => {
  await agent.close();
});

describe('getEvent (live-event detail by id)', () => {
  it('finds an event by id in the live-event list', async () => {
    const list = fixture('live-event-list.json');
    const id = list.data.article_list[0].path as string;

    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json'));
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, list);

    const event = await getEvent(id);
    expect(event.id).toBe(id);
    expect(event.category).toBe('LIVE-EVENT');
    expect(event.eventStart).toMatch(/\+09:00$/);
    expect(Array.isArray(event.children)).toBe(true);
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json'));
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, fixture('live-event-list.json'));

    await expect(getEvent('99_99999')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('widens the fetch window when the catalog has grown past the first page', async () => {
    const ev = (path: string) => ({ path, title: path, categories: { code: 'LIVE-EVENT' } });
    // First page (ceil=1) returns 1 of 2 known events; the target lives beyond the window.
    const page1 = { statusCode: 200, data: { article_list: [ev('01_A')], total_count: 2, count: 1 } };
    const page2 = {
      statusCode: 200,
      data: { article_list: [ev('01_A'), ev('01_B')], total_count: 2, count: 2 },
    };
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json')).times(2);
    pool.intercept({ path: (p) => p.includes('/Article/list') && p.includes('limit=1&') }).reply(200, page1);
    pool.intercept({ path: (p) => p.includes('/Article/list') && p.includes('limit=2&') }).reply(200, page2);

    const event = await getEvent('01_B', 1); // ceil=1 forces the widen path
    expect(event.id).toBe('01_B');
  });
});
