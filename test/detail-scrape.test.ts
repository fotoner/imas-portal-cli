import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchArticleDetail } from '../src/core/detail-scrape';

const here = dirname(fileURLToPath(import.meta.url));
const detailHtml = readFileSync(join(here, 'fixtures', 'detail-01_7869.html'), 'utf8');
const PORTAL = 'https://idolmaster-official.jp';

let agent: MockAgent;
beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => {
  await agent.close();
});

describe('fetchArticleDetail', () => {
  it('parses __NEXT_DATA__ and returns the full inline body', async () => {
    agent.get(PORTAL).intercept({ path: '/news/01_7869' }).reply(200, detailHtml);
    const raw = await fetchArticleDetail('01_7869');
    expect(raw.title).toBeTruthy();
    expect(String(raw.content).trim().startsWith('<')).toBe(true);
  });

  it('maps HTTP 500 (missing/unpublished id) to NOT_FOUND', async () => {
    agent.get(PORTAL).intercept({ path: '/news/99_99999' }).reply(500, 'error');
    await expect(fetchArticleDetail('99_99999')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('raises PARSE_FAILED (loud, not silent) when __NEXT_DATA__ is absent', async () => {
    agent.get(PORTAL).intercept({ path: '/news/01_0000' }).reply(200, '<html><body>no data here</body></html>');
    await expect(fetchArticleDetail('01_0000')).rejects.toMatchObject({ kind: 'PARSE_FAILED' });
  });
});
