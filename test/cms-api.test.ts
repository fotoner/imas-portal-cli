import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchArticleList } from '../src/core/cms-api';
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

describe('fetchArticleList', () => {
  it('bootstraps a token and returns the article_list', async () => {
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json'));
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, fixture('news-list.json'));

    const res = await fetchArticleList({ category: 'NEWS', limit: 3 });
    expect(res.articles.length).toBeGreaterThan(0);
    expect(res.articles[0]!.title).toBeTruthy();
    expect(res.total).toBeGreaterThan(0);
  });

  it('refreshes the token when the API answers statusCode 404 / data:false', async () => {
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json')).times(2);
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, { statusCode: 404, data: false });
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, fixture('news-list.json'));

    const res = await fetchArticleList({ category: 'NEWS', limit: 3 });
    expect(res.articles.length).toBeGreaterThan(0);
  });

  it('treats persistent data:false (after refresh) as an empty result, not an error', async () => {
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json')).times(2);
    pool.intercept({ path: (p) => p.includes('/Article/list') }).reply(200, { statusCode: 404, data: false }).times(2);

    const res = await fetchArticleList({ category: 'NEWS', brands: ['CINDERELLAGIRLS'], limit: 3 });
    expect(res.articles).toEqual([]);
  });
});
