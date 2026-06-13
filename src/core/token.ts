import { getJson } from './http';
import { ImasError } from './errors';

/**
 * The CMS API is gated behind a short-lived bootstrap token. Flow:
 *   GET cmsbase/Token/get  ->  { data: { token } }
 *   GET idolmaster/Article/list?...&token=<that>
 *
 * We cache the token per process (short TTL). A stale token makes Article/list
 * answer { statusCode: 404, data: false }; cms-api.ts detects that and forces a
 * refresh. No on-disk token cache in v1 (avoids a read/write race; 2 requests is
 * well within the < 2s budget).
 */
const TOKEN_URL =
  'https://cmsapi-frontend.idolmaster-official.jp/sitern/api/cmsbase/Token/get';
const TTL_MS = 60_000;

interface TokenResponse {
  statusCode?: number;
  data?: { token?: string } | false | null;
}

let cache: { token: string; at: number } | null = null;

export async function getToken(force = false): Promise<string> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.token;
  let res: TokenResponse;
  try {
    res = await getJson<TokenResponse>(TOKEN_URL);
  } catch (e) {
    throw new ImasError('API_DOWN', `Token/get request failed: ${(e as Error).message}`);
  }
  const token =
    res && res.data && typeof res.data === 'object' ? res.data.token : undefined;
  if (!token) throw new ImasError('API_DOWN', 'Token/get returned no token');
  cache = { token, at: Date.now() };
  return token;
}

/** Test hook: drop the cached token so each test starts cold. */
export function _resetTokenCache(): void {
  cache = null;
}
