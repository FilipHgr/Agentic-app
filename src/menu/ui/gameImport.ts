/**
 * Stahování her s novým pokusem po výpadku sítě (#67 AC5). Produkční build
 * (plugin `game-import-retry` v `tools/build/gameImportRetry.ts`) přepíše
 * `import()` vstupu každé hry na volání globální funkce `GAME_IMPORT_GLOBAL`.
 * Tady se ta funkce zaregistruje. Ve vývojovém serveru se nepoužije.
 */

import { GAME_IMPORT_GLOBAL } from '../logic/gameImportGlobal';
import { createRetryingImport } from '../logic/retryingImport';
import type { RetryingImport } from '../logic/retryingImport';

export function registerGameImport(): void {
  const retryingImport: RetryingImport = createRetryingImport(
    (url) => import(/* @vite-ignore */ url),
  );
  Object.defineProperty(globalThis, GAME_IMPORT_GLOBAL, { value: retryingImport });
}
