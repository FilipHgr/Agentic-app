import { describe, expect, it } from 'vitest';

import {
  decodeColorLayer,
  encodeColorLayer,
} from '../../../src/games/coloring/logic/colorLayerCode';
import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import {
  PICTURE_RECORD_LIMIT,
  decodePicture,
  encodePicture,
} from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { dotPixels } from './dotsHelpers';
import { drawWith } from './drawingToolHelpers';
import {
  LAYER_WIDTH,
  pixelDifferences,
  usedColors,
  worstCaseOutlines,
} from './extendedPaletteHelpers';
import { glitterPixels } from './glitterHelpers';
import {
  LEGACY_BEFORE_111_LINE_SIZE,
  LEGACY_BEFORE_111_STORAGE,
  legacyBefore111Pixels,
  legacyBefore111Regions,
} from './legacyBefore111RecordFixture';
import { LEGACY_P2_STORAGE, legacyP2Pixels, legacyP2Regions } from './legacyP2RecordFixture';
import {
  LEGACY_P3_DOTS_LINE_SIZE,
  LEGACY_P3_DOTS_STORAGE,
  legacyP3DotsPixels,
  legacyP3DotsRegions,
} from './legacyP3DotsRecordFixture';
import {
  LEGACY_P3_GLITTER_LINE_SIZE,
  LEGACY_P3_GLITTER_STORAGE,
  legacyP3GlitterPixels,
  legacyP3GlitterRegions,
} from './legacyP3GlitterRecordFixture';
import {
  LEGACY_P3_LINE_SIZE,
  LEGACY_P3_STORAGE,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
import {
  LEGACY_P3_STRIPES_LINE_SIZE,
  LEGACY_P3_STRIPES_STORAGE,
  legacyP3StripesPixels,
  legacyP3StripesRegions,
} from './legacyP3StripesRecordFixture';
import { LEGACY_P1_RECORD, legacyPixels, legacyRegions } from './legacyRecordFixture';
import { TOOL_NAMES } from './lineSizeHelpers';
import {
  DATA_FIELD,
  RECORD_LIMIT,
  colorsOf,
  pixelsFrom,
  rewrittenRecord,
} from './manyColorsHelpers';
import {
  PICTURE,
  RecordingStorage,
  keepOnlyRecordsBefore110,
  openOn,
  paint,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import { stripePixels } from './stripesHelpers';
import { at } from './strokeHelpers';
import { tinySprayPixels, tinyStrokeWidth } from './thinnestHelpers';
import { COLOR_TOOLS } from './toolColorsHelpers';
import { ALL_COLOR_COUNT, SET_SIZE, allSetColors, giveToolPlace } from './toolColorSetsHelpers';

/**
 * Testy uložení k #118 (nejtenčí tloušťka čáry v Omalovánkách): AC5
 * (záznamy obrázků p1 až p4 se otevřou pixel po pixelu stejně i po výběru
 * nejtenčí, dřív uložená malá, střední a velká zůstane) a AC6 (dnešní testy
 * limitu uložení znovu s nejtenčí velikostí místo malé nebo střední).
 *
 * AC6: každý vzor se kreslí na třech nejhorších obrysech 1024 × 768 jako
 * dnešní testy limitu (prázdný, mřížka, domeček) a barví ve třech pořadích:
 * 12 barev štětce dokola (#91 AC6, vzorky nástrojů #96–#104), všech 46 barev
 * sad po sloupcích tabulky a střídáním vzdálených barev (#116 AC6). Každý
 * záznam má nejvýš 50 000 znaků a přečte se pixel po pixelu stejně. Limit
 * ani vzory se nemění, jen tahy jsou nejtenčí a jdou těsně vedle sebe:
 * - vzor V (svislé pruhy šířky W stř zleva bez mezer) nakreslený svislými
 *   tahy štětce a pastelky nejtenčí, tahy v pruhu tak hustě, aby se stopy
 *   dotýkaly (štětec 4 tahy na pruh, pastelka 7),
 * - svislé tahy duhou a razítkovým fixem přes celou plochu, vedle sebe po
 *   šířce stopy nejtenčí (duha W nejtenčí, hvězdičky 1,5 W nejtenčí),
 * - vzorky puntíků, proužků, jisker a spreje přes V: pixely, které zabarví
 *   tah nejtenčí vedený přímo přes ně, mají místo barvy pruhu barvu o jednu
 *   dál. Puntíkový a proužkový fix a třpytky malují u nejtenčí jako u malé
 *   (#118 AC2), jejich vzorek je proto vzorek malé velikosti.
 * Šířky W jsou opsané ze zadání (`thinnestHelpers.ts`), aby test neměřil
 * potichu jinou šířku; že hra opravdu maluje touto šířkou, hlídá první
 * test a testy chování v `thinnestLineSize.test.ts`.
 *
 * Barva tahu je jeho číslo (pruh, sloupec) a převede se na barvu pořadí
 * dokola přes všechny barvy pořadí. Naměřeno v zadání: nejvíc 41 769 znaků
 * (sprej přes V, 46 vzdálených barev, prázdný obrys), razítko svisle těsně
 * 41 014 (měřeno s místy dokola přes 64 míst jako v #115).
 *
 * Výjimka z AC6: vodorovné tahy pastelkou různými barvami se nezkouší
 * (samostatný úkol).
 *
 * Navržené rozhraní: žádné nové.
 */

/** Limit z #92 AC6 se nemění (opsáno ze zadání, ne konstanta z kódu). */
const LIMIT = 50_000;

/** Pruhy vzoru V jsou široké W stř (#96), na šířce 1024 px jich je 30. */
const STRIPE_COUNT = 30;

/** Šířka W nejtenčí štětce a pastelky na vrstvě 1024 px (#118 AC2). */
const TINY_W = tinyStrokeWidth('brush', LAYER_WIDTH);

/** Pořadí barev: název a barva podle čísla tahu (dokola). */
interface ColorOrder {
  readonly name: string;
  readonly colors: readonly number[];
}

let cachedOrders: ColorOrder[] | undefined;

/** 12 barev štětce dokola, 46 barev sad po sloupcích tabulky a střídáním vzdálených barev. */
function colorOrders(): ColorOrder[] {
  if (cachedOrders !== undefined) {
    return cachedOrders;
  }
  const byColumns = allSetColors(openOn(new RecordingStorage(), twoHalves()));
  expect(byColumns.length, 'kontrola: v sadách je 46 barev').toBe(ALL_COLOR_COUNT);
  const far = byColumns.map((_, place) =>
    place % 2 === 0
      ? (byColumns[place / 2] ?? 0)
      : (byColumns[byColumns.length - 1 - (place - 1) / 2] ?? 0),
  );
  cachedOrders = [
    { name: '12 barev štětce', colors: PALETTE.map((_, index) => index) },
    { name: '46 barev po sloupcích tabulky', colors: byColumns },
    { name: '46 barev, střídání vzdálených', colors: far },
  ];
  return cachedOrders;
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

/** Polohy tahů v pruhu [left, right): stopy šířky `traceWidth` se dotýkají (jako v #91 AC6). */
function strokeColumns(left: number, right: number, traceWidth: number): number[] {
  const count = Math.max(1, Math.ceil((right - left) / traceWidth));
  if (count === 1) {
    return [(left + right) / 2];
  }
  const first = left + traceWidth / 2;
  const last = right - traceWidth / 2;
  return Array.from(
    { length: count },
    (_, index) => first + ((last - first) * index) / (count - 1),
  );
}

/** Svislý tah nástrojem `tool` šířky W `width` číslem `place` od `top` do `bottom`. */
function verticalStroke(
  coloring: Coloring,
  options: { id: number; x: number; top: number; bottom: number; place: number },
  tool: ToolId,
  width: number,
): void {
  const { id, x, top, bottom, place } = options;
  coloring.pointerDown({ id, x, y: top, kind: 'touch' }, place, tool, width);
  for (let y = top + 16; y < bottom; y += 16) {
    coloring.pointerMove({ id, x, y, kind: 'touch' });
  }
  coloring.pointerMove({ id, x, y: bottom, kind: 'touch' });
  coloring.pointerUp(id);
}

/**
 * Vzor V nakreslený nástrojem `tool` nejtenčí: v každém pruhu W stř svislé
 * tahy těsně vedle sebe číslem pruhu, nový tah v každém souvislém úseku
 * sloupce mimo obrys (tah se ořízne do oblasti, kde začal).
 */
function tinyV(regions: RegionMap, tool: 'brush' | 'crayon'): Array<number | null> {
  const coloring = createColoring(regions);
  const stripeWidth = regions.width / STRIPE_COUNT;
  const traceWidth = (tool === 'crayon' ? 0.5 : 1) * TINY_W;
  let id = 1;
  for (let stripe = 0; stripe * stripeWidth < regions.width; stripe += 1) {
    const left = stripe * stripeWidth;
    const right = Math.min(regions.width, left + stripeWidth);
    for (const x of strokeColumns(left, right, traceWidth)) {
      for (const [top, bottom] of freeRuns(regions, Math.floor(x))) {
        verticalStroke(
          coloring,
          { id, x, top: top + 0.5, bottom: bottom + 0.5, place: stripe },
          tool,
          TINY_W,
        );
        id += 1;
      }
    }
  }
  return pixelsFrom(coloring, regions);
}

/**
 * Svislé tahy přes celou plochu shora dolů nástrojem `tool` nejtenčí, vedle
 * sebe po `spacing` px (šířka stopy), tah `n` číslem `n`. Duha číslo
 * nepoužije a maluje svými barvami; ty se pak berou jako čísla tahů.
 */
function tinyVerticalStrokes(
  regions: RegionMap,
  tool: 'rainbow' | 'stamp',
  spacing: number,
): Array<number | null> {
  const coloring = createColoring(regions);
  let id = 1;
  for (let column = 0; column * spacing < regions.width; column += 1) {
    const x = (column + 0.5) * spacing;
    verticalStroke(
      coloring,
      { id, x, top: 0, bottom: regions.height, place: column },
      tool,
      TINY_W,
    );
    id += 1;
  }
  return pixelsFrom(coloring, regions);
}

/** Vzor V v číslech pruhů (pruh pixelu podle jeho středu), obrys prázdný. */
function stripeNumbers(regions: RegionMap): Array<number | null> {
  const stripeWidth = regions.width / STRIPE_COUNT;
  return pixelsFrom(
    { colorAt: (x, y) => (isFree(regions, x, y) ? Math.floor((x + 0.5) / stripeWidth) : null) },
    regions,
  );
}

/** Vzorek nástroje přes V: pixel vzorku má číslo o jedno dál než jeho pruh. */
function sampleOverV(
  regions: RegionMap,
  isSamplePixel: (x: number, y: number) => boolean,
): Array<number | null> {
  return stripeNumbers(regions).map((place, index) => {
    if (place === null) {
      return null;
    }
    const x = index % regions.width;
    const y = Math.floor(index / regions.width);
    return isSamplePixel(x, y) ? place + 1 : place;
  });
}

/** Čísla tahů převedená na barvy pořadí `order` dokola. */
function inOrder(places: ReadonlyArray<number | null>, order: ColorOrder): Array<number | null> {
  return places.map((place) =>
    place === null ? null : (order.colors[place % order.colors.length] ?? null),
  );
}

/** Jaký díl pixelů mimo obrys má barvu. */
function paintedShare(regions: RegionMap, places: ReadonlyArray<number | null>): number {
  let free = 0;
  let painted = 0;
  places.forEach((place, index) => {
    if (isFree(regions, index % regions.width, Math.floor(index / regions.width))) {
      free += 1;
      painted += place === null ? 0 : 1;
    }
  });
  return painted / free;
}

/** Obrázek s pixely `pixels` má záznam nejvýš 50 000 znaků a přečte se pixel po pixelu. */
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
  expect(record.length, `${what}: délka záznamu`).toBeLessThanOrEqual(LIMIT);
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

/**
 * Pro každý nejhorší obrys a každé pořadí barev zkontroluje vzor
 * z `places`. `minPlaces` (kolik různých čísel tahů vzor aspoň má, na
 * mřížce u duhy jen 1) a `minShare` (jaký díl obrázku vzor pokrývá) hlídají,
 * že test neměří skoro prázdný obrázek.
 */
function expectPatternWithinLimit(
  places: (regions: RegionMap) => Array<number | null>,
  check: { minPlaces: number; minShare: number },
): void {
  for (const { name, regions } of worstCaseOutlines()) {
    const placePixels = places(regions);
    expect(paintedShare(regions, placePixels), `${name}: vzor pokrývá obrázek`).toBeGreaterThan(
      check.minShare,
    );
    for (const order of colorOrders()) {
      const what = `${name}, ${order.name}`;
      const pixels = inOrder(placePixels, order);
      expect(usedColors(pixels).length, `${what}: počet barev ve vzoru`).toBeGreaterThanOrEqual(
        Math.min(check.minPlaces, order.colors.length),
      );
      expectWithinLimit(what, regions, pixels, order.colors[order.colors.length - 1] ?? 0);
    }
  }
}

describe('#118 AC6: vzory nakreslené nejtenčí velikostí se vejdou do 50 000 znaků', () => {
  it('vzory se kreslí šířkou W nejtenčí, kterou maluje hra (1/100 šířky plochy)', () => {
    expect(brushWidthFor(LAYER_WIDTH, 'tiny'), 'W nejtenčí ve hře').toBeCloseTo(TINY_W, 6);
    expect(TINY_W, 'W nejtenčí ze zadání').toBeCloseTo(LAYER_WIDTH / 100, 6);
  });

  it('vzor V (#91 AC6, #116 AC6) nakreslený štětcem nejtenčí se vejde a přečte se beze ztráty', () => {
    expectPatternWithinLimit((regions) => tinyV(regions, 'brush'), {
      minPlaces: STRIPE_COUNT,
      minShare: 0.9,
    });
  });

  it('vzor V (#91 AC6, #93, #116 AC6) nakreslený pastelkou nejtenčí se vejde a přečte se beze ztráty', () => {
    expectPatternWithinLimit((regions) => tinyV(regions, 'crayon'), {
      minPlaces: STRIPE_COUNT,
      minShare: 0.5,
    });
  });

  it('svislé tahy duhou nejtenčí těsně vedle sebe (#97, #116 AC6) se vejdou a přečtou se beze ztráty', () => {
    // Na mřížce tah duhy skončí u první čáry a má jen první barvu duhy (jako v #97 AC5).
    expectPatternWithinLimit((regions) => tinyVerticalStrokes(regions, 'rainbow', TINY_W), {
      minPlaces: 1,
      minShare: 0.05,
    });
  });

  it('svislé tahy razítkovým fixem nejtenčí těsně vedle sebe (#98, #116 AC6) se vejdou a přečtou se beze ztráty', () => {
    expectPatternWithinLimit((regions) => tinyVerticalStrokes(regions, 'stamp', 1.5 * TINY_W), {
      minPlaces: STRIPE_COUNT,
      minShare: 0.01,
    });
  });

  it('vzorek puntíků přes V nejtenčí (#101, #116 AC6) se vejde a přečte se beze ztráty', () => {
    expectPatternWithinLimit(
      (regions) => {
        const dots = dotPixels(regions.width, regions.height, 'small');
        return sampleOverV(regions, (x, y) => dots.isDot(x, y));
      },
      { minPlaces: STRIPE_COUNT, minShare: 0.9 },
    );
  });

  it('vzorek proužků přes V nejtenčí (#102, #116 AC6) se vejde a přečte se beze ztráty', () => {
    expectPatternWithinLimit(
      (regions) => {
        const stripes = stripePixels(regions.width, regions.height, 'small');
        return sampleOverV(regions, (x, y) => stripes.isStripe(x, y));
      },
      { minPlaces: STRIPE_COUNT, minShare: 0.9 },
    );
  });

  it('vzorek jisker přes V nejtenčí (#103, #116 AC6) se vejde a přečte se beze ztráty', () => {
    expectPatternWithinLimit(
      (regions) => {
        const glitter = glitterPixels(regions.width, regions.height, 'small');
        return sampleOverV(regions, (x, y) => glitter.isSparkle(x, y));
      },
      { minPlaces: STRIPE_COUNT, minShare: 0.9 },
    );
  });

  it('vzorek spreje přes V nejtenčí (#104, #116 AC6) se vejde a přečte se beze ztráty', () => {
    expectPatternWithinLimit(
      (regions) => {
        const isSpray = tinySprayPixels(regions.width, regions.height);
        return sampleOverV(regions, isSpray);
      },
      { minPlaces: STRIPE_COUNT, minShare: 0.9 },
    );
  });

  it('záznam, který hra uloží po tazích nejtenčí všemi nástroji ve všech barvách sad, se vejde', () => {
    const regions = worstCaseOutlines()[2]?.regions as RegionMap;
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    game.tapLineSize('tiny');
    let row = 0;
    for (const tool of COLOR_TOOLS) {
      for (let place = 0; place < SET_SIZE; place += 1) {
        giveToolPlace(game, tool, place);
        const y = 4 + row * 8;
        paint(game, [at(10, y), at(1010, y + 4), at(30, y + 6)]);
        row += 1;
      }
    }
    expect(game.lineSize(), 'celou dobu se malovalo nejtenčí').toBe('tiny');
    game.suspend();
    const painted = pixelsFrom(game, regions);
    expect(usedColors(painted).length, 'v obrázku je všech 46 barev').toBe(ALL_COLOR_COUNT);

    const saved = [...storage.data.values()]
      .map((record) => ({ record, decoded: decodePicture(record, PICTURE, regions) }))
      .find(({ decoded }) => decoded !== null);
    expect(saved, 'hra uložila obrázek, který jde přečíst').toBeDefined();
    expect(saved?.record.length, 'délka uloženého záznamu').toBeLessThanOrEqual(LIMIT);
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
  });

  it('limit uložení zůstává 50 000 znaků', () => {
    expect(PICTURE_RECORD_LIMIT).toBe(LIMIT);
    expect(RECORD_LIMIT).toBe(LIMIT);
  });
});

/** Uložený stav hry před #118 a co z něj má hra po otevření ukázat. */
interface SavedBefore {
  readonly name: string;
  readonly storage: () => RecordingStorage;
  readonly regions: () => RegionMap;
  readonly pixels: () => Array<number | null>;
  readonly lineSize: string;
}

function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}

/** Úložiště se starým záznamem p1 pod klíčem, který tam hra sama zapíše (jako v #93 AC6). */
function storageWithP1(): RecordingStorage {
  const storage = new RecordingStorage();
  const game = openOn(storage, legacyRegions());
  game.tapColor(4);
  game.suspend();
  keepOnlyRecordsBefore110(storage);
  storage.rewriteAll((value) => (value.startsWith('p') ? LEGACY_P1_RECORD : value));
  return storage;
}

/**
 * Záznam obrázku `record` přepsaný do formátu p4 (stejné pixely, kódování
 * p4). Od #119 hra ukládá formátem p5, obrázek „uložený před #118“ proto
 * vznikne přepsáním. Jiné záznamy úložiště zůstanou, jak jsou.
 */
function asP4Record(record: string, regions: RegionMap): string {
  const fields = record.split('|');
  if (fields[0] !== 'p5') {
    return record;
  }
  const layer = decodeColorLayer(regions, fields[DATA_FIELD] ?? '', 'p5');
  if (layer === null) {
    return record;
  }
  return (
    rewrittenRecord(record, (body) => {
      body[0] = 'p4';
      body[DATA_FIELD] = encodeColorLayer(regions, layer, 'p4');
    }) ?? record
  );
}

/**
 * Obrázek ve formátu p4, jak ho uložila hra před #118 po tazích všemi
 * nástroji a velkou velikostí (od #119 přepsaný z formátu p5, viz
 * `asP4Record`). Pixely si pamatuje hra, která ho namalovala.
 */
function savedP4(): { storage: RecordingStorage; pixels: Array<number | null> } {
  const regions = twoHalves();
  const storage = new RecordingStorage();
  const game = openOn(storage, regions);
  game.tapLineSize('large');
  const tools: readonly ToolId[] = [
    'brush',
    'marker',
    'crayon',
    'rainbow',
    'stamp',
    'dots',
    'stripes',
    'glitter',
    'spray',
    'eraser',
  ];
  tools.forEach((tool, index) => {
    const y = 15 + index * 18;
    drawWith(game, tool, index % PALETTE.length, [at(10, y), at(290, y + 6)]);
  });
  game.suspend();
  storage.rewriteAll((value) => asP4Record(value, regions));
  return { storage, pixels: pixelsOf(game, regions) };
}

let p4: { storage: RecordingStorage; pixels: Array<number | null> } | undefined;

function p4Saved(): { storage: RecordingStorage; pixels: Array<number | null> } {
  p4 ??= savedP4();
  return p4;
}

function copyOf(source: RecordingStorage): RecordingStorage {
  return storageWith([...source.data.entries()]);
}

const SAVED_BEFORE: readonly SavedBefore[] = [
  {
    name: 'p1 z #92',
    storage: storageWithP1,
    regions: legacyRegions,
    pixels: legacyPixels,
    lineSize: 'medium',
  },
  {
    name: 'p2 z #93',
    storage: () => storageWith(LEGACY_P2_STORAGE),
    regions: legacyP2Regions,
    pixels: legacyP2Pixels,
    lineSize: 'medium',
  },
  {
    name: 'p3 z #100',
    storage: () => storageWith(LEGACY_P3_STORAGE),
    regions: legacyP3Regions,
    pixels: legacyP3Pixels,
    lineSize: LEGACY_P3_LINE_SIZE,
  },
  {
    name: 'p3 s puntíky',
    storage: () => storageWith(LEGACY_P3_DOTS_STORAGE),
    regions: legacyP3DotsRegions,
    pixels: legacyP3DotsPixels,
    lineSize: LEGACY_P3_DOTS_LINE_SIZE,
  },
  {
    name: 'p3 s proužky',
    storage: () => storageWith(LEGACY_P3_STRIPES_STORAGE),
    regions: legacyP3StripesRegions,
    pixels: legacyP3StripesPixels,
    lineSize: LEGACY_P3_STRIPES_LINE_SIZE,
  },
  {
    name: 'p3 s třpytkami',
    storage: () => storageWith(LEGACY_P3_GLITTER_STORAGE),
    regions: legacyP3GlitterRegions,
    pixels: legacyP3GlitterPixels,
    lineSize: LEGACY_P3_GLITTER_LINE_SIZE,
  },
  {
    name: 'p3 před #111',
    storage: () => storageWith(LEGACY_BEFORE_111_STORAGE),
    regions: legacyBefore111Regions,
    pixels: legacyBefore111Pixels,
    lineSize: LEGACY_BEFORE_111_LINE_SIZE,
  },
  {
    name: 'p4 přepsaný z obrázku hry',
    storage: () => copyOf(p4Saved().storage),
    regions: twoHalves,
    pixels: () => p4Saved().pixels,
    lineSize: 'large',
  },
];

describe('#118 AC5: obrázky a velikosti uložené před #118', () => {
  it('kontrola: obrázek hry přepsaný do p4 je uložený ve formátu p4', () => {
    const formats = [...p4Saved().storage.data.values()]
      .filter((value) => decodePicture(value, PICTURE, twoHalves()) !== null)
      .map((value) => value.split('|')[0]);
    expect(formats).toEqual(['p4']);
  });

  it('záznamy p1 až p4 se otevřou pixel po pixelu stejně a s uloženou velikostí', () => {
    for (const saved of SAVED_BEFORE) {
      const regions = saved.regions();
      const game = openOn(saved.storage(), regions);
      expect(
        pixelDifferences(pixelsOf(game, regions), saved.pixels(), regions.width),
        `${saved.name}: obrázek`,
      ).toEqual([]);
      expect(game.lineSize(), `${saved.name}: velikost`).toBe(saved.lineSize);
    }
  });

  it('po výběru nejtenčí a návratu do hry jsou obrázky p1 až p4 pixel po pixelu stejné', () => {
    for (const saved of SAVED_BEFORE) {
      const regions = saved.regions();
      const storage = saved.storage();
      const game = openOn(storage, regions);
      game.tapLineSize('tiny');
      game.suspend();

      const again = openOn(storage, regions);
      expect(
        pixelDifferences(pixelsOf(again, regions), saved.pixels(), regions.width),
        `${saved.name}: obrázek`,
      ).toEqual([]);
      expect(again.lineSize(), `${saved.name}: nejtenčí`).toBe('tiny');
    }
  });

  it('v obrázcích p1 až p4 jde malovat nejtenčí a po návratu je obrázek stejný jako ve hře', () => {
    for (const saved of SAVED_BEFORE) {
      const regions = saved.regions();
      const storage = saved.storage();
      const game = openOn(storage, regions);
      game.tapLineSize('tiny');
      drawWith(game, 'brush', 7, [at(5, 5), at(regions.width / 3, regions.height - 5)]);
      const drawn = pixelsOf(game, regions);
      const before = saved.pixels();
      expect(
        drawn.filter((color, index) => color !== before[index]).length,
        `${saved.name}: tah nejtenčí něco zabarvil`,
      ).toBeGreaterThan(0);
      game.suspend();

      const again = openOn(storage, regions);
      expect(
        pixelDifferences(pixelsOf(again, regions), drawn, regions.width),
        `${saved.name}: po návratu`,
      ).toEqual([]);
    }
  });

  it('tah po otevření starého záznamu maluje uloženou velikostí stejně jako hra, ve které byla vybraná', () => {
    for (const saved of SAVED_BEFORE) {
      const regions = saved.regions();
      const path = [at(4, 4), at(regions.width / 3, regions.height / 2)];
      const reopened = openOn(saved.storage(), regions);
      drawWith(reopened, 'brush', 7, path);

      const reference = openOn(saved.storage(), regions);
      reference.tapLineSize(reopened.lineSize());
      drawWith(reference, 'brush', 7, path);

      expect(
        pixelDifferences(pixelsOf(reopened, regions), pixelsOf(reference, regions), regions.width),
        `${saved.name}: ${TOOL_NAMES.brush}`,
      ).toEqual([]);
    }
  });
});
