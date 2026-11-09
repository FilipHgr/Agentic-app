import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { PICTURE_RECORD_LIMIT } from '../../../src/games/coloring/logic/savedPicture';
import { dotPixels } from './dotsHelpers';
import {
  LAYER_HEIGHT,
  LAYER_WIDTH,
  pixelDifferences,
  usedColors,
  worstCaseOutlines,
} from './extendedPaletteHelpers';
import { glitterPixels } from './glitterHelpers';
import {
  COLOR_ORDERS,
  FAR_ORDER,
  RECORD_LIMIT,
  RESERVED_RECORD_LIMIT,
  TEST_PALETTE_SIZE,
  crayonPlaces,
  decodeWithTestPalette,
  encodeWithTestPalette,
  inOrder,
  openWithTestPalette,
  patternOverStripes,
  pixelsFrom,
  stripePlaces,
  verticalStrokePlaces,
} from './manyColorsHelpers';
import { RAINBOW } from './rainbowHelpers';
import { RecordingStorage, paint } from './savedPictureHelpers';
import { sprayPixels } from './sprayHelpers';
import { stripePixels } from './stripesHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #115 AC2: nejhorší vzory všech testů limitu (#92, #93, #97–#104)
 * se zkušební paletou 64 barev mají záznam nejvýš 45 000 znaků (rezerva
 * 10 % pod limitem 50 000, otázka 1 schválená podle doporučení) a přečtou
 * se beze ztráty. Limit se nemění.
 *
 * Každý vzor se měří na stejných nejhorších obrysech 1024 × 768 jako
 * stávající testy limitu (prázdný, mřížka, domeček) ve dvou pořadích
 * barev: vzestupně (0, 1, 2, … dokola, jako dnes) a střídáním vzdálených
 * barev (0, 63, 1, 62, …). Tvar vzorů je stejný jako ve stávajících
 * testech, jen se barvy střídají přes 64 míst (`manyColorsHelpers.ts`).
 * #99 (nedávné barvy) a #100 (12 barev) vlastní vzor nemají: #100 měří
 * vzor V a vzory pastelky, duhy a razítek, které jsou tu taky.
 *
 * Vzor V má na šířce 1024 px jen 30 pruhů šířky W stř, vzestupné pořadí
 * tak použije barvy 0 až 29 (u vzorků nástrojů 0 až 30). Vysoké barvy
 * (až 63) se do obrázku dostanou pořadím vzdálených barev.
 *
 * Vybraná barva je v záznamu nejvyšší barva palety (63), aby i hlavička
 * nesla nejdelší hodnotu.
 */

/** Jeden vzor nakreslí všechny tři obrázky 1024 × 768 dvakrát, delší čas jen pro tyto testy. */
const PATTERN_TEST_TIMEOUT_MS = 60_000;

const HIGHEST_COLOR = TEST_PALETTE_SIZE - 1;

/**
 * Na mřížce tah duhy skončí u první čáry a má jen první barvu duhy, stačí
 * tedy, že obrázek není prázdný (jako v #97 AC5).
 */
const MIN_RAINBOW_COLORS = 1;

/** Kolik pruhů W stř má vzor V na šířce 1024 px (opsáno ze zadání #96: W stř = šířka / 30). */
const STRIPE_COUNT = 30;

/**
 * Obrázek s pixely `pixels` má záznam nejvýš 45 000 znaků a přečte se
 * pixel po pixelu i s vybranou barvou.
 */
function expectWithinReserve(
  what: string,
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
): void {
  const record = encodeWithTestPalette(regions, pixels, HIGHEST_COLOR);
  expect(record.length, `${what}: délka záznamu`).toBeLessThanOrEqual(RESERVED_RECORD_LIMIT);

  const decoded = decodeWithTestPalette(record, regions);
  expect(decoded, `${what}: záznam jde přečíst`).not.toBeNull();
  expect(decoded?.selectedColor, `${what}: vybraná barva`).toBe(HIGHEST_COLOR);
  expect(
    pixelDifferences(
      decoded === null ? [] : pixelsFrom(decoded.colors, regions),
      pixels,
      regions.width,
    ),
    `${what}: stejný obrázek pixel po pixelu`,
  ).toEqual([]);
}

/**
 * Pro každý nejhorší obrys a obě pořadí barev zkontroluje vzor z `places`
 * (místa v řadě) a pravidlo z AC2. `minColors` hlídá, že vzor opravdu
 * střídá barvy a test neměří skoro prázdný obrázek.
 */
function expectPatternWithinReserve(
  places: (regions: RegionMap) => Array<number | null>,
  minColors: number,
): void {
  for (const { name, regions } of worstCaseOutlines()) {
    expect(regions.width, `${name}: vrstva jako u ostatních vzorů`).toBe(LAYER_WIDTH);
    expect(regions.height, `${name}: vrstva jako u ostatních vzorů`).toBe(LAYER_HEIGHT);
    const placePixels = places(regions);
    for (const order of COLOR_ORDERS) {
      const what = `${name}, ${order.name}`;
      const pixels = inOrder(placePixels, order);
      const used = usedColors(pixels);
      expect(used.length, `${what}: počet barev ve vzoru`).toBeGreaterThanOrEqual(minColors);
      if (order === FAR_ORDER && minColors >= STRIPE_COUNT) {
        expect(used, `${what}: vzor má i nejvyšší barvu`).toContain(HIGHEST_COLOR);
      }
      expectWithinReserve(what, regions, pixels);
    }
  }
}

/** Kolik pixelů se liší od vzoru V (díl vzorku nástroje). */
function shareOfPattern(regions: RegionMap, places: ReadonlyArray<number | null>): number {
  const v = stripePlaces(regions);
  const changed = places.filter((place, index) => place !== v[index]).length;
  const free = v.filter((place) => place !== null).length;
  return changed / free;
}

describe('#115 AC2: nejhorší vzory s 64 barvami mají záznam nejvýš 45 000 znaků', () => {
  it(
    'vzor V (#92, #100) se vejde do 45 000 znaků a přečte se beze ztráty',
    () => {
      expectPatternWithinReserve(stripePlaces, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzor V nakreslený pastelkou (#93) se vejde do 45 000 znaků a přečte se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => {
        const places = crayonPlaces(regions);
        // Pastelka má nechat zrno, jinak by test měřil jen plnou barvu.
        const empty = places.filter((place) => place === null).length;
        expect(empty / places.length, 'v obrázku jsou mezery zrna').toBeGreaterThan(0.1);
        return places;
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'svislé tahy duhou přes celou plochu (#97) se vejdou do 45 000 znaků a přečtou se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => {
        const places = verticalStrokePlaces(regions, 'rainbow');
        for (const place of usedColors(places)) {
          expect(RAINBOW, 'duha maluje jen svých 6 barev').toContain(place);
        }
        return places;
      }, MIN_RAINBOW_COLORS);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'svislé tahy razítkovým fixem (#98) se vejdou do 45 000 znaků a přečtou se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => verticalStrokePlaces(regions, 'stamp'), STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek puntíků přes vzor V (#101) se vejde do 45 000 znaků a přečte se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => {
        const dots = dotPixels(regions.width, regions.height);
        const places = patternOverStripes(regions, (x, y) => dots.isDot(x, y));
        expect(shareOfPattern(regions, places), 'díl pixelů puntíků').toBeGreaterThan(0.25);
        return places;
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek proužků přes vzor V (#102) se vejde do 45 000 znaků a přečte se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => {
        const stripes = stripePixels(regions.width, regions.height);
        const places = patternOverStripes(regions, (x, y) => stripes.isStripe(x, y));
        expect(shareOfPattern(regions, places), 'díl pixelů proužků').toBeGreaterThan(0.4);
        return places;
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek jisker přes vzor V (#103) se vejde do 45 000 znaků a přečte se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => {
        const glitter = glitterPixels(regions.width, regions.height);
        const places = patternOverStripes(regions, (x, y) => glitter.isSparkle(x, y));
        expect(shareOfPattern(regions, places), 'díl pixelů jisker').toBeGreaterThan(0.04);
        return places;
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it(
    'vzorek spreje přes vzor V (#104) se vejde do 45 000 znaků a přečte se beze ztráty',
    () => {
      expectPatternWithinReserve((regions) => {
        const spray = sprayPixels(regions.width, regions.height);
        const places = patternOverStripes(regions, (x, y) => spray.isDot(x, y));
        expect(shareOfPattern(regions, places), 'díl pixelů spreje').toBeGreaterThanOrEqual(0.5);
        return places;
      }, STRIPE_COUNT);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it('obrázek celý v jedné barvě i prázdný obrázek se vejdou do 45 000 znaků', () => {
    const regions = worstCaseOutlines()[0]?.regions as RegionMap;
    for (const [name, color] of [
      ['celý v barvě 0', 0],
      ['celý v barvě 63', HIGHEST_COLOR],
      ['prázdný', null],
    ] as const) {
      const pixels = pixelsFrom({ colorAt: () => color }, regions);
      expectWithinReserve(name, regions, pixels);
    }
  });

  it(
    'záznam, který hra uloží po tazích všemi 64 barvami, má nejvýš 45 000 znaků',
    () => {
      const regions = worstCaseOutlines()[2]?.regions as RegionMap;
      const storage = new RecordingStorage();
      const game = openWithTestPalette(storage, regions);
      for (let color = 0; color < TEST_PALETTE_SIZE; color += 1) {
        game.tapColor(color);
        const y = 6 + color * 12;
        paint(game, [at(10, y), at(1010, y + 6), at(30, y + 10)]);
      }
      game.suspend();
      const painted = pixelsFrom(game, regions);
      expect(usedColors(painted), 'v obrázku je všech 64 barev').toHaveLength(TEST_PALETTE_SIZE);

      const records = [...storage.data.values()];
      const saved = records
        .map((record) => ({ record, decoded: decodeWithTestPalette(record, regions) }))
        .find(({ decoded }) => decoded !== null);
      expect(saved, 'hra uložila obrázek, který jde přečíst').toBeDefined();
      expect(saved?.record.length, 'délka uloženého záznamu').toBeLessThanOrEqual(
        RESERVED_RECORD_LIMIT,
      );
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
      expect(saved?.decoded?.selectedColor, 'vybraná barva').toBe(HIGHEST_COLOR);
    },
    PATTERN_TEST_TIMEOUT_MS,
  );

  it('limit uložení zůstává 50 000 znaků', () => {
    expect(PICTURE_RECORD_LIMIT).toBe(RECORD_LIMIT);
  });
});
