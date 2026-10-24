import { defineConfig } from 'vitest/config';

export default defineConfig({
  // host: true zpřístupní dev server v místní síti, aby šel otevřít na iPadu.
  server: {
    host: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
