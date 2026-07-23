import { fileURLToPath } from 'node:url';
import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

const appDir = fileURLToPath(new URL('./app', import.meta.url));

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
        },
      }),
    ],
  },
});
