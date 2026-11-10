import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import {
  PICTURE_RECORD_LIMIT,
  decodePicture,
  encodePicture,
} from '../../../src/games/coloring/logic/savedPicture';
import { dotPixels } from './dotsHelpers';
import { pixelDifferences, usedColors, worstCaseOutlines } from './extendedPaletteHelpers';
import { glitterPixels } from './glitterHelpers';
import {
  RECORD_LIMIT,
  colorsOf,
  crayonPlaces,
  patternOverStripes,
  pixelsFrom,
  stripePlaces,
  verticalStrokePlaces,
} from './manyColorsHelpers';
import { PICTURE, RecordingStorage, openOn, paint, twoHalves } from './savedPictureHelpers';
import { sprayPixels } from './sprayHelpers';
import { stripePixels } from './stripesHelpers';
import { at } from './strokeHelpers';
import { COLOR_TOOLS } from './toolColorsHelpers';
import { ALL_COLOR_COUNT, SET_SIZE, allSetColors, giveToolPlace } from './toolColorSetsHelpers';

/**
 * Testy k #116 AC6 druhá část: nejhorší vzory testů limitu (#92, #93,
 * #97–#104, jak je staví `manyColorsHelpers.ts` z #115) se střídáním přes
 * všechny barvy tabulky se s dnešní hrou (bez volby `paletteSize`, tedy
 * se všemi 46 barvami sad) vejdou do 50 000 znaků a přečtou se beze ztráty.
 *
 * Barvy se střídají ve dvou pořadích: po sloupcích tabulky (štětec, fix,
 * …, sprej, každá barva jednou) a střídáním vzdálených barev tohoto
 * seznamu (první, poslední, druhá, předposlední, …). Čísla barev testy
 * neznají, berou je z kroků barev nástrojů (`allSetColors`).
 *
 * Vzor V má na šířce 1024 px jen 30 pruhů, jedno pořadí tak použije
 * 30 barev (u vzorků nástrojů 31). Ostatní barvy se do obrázku dostanou
 * druhým pořadím.
 */

/** Jeden vzor nakreslí všechny tři obrázky 1024 × 768 dvakrát, delší čas jen pro tyto testy. */
const PATTERN_TEST_TIMEOUT_MS = 60_000;

/** Pořadí barev: název a barva podle místa v řadě. */
interface TableOrder {
  readonly name: string;
  readonly colors: readonly number[];
}

/** Všech 46 barev sad v pořadí tabulky a střídáním vzdálených barev. */
function tableOrders(): TableOrder[] {
  const byColumns = allSetColors(openOn(new RecordingStorage(), twoHalves()));
  expect(byColumns.length, 'kontrola: v sadách je 46 barev').toBe(ALL_COLOR_COUNT);
  const far = byColumns.map((_, place) =>
    place % 2 === 0
      ? (byColumns[place / 2] ?? 0)
      : (byColumns[byColumns.length - 1 - (place - 1) / 2] ?? 0),
  );
  return [
    { name: 'po sloupcích tabulky', colors: byColumns },
    { name: 'střídání vzdálených barev', colors: far },
  ];
}

/** Místa v řadě (dokola přes 64 míst z #115) převedená na barvy pořadí. */
function inTableOrder(
  places: ReadonlyArray<number | null>,
  order: TableOrder,
): Array<number | null> {
  return places.map((place) =>
    place === null ? null : (order.colors[place % order.colors.length] ?? null),
  );
}

/** Obrázek s pixely `pixels` se s dnešní hrou vejde do 50 000 znaků a přečte se beze ztráty. */
function expectWithinLimit(
  what: string,
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
  selectedColor: number,
): void {
  const record = encodePicture({
    picture: PICTURE,
    regions,
    colors: colorsOf(pixels, regions),
    selectedColor,
  });
  expect(record.length, `${what}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

  const decoded = decodePicture(record, PICTURE, regions);
  expect(decoded, `${what}: záznam jde přečíst`).not.toBeNull();
  expect(decoded?.selectedColor, `${what}: vybraná barva`).toBe(selectedColor);
  expect(
    pixelDifferences(
      decoded === null ? [] : pixelsFrom(decoded.colors, regions),
      pixels,
      regions.width,
    ),
    `${what}: stejný obrázek pixel po pixelu`,
  ).toEqual([]);
}

/** Pro každý nejhorší obrys a obě pořadí barev zkontroluje vzor z `places`. */
function expectPatternWithinLimit(
  places: (regions: RegionMap) => Array<number | null>,
  minColors: number,
): void {
  const orders = tableOrders();
  for (const { name, regions } of worstCaseOutlines()) {
    const placePixels = places(regions);
    for (const order of orders) {
      const what = `${name}, ${order.name}`;
      const pixels = inTableOrder(placePixels, order);
      expect(usedColors(pixels).length, `${what}: počet barev ve vzoru`).toBeGreaterThanOrEqual(
        minColors,
      );
      expectWithinLimit(what, regions, pixels, order.colors[order.colors.length - 1] ?? 0);
    }
  }
}

/** Kolik pruhů W stř má vzor V na šířce 1024 px (#96: W stř = šířka / 30). */
const STRIPE_COUNT = 30;

describe('#116 AC6: nejhorší vzory se střídáním přes všechny barvy tabulky se vejdou do 50 000 znaků', () => {
  it(
    'vzor V (#92, #100) se vejde a přečte se beze ztráty',
    () => {
      expectPatternWithinLimit(stripePlaces, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzor V nakreslený pastelkou (#93) se vejde a přečte se beze ztráty',
    () => {
      expectPatternWithinLimit(crayonPlaces, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'svislé tahy duhou (#97) se vejdou a přečtou se beze ztráty',
    () => {
      expectPatternWithinLimit((regions) => verticalStrokePlaces(regions, 'rainbow'), 1);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'svislé tahy razítkovým fixem (#98) se vejdou a přečtou se beze ztráty',
    () => {
      expectPatternWithinLimit((regions) => verticalStrokePlaces(regions, 'stamp'), STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek puntíků přes vzor V (#101) se vejde a přečte se beze ztráty',
    () => {
      expectPatternWithinLimit((regions) => {
        const dots = dotPixels(regions.width, regions.height);
        return patternOverStripes(regions, (x, y) => dots.isDot(x, y));
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek proužků přes vzor V (#102) se vejde a přečte se beze ztráty',
    () => {
      expectPatternWithinLimit((regions) => {
        const stripes = stripePixels(regions.width, regions.height);
        return patternOverStripes(regions, (x, y) => stripes.isStripe(x, y));
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek jisker přes vzor V (#103) se vejde a přečte se beze ztráty',
    () => {
      expectPatternWithinLimit((regions) => {
        const glitter = glitterPixels(regions.width, regions.height);
        return patternOverStripes(regions, (x, y) => glitter.isSparkle(x, y));
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek spreje přes vzor V (#104) se vejde a přečte se beze ztráty',
    () => {
      expectPatternWithinLimit((regions) => {
        const spray = sprayPixels(regions.width, regions.height);
        return patternOverStripes(regions, (x, y) => spray.isDot(x, y));
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'záznam, který hra uloží po tazích všemi nástroji ve všech barvách jejich sad, se vejde',
    () => {
      const regions = worstCaseOutlines()[2]?.regions as RegionMap;
      const storage = new RecordingStorage();
      const game = openOn(storage, regions);
      let row = 0;
      for (const tool of COLOR_TOOLS) {
        for (let place = 0; place < SET_SIZE; place += 1) {
          giveToolPlace(game, tool, place);
          const y = 4 + row * 8;
          paint(game, [at(10, y), at(1010, y + 4), at(30, y + 6)]);
          row += 1;
        }
      }
      game.suspend();
      const painted = pixelsFrom(game, regions);
      expect(usedColors(painted).length, 'v obrázku je všech 46 barev').toBe(ALL_COLOR_COUNT);

      const saved = [...storage.data.values()]
        .map((record) => ({ record, decoded: decodePicture(record, PICTURE, regions) }))
        .find(({ decoded }) => decoded !== null);
      expect(saved, 'hra uložila obrázek, který jde přečíst').toBeDefined();
      expect(saved?.record.length, 'délka uloženého záznamu').toBeLessThanOrEqual(RECORD_LIMIT);
      expect(
        pixelDifferences(
          saved?.decoded === null || saved === undefined
            ? []
            : pixelsFrom(saved.decoded.colors, regions),
          painted,
          regions.width,
        ),
        'uložený obrázek je stejný jako ve hře',
      ).toEqual([]);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it('limit uložení zůstává 50 000 znaků', () => {
    expect(PICTURE_RECORD_LIMIT).toBe(RECORD_LIMIT);
  });
});
