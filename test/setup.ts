import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the on-disk response cache at a throwaway dir so test runs are isolated and
// suites can't collide on shared cache keys (one dir per worker process). Set before
// any test imports src/core/cache, which reads IMAS_CACHE_DIR lazily.
process.env.IMAS_CACHE_DIR = mkdtempSync(join(tmpdir(), 'imas-cache-test-'));
