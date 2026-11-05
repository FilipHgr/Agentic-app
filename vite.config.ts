import { defineConfig } from 'vitest/config';

// Nový pokus o stažení hry po výpadku sítě (#67 AC5), viz soubor pluginu.
import { gameImportRetry } from './tools/build/gameImportRetry';

/**
 * Oficiální build Phaseru bez fyziky Matter ze stejného balíčku a verze
 * (#58). Hra Matter nepoužívá a soubor při startu je o 122 kB menší.
 * Je to UMD soubor, proto se napojuje aliasem místo běžného vstupu balíčku.
 * Typy Phaseru dál obsahují Matter, kompilátor jeho použití neodhalí.
 */
const PHASER_WITHOUT_MATTER = 'phaser/dist/phaser-arcade-physics.min.js';

export default defineConfig({
  plugins: [gameImportRetry()],
  // host: true zpřístupní dev server v místní síti, aby šel otevřít na iPadu.
  server: {
    host: true,
  },
  resolve: {
    alias: [{ find: /^phaser$/, replacement: PHASER_WITHOUT_MATTER }],
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser v samostatném souboru: po změně jen kódu hry se jeho jméno
        // nezmění a prohlížeč ho nestahuje znovu (#58 AC7).
        manualChunks(id) {
          return id.includes('node_modules/phaser/') ? 'phaser' : undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
