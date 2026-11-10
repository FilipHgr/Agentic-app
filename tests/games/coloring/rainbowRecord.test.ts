import { describe, expect, it } from 'vitest';

import { createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { drawing } from './outlineFixtures';
import { RAINBOW } from './rainbowHelpers';
import { PICTURE, pixelsOf } from './savedPictureHelpers';

/**
 * Test k #97 AC5 (třetí část): obrázek nakreslený duhou svislými tahy přes
 * celou plochu (#96) se vejde do 50 000 znaků. Měří se jako
 * v `crayonRecord.test.ts` na vrstvě 1024 × 768 se stejnými nejhoršími
 * obrysy (prázdný, mřížka, domeček).
 *
 * „Svislé tahy přes celou plochu“ podle #96: na prázdný obrázek se
 * kreslí střední velikostí tahy shora dolů přes celou výšku, vedle sebe po
 * W stř zleva doprava, každý začíná na horním okraji plochy ve středu svého
 * pruhu. Ořez platí jako vždy: tah barví jen oblast, kde začal (nebo kam
 * vjel z obrysu), proto zůstanou místa pod vodorovnými čarami obrysu prázdná.
 *
 * Když test selže kvůli délce záznamu, úkol se podle AC5 odloží a vlastník
 * se o tom dozví; limit ani vzhled stopy se nemění.
 *
 * Navržené rozhraní: `Coloring.pointerDown(pointer, colorIndex, 'rainbow')`
 * v `src/games/coloring/logic/coloring.ts` maluje duhou.
 */

/** Limit z AC5; schválně ne konstanta z kódu, aby ho nešlo potichu zvýšit. */
const RECORD_LIMIT = 50_000;

const LAYER_WIDTH = 1024;
const LAYER_HEIGHT = 768;

/** W stř jako 1/30 šířky plochy (#96); schválně ne konstanta z kódu. */
const MID_W = LAYER_WIDTH / 30;

/**
 * Stejné nejhorší obrysy jako v `crayonRecord.test.ts` (#92 AC6).
 * `allRainbow` říká, jestli má tah podle pravidel z #96 dost dlouhou dráhu
 * v jedné oblasti, aby se v obrázku objevilo všech 6 barev duhy. U mřížky
 * ne: každý tah začne na horním rámu, ořez ho nechá barvit jen horní řadu
 * políček (dráha asi 60 px, pod čarou y 61) a úsek jedné barvy má
 * 2 W stř ≈ 68 px, takže vznikne jen červená. Mřížka proto hlídá jen
 * limit a přečtení beze ztráty.
 */
function worstCaseOutlines(): Array<{ name: string; regions: RegionMap; allRainbow: boolean }> {
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
    {
      name: 'prázdný obrys',
      regions: drawing(LAYER_WIDTH, LAYER_HEIGHT).regions(),
      allRainbow: true,
    },
    { name: 'mřížka', regions: grid.regions(), allRainbow: false },
    { name: 'domeček', regions: house.regions(), allRainbow: true },
  ];
}

/** Svislé tahy duhou přes celou plochu podle #96. */
function rainbowColumns(regions: RegionMap): Coloring {
  const coloring = createColoring(regions);
  let pointerId = 1;
  for (let stripe = 0; stripe * MID_W < regions.width; stripe += 1) {
    const x = (stripe + 0.5) * MID_W;
    coloring.pointerDown({ id: pointerId, x, y: 0, kind: 'touch' }, 0, 'rainbow');
    for (let y = 16; y <= regions.height; y += 16) {
      coloring.pointerMove({ id: pointerId, x, y, kind: 'touch' });
    }
    coloring.pointerUp(pointerId);
    pointerId += 1;
  }
  return coloring;
}

describe('#97 AC5: obrázek nakreslený duhou se vejde do limitu uložení', () => {
  it('svislé tahy duhou přes celou plochu mají záznam nejvýš 50 000 znaků a přečtou se beze ztráty', () => {
    for (const { name, regions, allRainbow } of worstCaseOutlines()) {
      const pattern = rainbowColumns(regions);
      const pixels = pixelsOf(pattern, regions);
      // Bez duhy by test měřil prázdný nebo jednobarevný obrázek.
      const used = new Set(pixels.filter((color) => color !== null));
      if (allRainbow) {
        expect([...used].sort(), `${name}: v obrázku je všech 6 barev duhy`).toEqual(
          [...RAINBOW].sort(),
        );
      } else {
        expect([...used], `${name}: obrázek je neprázdný a celý červený`).toEqual([RAINBOW[0]]);
      }

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
