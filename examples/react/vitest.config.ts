import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// Every story as a test in Chromium: it must render, pass its play function and the a11y checks
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [storybookTest({ configDir: '.storybook' })],
    test: {
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
);
