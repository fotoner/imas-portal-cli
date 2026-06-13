import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchIdolProfile } from '../src/core/idol-detail';

const here = dirname(fileURLToPath(import.meta.url));
const detailHtml = readFileSync(join(here, 'fixtures', 'idol-detail-60002.html'), 'utf8');
const IDOLLIST = 'https://idollist.idolmaster-official.jp';

let agent: MockAgent;
beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => {
  await agent.close();
});

describe('fetchIdolProfile (L2 encyclopedia scrape)', () => {
  it('parses the dl profile fields and CV', async () => {
    agent.get(IDOLLIST).intercept({ path: '/search/detail/60002' }).reply(200, detailHtml);
    const p = await fetchIdolProfile(`${IDOLLIST}/search/detail/60002`);
    expect(p.fields['身長']).toBe('162cm');
    expect(p.fields['血液型']).toBe('AB型');
    expect(p.fields['星座']).toBe('ふたご座');
    expect(p.fields['スリーサイズ']).toBe('82/58/86');
    expect(p.cv).toContain('小鹿');
  });

  it('maps HTTP 404 to NOT_FOUND', async () => {
    agent.get(IDOLLIST).intercept({ path: '/search/detail/99999' }).reply(404, 'nope');
    await expect(fetchIdolProfile(`${IDOLLIST}/search/detail/99999`)).rejects.toMatchObject({
      kind: 'NOT_FOUND',
    });
  });
});
