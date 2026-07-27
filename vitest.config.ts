import { fileURLToPath } from 'node:url';
import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

const appDir = fileURLToPath(new URL('app', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      // Pure functions — plain Node, no Nuxt runtime (fastest). Needs the `~`
      // alias since these tests import source by absolute path.
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          alias: { '~': appDir, '@': appDir },
        },
      },
      // Anything touching the Nuxt runtime: auto-imports (stores), components
      // (mountSuspended), Vuetify. Runs in the happy-dom-backed nuxt environment.
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          setupFiles: ['test/setup.ts'],
          // Cold starts build the full Nuxt vite environment before the first
          // test; the default 10s hook timeout is too tight for that on CI.
          hookTimeout: 60_000,
          // Same reason: on a cold vite cache the first mountSuspended in each
          // file waits on transforms and blows the default 5s test timeout.
          testTimeout: 30_000,
        },
      }),
      // Real-browser player checks. Excluded from `pnpm test` (see package.json)
      // because they build the app, drive a browser and hit jw.org's live API —
      // run them with `pnpm test:e2e`.
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.test.ts'],
          environment: 'node',
          alias: { '~': appDir, '@': appDir },
          // One browser, one video, one dialog: the specs walk a single player
          // session forward and depend on each other's end state.
          fileParallelism: false,
          sequence: { concurrent: false },
          testTimeout: 120_000,
          hookTimeout: 300_000,
        },
      },
    ],
  },
});
