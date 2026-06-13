import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listNews } from '../src/core/datasource';
import { normalizeArticle } from '../src/core/normalize';
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

describe('server-side facet passthrough', () => {
  it('sends --tag and --subcategory in the data param', async () => {
    let listPath = '';
    const pool = agent.get(CMS);
    pool.intercept({ path: (p) => p.includes('/Token/get') }).reply(200, fixture('token.json'));
    pool
      .intercept({
        path: (p) => {
          if (p.includes('/Article/list')) listPath = p;
          return p.includes('/Article/list');
        },
      })
      .reply(200, fixture('news-list.json'));

    await listNews({ tags: ['mirai_kasuga'], subcategories: ['GOODS'], limit: 5, brands: ['MILLIONLIVE'] });

    const decoded = decodeURIComponent(listPath);
    expect(decoded).toContain('"tag":["mirai_kasuga"]');
    expect(decoded).toContain('"subcategory":["GOODS"]');
    expect(decoded).toContain('"brand":["MILLIONLIVE"]');
  });
});

describe('normalize exposes tags', () => {
  it('surfaces tag slugs and human tag names', () => {
    const raw = fixture('news-list.json').data.article_list[0];
    const a = normalizeArticle(raw);
    expect(a.tags.length).toBeGreaterThan(0);
    expect(a.tagNames.length).toBeGreaterThan(0);
  });
});
