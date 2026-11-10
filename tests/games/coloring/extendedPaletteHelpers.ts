/**
 * Pomůcky pro testy rozšířené palety Omalovánek (#100, varianta A):
 * k původním 8 barvám z #88 přibudou za ně růžová, tělová, šedá a světle
 * modrá, bílá ne. Indexy a počty jsou schválně opsané ze zadání, ne
 * konstanty z kódu, aby je nešlo potichu změnit.
 *
 * Vzory pro limit uložení (AC4) jsou podle společných pravidel z #96
 * a měří se jako v `pictureRecord.test.ts`, `crayonRecord.test.ts`,
 * `rainbowRecord.test.ts` a `stampRecord.test.ts` na vrstvě 1024 × 768
 * se stejnými nejhoršími obrysy (prázdný, mřížka, domeček). Rozdíl je jen
 * v tom, že se barvy střídají dokola přes všech 12 barev.
 */

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { drawing } from './outlineFixtures';

/** Kolik barev má paleta po #100. */
export const COLOR_COUNT = 12;

/** Původních 8 barev z #88 v původním pořadí. */
export const ORIGINAL_COLOR_IDS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'brown',
  'black',
] as const;

/** Nové barvy z varianty A v pořadí ze zadání: růžová, tělová, šedá, světle modrá. */
export const NEW_COLOR_IDS = ['pink', 'skin', 'gray', 'lightBlue'] as const;

/** Indexy nových barev v paletě (hned za původními). */
export const PINK = 8;
export const SKIN = 9;
export const GRAY = 10;
export const LIGHT_BLUE = 11;
export const NEW_COLORS: readonly number[] = [PINK, SKIN, GRAY, LIGHT_BLUE];

export const NEW_COLOR_NAMES: Readonly<Record<number, string>> = {
  [PINK]: 'růžová',
  [SKIN]: 'tělová',
  [GRAY]: 'šedá',
  [LIGHT_BLUE]: 'světle modrá',
};

/** Limit z #92 AC6; schválně ne konstanta z kódu, aby ho nešlo potichu zvýšit. */
export const RECORD_LIMIT = 50_000;

export const LAYER_WIDTH = 1024;
export const LAYER_HEIGHT = 768;

/** W stř jako 1/30 šířky plochy (#96); schválně ne konstanta z kódu. */
export const MID_W = LAYER_WIDTH / 30;

/** Je barva platná barva rozšířené palety? */
export function isKnownColor(color: number): boolean {
  return Number.isInteger(color) && color >= 0 && color < COLOR_COUNT;
}

/** Stejné nejhorší obrysy jako v `pictureRecord.test.ts` (#92 AC6). */
export function worstCaseOutlines(): Array<{ name: string; regions: RegionMap }> {
  const grid = drawing(LAYER_WIDTH, LAYER_HEIGHT).frame(0, 0, LAYER_WIDTH - 1, LAYER_HEIGHT - 1, 4);
  for (let x = 97; x < LAYER_WIDTH; x += 131) {
    grid.verticalLine(x, 3);
  }
  for (let y = 61; y < LAYER_HEIGHT; y += 113) {
    grid.horizontalLine(y, 3);
  }

  const house = drawing(LAYER_WIDTH, LAYER_HEIGHT).frame(200, 330, 760, 700, 5);
  for (let step = 0; step <= 280; step += 1) {
    // Střecha ze dvou šikmých čar tloušťky 4 px.
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

/**
 * Základní vzor V z #96 s 12 barvami: každý pixel mimo obrys má barvu
 * svislého pruhu šířky W stř, pruhy jdou zleva bez mezer a barvy se
 * střídají dokola přes všech 12 barev. Obrys je prázdný. Pruh pixelu se
 * určí podle jeho středu.
 */
export function stripePattern(regions: RegionMap): {
  colorAt(x: number, y: number): number | null;
} {
  const stripeWidth = brushWidthFor(regions.width);
  return {
    colorAt(x, y) {
      if (!isFree(regions, x, y)) {
        return null;
      }
      return Math.floor((Math.floor(x) + 0.5) / stripeWidth) % COLOR_COUNT;
    },
  };
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

/**
 * Vzor V s 12 barvami nakreslený pastelkou (jako v `crayonRecord.test.ts`):
 * v každém pruhu dva svislé tahy barvou pruhu (pastelka je široká 0,5 W)
 * v každém souvislém úseku sloupce mimo obrys.
 */
export function crayonPattern(regions: RegionMap): Coloring {
  const coloring = createColoring(regions);
  const stripeWidth = brushWidthFor(regions.width);
  let pointerId = 1;
  for (let stripe = 0; stripe * stripeWidth < regions.width; stripe += 1) {
    const color = stripe % COLOR_COUNT;
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

/**
 * Svislé tahy přes celou plochu podle #96 nástrojem `tool`: tahy shora
 * dolů přes celou výšku, vedle sebe po W stř, každý začíná na horním
 * okraji ve středu svého pruhu, střední velikost. Barva tahu se střídá
 * dokola přes všech 12 barev (u duhy ji nástroj nepoužije).
 */
export function verticalStrokes(regions: RegionMap, tool: ToolId): Coloring {
  const coloring = createColoring(regions);
  let pointerId = 1;
  for (let stripe = 0; stripe * MID_W < regions.width; stripe += 1) {
    const x = (stripe + 0.5) * MID_W;
    const color = stripe % COLOR_COUNT;
    coloring.pointerDown({ id: pointerId, x, y: 0, kind: 'touch' }, color, tool);
    for (let y = 16; y <= regions.height; y += 16) {
      coloring.pointerMove({ id: pointerId, x, y, kind: 'touch' });
    }
    coloring.pointerUp(pointerId);
    pointerId += 1;
  }
  return coloring;
}

/** Barvy, které se v obrázku objevily. */
export function usedColors(pixels: ReadonlyArray<number | null>): number[] {
  return [...new Set(pixels.filter((color): color is number => color !== null))].sort(
    (first, second) => first - second,
  );
}

/** Nejvýš tolik rozdílů se vypíše, aby zpráva zůstala čitelná a test rychlý. */
const MAX_DIFFERENCES = 5;

/**
 * Rozdíly dvou obrázků pixel po pixelu (po řádcích, šířka `width`) jako
 * krátký seznam. Prázdný seznam znamená stejné obrázky. Obrovské pole
 * pixelů se tak při chybě neporovnává celé ve výpisu.
 */
export function pixelDifferences(
  actual: ReadonlyArray<number | null>,
  expected: ReadonlyArray<number | null>,
  width: number,
): string[] {
  if (actual.length !== expected.length) {
    return [`jiný počet pixelů: ${actual.length} místo ${expected.length}`];
  }
  const differences: string[] = [];
  let count = 0;
  actual.forEach((color, index) => {
    const wanted = expected[index] ?? null;
    if (color === wanted) {
      return;
    }
    count += 1;
    if (differences.length < MAX_DIFFERENCES) {
      const x = index % width;
      const y = Math.floor(index / width);
      differences.push(`pixel (${x}, ${y}) je ${String(color)} místo ${String(wanted)}`);
    }
  });
  if (count > MAX_DIFFERENCES) {
    differences.push(`… celkem ${count} rozdílných pixelů`);
  }
  return differences;
}
