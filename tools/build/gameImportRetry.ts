/**
 * Plugin buildu `game-import-retry` (#67 AC5). Prohlížeč si nepovedený
 * `import()` pamatuje a stejnou adresu znovu nestáhne. V buildu se proto
 * `import()` vstupu hry (`src/games/<hra>/index.ts`) přepíše na volání
 * funkce z `src/menu/ui/gameImport.ts`, která další pokus stáhne s jinou
 * adresou (`?pokus=N`).
 *
 * Omezení: novou adresu dostane jen vstupní soubor hry. Soubory, které
 * vstup sám importuje (dnes jen startovní soubor a Phaser, oba už stažené),
 * mají adresu stejnou. Až budou mít hry společné soubory, jejich selhání
 * se znovu nezkusí, dokud se stránka neobnoví.
 */

import type { Plugin } from 'vite';

import { GAME_IMPORT_GLOBAL } from '../../src/menu/logic/gameImportGlobal';

const GAME_ENTRY = /[\\/]src[\\/]games[\\/][^\\/]+[\\/]index\.ts$/;

/** Jak se má vykreslit `import()` cíle: u vstupu hry volání s novým pokusem, jinak beze změny. */
export function gameImportRendering(
  targetModuleId: string | null,
): { left: string; right: string } | null {
  if (targetModuleId === null || !GAME_ENTRY.test(targetModuleId)) {
    return null;
  }
  return { left: `globalThis.${GAME_IMPORT_GLOBAL}(`, right: ', import.meta.url)' };
}

export function gameImportRetry(): Plugin {
  return {
    name: 'game-import-retry',
    apply: 'build',
    renderDynamicImport({ targetModuleId }) {
      return gameImportRendering(targetModuleId);
    },
  };
}
