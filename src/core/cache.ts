import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import envPaths from 'env-paths';

/**
 * Stale-cache fallback (eng review Issue 1B). List queries have NO scrape fallback
 * if the CMS API dies (there's no discovery without it). So we cache the last good
 * list response on disk and, on API_DOWN, serve it back flagged `stale: true` — an
 * agent gets slightly-old data + a warning instead of a hard failure.
 *
 * Best-effort: a cache read/write failure never breaks a query.
 */
/**
 * Cache directory. Resolved lazily so `IMAS_CACHE_DIR` can be set per process (the
 * test suite points it at a throwaway temp dir, which both isolates runs and stops
 * suites from colliding on shared on-disk cache keys).
 */
function cacheRoot(): string {
  return process.env.IMAS_CACHE_DIR || envPaths('imas-portal-cli', { suffix: '' }).cache;
}

function fileFor(key: unknown): string {
  const hash = createHash('sha1').update(JSON.stringify(key)).digest('hex');
  return join(cacheRoot(), `${hash}.json`);
}

export interface CachedEntry<T> {
  savedAt: string;
  value: T;
}

export async function writeCache(key: unknown, value: unknown): Promise<void> {
  try {
    await fs.mkdir(cacheRoot(), { recursive: true });
    await fs.writeFile(
      fileFor(key),
      JSON.stringify({ savedAt: new Date().toISOString(), value }),
    );
  } catch {
    // caching is best-effort
  }
}

export async function readCache<T>(key: unknown): Promise<CachedEntry<T> | null> {
  try {
    const raw = await fs.readFile(fileFor(key), 'utf8');
    return JSON.parse(raw) as CachedEntry<T>;
  } catch {
    return null;
  }
}

export function cacheDir(): string {
  return cacheRoot();
}
