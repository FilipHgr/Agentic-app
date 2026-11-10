import { describe, expect, it } from 'vitest';

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { drawing } from './outlineFixtures';
import { TOOL_FACTOR, TOOL_NAMES } from './lineSizeHelpers';
import { PICTURE, pixelsOf } from './savedPictureHelpers';

/**
 * Test k #91 AC6: testovací vzor V z úkolu ukládání (#92 AC6, #96: svislé
 * pruhy šířky střední W zleva bez mezer, barvy dokola přes celou paletu,
 * obrys prázdný) nakreslený malou velikostí štětcem i pastelkou se vejde
 * do 50 000 znaků. Měří se jako v `pictureRecord.test.ts`
 * a `crayonRecord.test.ts` na vrstvě 1024 × 768 se stejnými nejhoršími
 * obrysy (prázdný, mřížka, domeček).
 *
 * „Nakreslený malou velikostí“ znamená: každý pruh se vybarví svislými
 * tahy nástroje malé velikosti barvou pruhu, tahy jdou od levého okraje
 * pruhu k pravému tak hustě, aby se stopy dotýkaly (u štětce 2 tahy
 * na pruh, u pastelky 4). Tah se ořízne do oblasti, kde začal, proto
 * začne nový tah v každém souvislém úseku sloupce mimo obrys.
 *
 * Když test selže kvůli délce záznamu, vývojář to oznámí vlastníkovi
 * a nemění zrno, velikosti ani limit.
 *
 * Navržené rozhraní: `brushWidthFor(pictureWidth, 'small')` dá W malé
 * velikosti a `createColoring(regions, { brushWidth })` maluje tahy s touto
 * šířkou W (štětec W, pastelka 0,5 W) jako dnes.
 */

/** Limit z #92 AC6; schválně ne konstanta z kódu, aby ho nešlo potichu zvýšit. */
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

/** Polohy tahů v pruhu [left, right): stopy šířky `traceWidth` se dotýkají. */
function strokeColumns(left: number, right: number, traceWidth: number): number[] {
  const count = Math.max(1, Math.ceil((right - left) / traceWidth));
  const first = left + traceWidth / 2;
  const last = right - traceWidth / 2;
  if (count === 1) {
    return [(left + right) / 2];
  }
  return Array.from(
    { length: count },
    (_, index) => first + ((last - first) * index) / (count - 1),
  );
}

/** Vzor V nakreslený nástrojem `tool` malé velikosti svislými tahy v každém pruhu. */
function smallPattern(regions: RegionMap, tool: ToolId): Coloring {
  const smallW = brushWidthFor(regions.width, 'small');
  const coloring = createColoring(regions, { brushWidth: smallW });
  const stripeWidth = brushWidthFor(regions.width, 'medium');
  const traceWidth = TOOL_FACTOR[tool] * smallW;
  let pointerId = 1;
  for (let stripe = 0; stripe * stripeWidth < regions.width; stripe += 1) {
    const color = stripe % PALETTE.length;
    const left = stripe * stripeWidth;
    const right = Math.min(regions.width, left + stripeWidth);
    for (const x of strokeColumns(left, right, traceWidth)) {
      for (const [top, bottom] of freeRuns(regions, Math.floor(x))) {
        coloring.pointerDown({ id: pointerId, x, y: top + 0.5, kind: 'touch' }, color, tool);
        coloring.pointerMove({ id: pointerId, x, y: bottom + 0.5, kind: 'touch' });
        coloring.pointerUp(pointerId);
        pointerId += 1;
      }
    }
  }
  return coloring;
}

/** Jaký díl pixelů mimo obrys má barvu. */
function paintedShare(coloring: Coloring, regions: RegionMap): number {
  let free = 0;
  let painted = 0;
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (!isFree(regions, x, y)) {
        continue;
      }
      free += 1;
      if (coloring.colorAt(x, y) !== null) {
        painted += 1;
      }
    }
  }
  return painted / free;
}

function expectPatternFits(tool: ToolId): void {
  // Bez malé velikosti by se měřila střední čára a test by nic neověřil.
  expect(brushWidthFor(LAYER_WIDTH, 'small'), 'W malé velikosti').toBeCloseTo(LAYER_WIDTH / 50, 6);
  for (const { name, regions } of worstCaseOutlines()) {
    const what = `${TOOL_NAMES[tool]}, ${name}`;
    const pattern = smallPattern(regions, tool);
    // Vzor má pokrýt obrázek, jinak by test měřil skoro prázdný záznam.
    expect(paintedShare(pattern, regions), `${what}: vzor pokrývá obrázek`).toBeGreaterThan(0.5);

    const record = encodePicture({ picture: PICTURE, regions, colors: pattern, selectedColor: 0 });
    expect(record.length, `${what}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

    const decoded = decodePicture(record, PICTURE, regions);
    expect(decoded, `${what}: záznam jde přečíst`).not.toBeNull();
    expect(
      decoded === null ? [] : pixelsOf(decoded.colors, regions),
      `${what}: stejný obrázek pixel po pixelu`,
    ).toEqual(pixelsOf(pattern, regions));
  }
}

describe('#91 AC6: vzor V nakreslený malou velikostí se vejde do limitu uložení', () => {
  it('vzor nakreslený štětcem malé velikosti má záznam nejvýš 50 000 znaků a přečte se beze ztráty', () => {
    expectPatternFits('brush');
  });

  it('vzor nakreslený pastelkou malé velikosti má záznam nejvýš 50 000 znaků a přečte se beze ztráty', () => {
    expectPatternFits('crayon');
  });
});
