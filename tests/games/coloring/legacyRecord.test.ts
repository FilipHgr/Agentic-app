import { describe, expect, it } from 'vitest';

import { decodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { at } from './strokeHelpers';
import {
  LEGACY_P1_RECORD,
  LEGACY_SELECTED_COLOR,
  legacyPixels,
  legacyRegions,
} from './legacyRecordFixture';
import {
  PICTURE,
  RecordingStorage,
  keepOnlyRecordsBefore110,
  openOn,
  paint,
  pixelsOf,
} from './savedPictureHelpers';

/**
 * Test k #93 AC6: kódování vrstvy barev se kvůli zrnu pastelky zlepšilo
 * (nový formát záznamu), ale obrázek uložený před #93 (formát p1 z #92)
 * se musí přečíst beze změny pixel po pixelu. Záznam i očekávané pixely
 * jsou pevné v `legacyRecordFixture.ts`.
 */

const BLUE = 4;

/** Úložiště se starým záznamem pod klíčem, který tam hra sama zapíše. */
function storageWithLegacyRecord(): RecordingStorage {
  const storage = new RecordingStorage();
  const game = openOn(storage, legacyRegions());
  game.tapColor(BLUE);
  game.suspend();
  // Upraveno k #110: stará verze záznam barev nástrojů nezapisovala.
  keepOnlyRecordsBefore110(storage);
  storage.rewriteAll((value) => (value.startsWith('p') ? LEGACY_P1_RECORD : value));
  return storage;
}

describe('#93 AC6: obrázek uložený před #93 se přečte beze změny', () => {
  it('starý záznam p1 se přečte pixel po pixelu a s vybranou barvou', () => {
    const regions = legacyRegions();

    const decoded = decodePicture(LEGACY_P1_RECORD, PICTURE, regions);

    expect(decoded, 'starý záznam jde přečíst').not.toBeNull();
    expect(decoded?.selectedColor, 'vybraná barva').toBe(LEGACY_SELECTED_COLOR);
    expect(decoded === null ? [] : pixelsOf(decoded.colors, regions)).toEqual(legacyPixels());
  });

  it('dítě po otevření hry vidí obrázek ze starého záznamu a může v něm malovat dál', () => {
    const regions = legacyRegions();
    const storage = storageWithLegacyRecord();

    const game = openOn(storage, regions);
    expect(pixelsOf(game, regions), 'starý obrázek').toEqual(legacyPixels());
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_SELECTED_COLOR);

    paint(game, [at(30, 75), at(50, 75)]);
    const reopened = openOn(storage, regions);
    expect(pixelsOf(reopened, regions), 'po dalším tahu se uloží celý obrázek').toEqual(
      pixelsOf(game, regions),
    );
  });

  it('poškozený starý záznam dá prázdnou omalovánku', () => {
    const regions = legacyRegions();
    const middle = Math.floor(LEGACY_P1_RECORD.length / 2);
    const broken = `${LEGACY_P1_RECORD.slice(0, middle)}x${LEGACY_P1_RECORD.slice(middle + 1)}`;

    expect(decodePicture(broken, PICTURE, regions)).toBeNull();
  });
});
