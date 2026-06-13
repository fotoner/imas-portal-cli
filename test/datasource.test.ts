import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listNews } from '../src/core/datasource';
import { _resetTokenCache } from '../src/core/token';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

const CMS = 'https://cmsapi-frontend.idolmaster-official.jp';

function freshAgent(): MockAgent {
  const a = new MockAgent();
  a.disableNetConnect();
  setGlobalDispatcher(a);
  return a;
}

let agent: MockAgent;
beforeEach(() => {
  _resetTokenCache();
  agent = freshAgent();
});
afterEach(async () => {
  await agent.close();
});

describe('listNews stale-cache fallback (Issue 1B)', () => {
  // a brand key unlikely to collide with other suites' on-disk cache entries
  const query = { category: 'NEWS', limit: 3, brands: ['SIDEM'] };

  it('returns fresh data and populates the cache, then serves it stale when the API is down', async () => {
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json'));
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, fixture('news-list.json'));

    const fresh = await listNews(query);
    expect(fresh.stale).toBe(false);
    expect(fresh.items.length).toBeGreaterThan(0);

    // now the API is unreachable -> API_DOWN -> stale cache
    await agent.close();
    _resetTokenCache();
    agent = freshAgent();
    agent
      .get(CMS)
      .intercept({ path: (p) => p.includes('/Token/get') })
      .replyWithError(new Error('network down'));

    const stale = await listNews(query);
    expect(stale.stale).toBe(true);
    expect(stale.items.length).toBeGreaterThan(0);
    expect(stale.staleSince).toBeTruthy();
  });
});
