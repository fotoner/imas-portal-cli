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
});
