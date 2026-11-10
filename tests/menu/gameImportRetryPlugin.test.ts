import { describe, expect, it } from 'vitest';

import { GAME_IMPORT_GLOBAL } from '../../src/menu/logic/gameImportGlobal';
import { gameImportRendering } from '../../tools/build/gameImportRetry';

/**
 * Testy k #67 AC5: plugin buildu obalí novým pokusem po výpadku sítě jen
 * stažení vstupu hry (`src/games/<hra>/index.ts`), jiné `import()` nechá.
 */

describe('#67 AC5: plugin game-import-retry', () => {
  it('vstup hry stáhne přes funkci se jménem ze sdílené konstanty', () => {
    expect(gameImportRendering('/repo/src/games/counting/index.ts')).toEqual({
      left: `globalThis.${GAME_IMPORT_GLOBAL}(`,
      right: ', import.meta.url)',
    });
  });

  it('cestu s obrácenými lomítky (Windows) pozná také', () => {
    expect(gameImportRendering('C:\\repo\\src\\games\\counting\\index.ts')).not.toBeNull();
  });

  it.each([
    ['rozpoznávání psaní uvnitř hry', '/repo/src/games/counting/logic/digitRecognition.ts'],
    ['index.ts v podsložce hry', '/repo/src/games/counting/logic/index.ts'],
    ['soubor mimo hry', '/repo/src/menu/logic/menu.ts'],
    ['balíček', '/repo/node_modules/phaser/index.ts'],
  ])('%s nechá beze změny', (_name, id) => {
    expect(gameImportRendering(id)).toBeNull();
  });

  it('import bez známého cíle nechá beze změny', () => {
    expect(gameImportRendering(null)).toBeNull();
  });
});
