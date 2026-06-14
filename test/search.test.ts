import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search } from '../src/core/datasource';
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

function mockList(name: string) {
  const pool = agent.get(CMS);
  pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json'));
  pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, fixture(name));
}

describe('search (client-side keyword filter)', () => {
  it('matches items by a keyword in the title', async () => {
    mockList('news-list.json'); // first item title contains ミリオン
    const res = await search('ミリオン', { category: 'NEWS', limit: 10 });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.count).toBe(res.items.length); // count = match count
    expect(res.items.every((i) => i.title.includes('ミリオン'))).toBe(true);
  });

  it('returns no items for a non-matching keyword (count 0, total = source available)', async () => {
    mockList('news-list.json');
    const res = await search('ZZZ_NO_SUCH_TERM_QQ', { category: 'NEWS', limit: 10 });
    expect(res.items).toEqual([]);
    expect(res.count).toBe(0); // no keyword matches
    expect(res.total).toBeGreaterThan(0); // but the source still reports a catalog total
  });

  it('is case-insensitive', async () => {
    mockList('news-list.json');
    const res = await search('idolm@ster', { category: 'NEWS', limit: 10 });
    // fixture titles contain "IDOLM@STER"
    expect(res.items.length).toBeGreaterThan(0);
  });
});
