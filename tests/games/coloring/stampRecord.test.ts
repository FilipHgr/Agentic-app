import { describe, expect, it } from 'vitest';

import { createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { drawing } from './outlineFixtures';
import { PICTURE, paintedPixels, pixelsOf } from './savedPictureHelpers';

/**
 * Test k #98 AC5 (třetí část): obrázek nakreslený razítkovým fixem
 * svislými tahy přes celou plochu (#96) se vejde do 50 000 znaků. Měří se
 * jako v `rainbowRecord.test.ts` na vrstvě 1024 × 768 se stejnými
 * nejhoršími obrysy (prázdný, mřížka, domeček).
 *
 * „Svislé tahy přes celou plochu“ podle #96: na prázdný obrázek se kreslí
 * střední velikostí tahy shora dolů přes celou výšku, vedle sebe po W stř
 * zleva doprava, každý začíná na horním okraji plochy ve středu svého
 * pruhu. Ořez platí jako vždy. Barvu tahů #96 neurčuje; tady se střídají
 * dokola přes celou paletu (jako ve vzoru V), aby sousední hvězdičky měly
 * různé barvy, což je pro záznam nejtěžší.
 *
 * Když test selže kvůli délce záznamu, úkol se podle AC5 odloží a vlastník
 * se o tom dozví; limit ani vzhled stopy se nemění.
 *
 * Navržené rozhraní: `Coloring.pointerDown(pointer, colorIndex, 'stamp')`
 * v `src/games/coloring/logic/coloring.ts` klade hvězdičky.
 */

/** Limit z AC5; schválně ne konstanta z kódu, aby ho nešlo potichu zvýšit. */
const RECORD_LIMIT = 50_000;

const LAYER_WIDTH = 1024;
const LAYER_HEIGHT = 768;

/** W stř jako 1/30 šířky plochy (#96); schválně ne konstanta z kódu. */
const MID_W = LAYER_WIDTH / 30;

const STAMP: ToolId = 'stamp';

/** Stejné nejhorší obrysy jako v `rainbowRecord.test.ts` a `crayonRecord.test.ts`. */
function worstCaseOutlines(): Array<{ name: string; regions: RegionMap }> {
  const grid = drawing(LAYER_WIDTH, LAYER_HEIGHT).frame(0, 0, LAYER_WIDTH - 1, LAYER_HEIGHT - 1, 4);
  for (let x = 97; x < LAYER_WIDTH; x += 131) {
    grid.verticalLine(x, 3);
  }
  for (let y = 61; y < LAYER_HEIGHT; y += 113) {
    grid.horizontalLine(y, 3);
  }

  const house = drawing(LAYER_WIDTH, LAYER_HEIGHT).frame(200, 330, 760, 700, 5);
  for (let step = 0; step <= 280; step += 1) {
    house.fill(200 + step, 330 - step, 203 + step, 333 - step);
    house.fill(757 - step, 330 - step, 760 - step, 333 - step);
  }
  for (let window = 0; window < 4; window += 1) {
    house.frame(250 + window * 130, 420, 330 + window * 130, 500, 3);
  }
  house.frame(840, 120, 960, 240, 4).frame(880, 400, 900, 760, 3);

  return [
    { name: 'prázdný obrys', regions: drawing(LAYER_WIDTH, LAYER_HEIGHT).regions() },
    { name: 'mřížka', regions: grid.regions() },
    { name: 'domeček', regions: house.regions() },
  ];
}

/** Svislé tahy razítkovým fixem přes celou plochu podle #96. */
function stampColumns(regions: RegionMap): Coloring {
  const coloring = createColoring(regions);
  let pointerId = 1;
  for (let stripe = 0; stripe * MID_W < regions.width; stripe += 1) {
    const x = (stripe + 0.5) * MID_W;
    const color = stripe % PALETTE.length;
    coloring.pointerDown({ id: pointerId, x, y: 0, kind: 'touch' }, color, STAMP);
    for (let y = 16; y <= regions.height; y += 16) {
      coloring.pointerMove({ id: pointerId, x, y, kind: 'touch' });
    }
    coloring.pointerUp(pointerId);
    pointerId += 1;
  }
  return coloring;
}

describe('#98 AC5: obrázek nakreslený razítkovým fixem se vejde do limitu uložení', () => {
  it('svislé tahy hvězdičkami přes celou plochu mají záznam nejvýš 50 000 znaků a přečtou se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pattern = stampColumns(regions);
      const pixels = pixelsOf(pattern, regions);
      // Bez hvězdiček by test měřil prázdný obrázek.
      expect(paintedPixels(pattern, regions), `${name}: obrázek není prázdný`).toBeGreaterThan(0);

      const record = encodePicture({
        picture: PICTURE,
        regions,
        colors: pattern,
        selectedColor: 0,
      });
      expect(record.length, `${name}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

      const decoded = decodePicture(record, PICTURE, regions);
      expect(decoded, `${name}: záznam jde přečíst`).not.toBeNull();
      expect(
        decoded === null ? [] : pixelsOf(decoded.colors, regions),
        `${name}: stejný obrázek pixel po pixelu`,
      ).toEqual(pixels);
    }
  });
});
