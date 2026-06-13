import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { imas: 'src/cli/index.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  minify: false,
  sourcemap: false,
  banner: { js: '#!/usr/bin/env node' },
});
