import { HttpError } from './errors';

/**
 * Tiny polite HTTP layer over global fetch (Node 20+ = undici).
 *  - fixed identifying User-Agent + portal Referer/Origin (the CMS API checks Origin)
 *  - a single global min-interval throttle so we never hammer the CloudFront-cached API
 *  - non-2xx -> HttpError(status); the detail scraper maps 500/404 to NOT_FOUND
 *
 * Tests intercept this via undici's MockAgent (setGlobalDispatcher), so no HTTP client
 * abstraction is needed here.
 */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'imas-portal-cli (+https://github.com/fotoner/imas-portal-cli)',
  Referer: 'https://idolmaster-official.jp/',
  Origin: 'https://idolmaster-official.jp',
  'Accept-Language': 'ja',
};

const MIN_INTERVAL_MS = 250;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export interface HttpOptions {
  timeoutMs?: number;
}

export async function getText(url: string, opts: HttpOptions = {}): Promise<string> {
  await throttle();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal });
    if (!res.ok) throw new HttpError(res.status, url);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const text = await getText(url, opts);
  return JSON.parse(text) as T;
}
