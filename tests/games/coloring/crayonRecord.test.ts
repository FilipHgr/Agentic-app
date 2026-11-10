import { describe, expect, it } from 'vitest';

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { drawing } from './outlineFixtures';
import { PICTURE, pixelsOf } from './savedPictureHelpers';

/**
 * Test k #93 AC6: základní vzor V z #92 AC6 (#96: svislé pruhy šířky
 * W stř zleva bez mezer, barvy dokola přes celou paletu, obrys prázdný)
 * nakreslený pastelkou se vejde do 50 000 znaků. Měří se jako
 * v `pictureRecord.test.ts` na vrstvě 1024 × 768 se stejnými nejhoršími
 * obrysy (prázdný, mřížka, domeček).
 *
 * „Nakreslený pastelkou“ znamená: každý pruh se vybarví svislými tahy
 * pastelky barvou pruhu. Pastelka je široká 0,5 W, proto má každý pruh
 * dva tahy (ve čtvrtině a ve třech čtvrtinách pruhu), a protože se tah
 * ořízne do oblasti, kde začal, začne nový tah v každém souvislém úseku
 * sloupce mimo obrys. Zrno pastelky tak zůstane v celém obrázku.
 *
 * Když test selže kvůli délce záznamu, vývojář to podle AC6 oznámí
 * vlastníkovi a nemění zrno ani limit.
 *
 * Navržené rozhraní: `Coloring.pointerDown(pointer, colorIndex, 'crayon')`
 * v `src/games/coloring/logic/coloring.ts` maluje pastelkou.
 */

/** Limit z AC6; schválně ne konstanta z kódu, aby ho nešlo potichu zvýšit. */
const RECORD_LIMIT = 50_000;

const LAYER_WIDTH = 1024;
const LAYER_HEIGHT = 768;

/** Stejné nejhorší obrysy jako v `pictureRecord.test.ts` (#92 AC6). */
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

function isFree(regions: RegionMap, x: number, y: number): boolean {
  const region = regionAt(regions, x, y);
  return region !== null && region !== OUTLINE_REGION;
}

/** Souvislé úseky sloupce `x` mimo obrys jako [první řádek, poslední řádek]. */
function freeRuns(regions: RegionMap, x: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let y = 0; y < regions.height; y += 1) {
    if (isFree(regions, x, y)) {
      start ??= y;
    } else if (start !== null) {
      runs.push([start, y - 1]);
      start = null;
    }
  }
  if (start !== null) {
    runs.push([start, regions.height - 1]);
  }
  return runs;
}

/** Vzor V nakreslený pastelkou svislými tahy v každém pruhu. */
function crayonPattern(regions: RegionMap): Coloring {
  const coloring = createColoring(regions);
  const stripeWidth = brushWidthFor(regions.width);
  let pointerId = 1;
  for (let stripe = 0; stripe * stripeWidth < regions.width; stripe += 1) {
    const color = stripe % PALETTE.length;
    for (const share of [0.25, 0.75]) {
      const x = (stripe + share) * stripeWidth;
      if (x >= regions.width) {
        continue;
      }
      for (const [top, bottom] of freeRuns(regions, Math.floor(x))) {
        coloring.pointerDown({ id: pointerId, x, y: top + 0.5, kind: 'touch' }, color, 'crayon');
        coloring.pointerMove({ id: pointerId, x, y: bottom + 0.5, kind: 'touch' });
        coloring.pointerUp(pointerId);
        pointerId += 1;
      }
    }
  }
  return coloring;
}

/** Jaký díl pixelů mimo obrys nemá barvu. */
function emptyShare(coloring: Coloring, regions: RegionMap): number {
  let free = 0;
  let empty = 0;
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (!isFree(regions, x, y)) {
        continue;
      }
      free += 1;
      if (coloring.colorAt(x, y) === null) {
        empty += 1;
      }
    }
  }
  return empty / free;
}

describe('#93 AC6: vzor V nakreslený pastelkou se vejde do limitu uložení', () => {
  it('vzor svislých pruhů nakreslený pastelkou má záznam nejvýš 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pattern = crayonPattern(regions);
      // Pastelka má v obrázku nechat zrno, jinak by test měřil jen plnou barvu.
      expect(emptyShare(pattern, regions), `${name}: v obrázku jsou mezery zrna`).toBeGreaterThan(
        0.1,
      );

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
      ).toEqual(pixelsOf(pattern, regions));
    }
  });
});
