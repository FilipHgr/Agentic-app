import { describe, expect, it } from 'vitest';

import { createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import {
  PICTURE_RECORD_LIMIT,
  decodePicture,
} from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { drawWith } from './drawingToolHelpers';
import { LAYER_HEIGHT, LAYER_WIDTH, pixelDifferences, usedColors } from './extendedPaletteHelpers';
import {
  LEGACY_BEFORE_111_RECORD,
  LEGACY_BEFORE_111_STORAGE,
  LEGACY_BEFORE_111_TOOL_COLORS,
  legacyBefore111Pixels,
  legacyBefore111Regions,
} from './legacyBefore111RecordFixture';
import {
  LEGACY_P2_RECORD,
  LEGACY_P2_SELECTED_COLOR,
  LEGACY_P2_STORAGE,
  legacyP2Pixels,
  legacyP2Regions,
} from './legacyP2RecordFixture';
import {
  LEGACY_P3_DOTS_RECORD,
  LEGACY_P3_DOTS_SELECTED_COLOR,
  LEGACY_P3_DOTS_STORAGE,
  legacyP3DotsPixels,
  legacyP3DotsRegions,
} from './legacyP3DotsRecordFixture';
import {
  LEGACY_P3_GLITTER_RECORD,
  LEGACY_P3_GLITTER_SELECTED_COLOR,
  LEGACY_P3_GLITTER_STORAGE,
  legacyP3GlitterPixels,
  legacyP3GlitterRegions,
} from './legacyP3GlitterRecordFixture';
import {
  LEGACY_P3_RECORD,
  LEGACY_P3_SELECTED_COLOR,
  LEGACY_P3_STORAGE,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
import {
  LEGACY_P3_STRIPES_RECORD,
  LEGACY_P3_STRIPES_SELECTED_COLOR,
  LEGACY_P3_STRIPES_STORAGE,
  legacyP3StripesPixels,
  legacyP3StripesRegions,
} from './legacyP3StripesRecordFixture';
import {
  LEGACY_P4_LINE_SIZE,
  LEGACY_P4_RECENT_COLORS,
  LEGACY_P4_RECORD,
  LEGACY_P4_SELECTED_COLOR,
  LEGACY_P4_STORAGE,
  LEGACY_P4_TOOL_COLORS,
  legacyP4Pixels,
  legacyP4Regions,
} from './legacyP4RecordFixture';
import {
  LEGACY_P1_RECORD,
  LEGACY_SELECTED_COLOR,
  legacyPixels,
  legacyRegions,
} from './legacyRecordFixture';
import { ALL_SIZES, SIZE_NAMES, TOOL_NAMES } from './lineSizeHelpers';
import {
  DATA_FIELD,
  PICTURE_KEY,
  RECORD_LIMIT,
  TEST_PALETTE_SIZE,
  decodeWithTestPalette,
  encodeWithTestPalette,
  enterWithTestPalette,
  openWithTestPalette,
  pixelsFrom,
  rewrittenRecord,
} from './manyColorsHelpers';
import { drawing } from './outlineFixtures';
import { pick, seededRandom } from './recentColorsHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { TAP_HEIGHT, TAP_WIDTH, tapPicture } from './thinnestHelpers';
import {
  PAINTING_TOOLS,
  matrixOrders,
  paintedShare,
  strokeW,
  tightStrokes,
  inMatrixOrder,
  encodeInOrder,
  decodeInOrder,
} from './tightStrokesHelpers';
import { pickTool } from './toolColorsHelpers';

/**
 * Testy k #119 (obrázek s těsnými tahy se vejde do limitu uložení), které
 * běží rychle: kontrola šířek vzoru z AC1, AC2 (limit se nemění), AC3
 * (pevné záznamy p1 až p4 včetně nového pevného záznamu p4) a AC4
 * (okrajové případy). Matice těsných tahů z AC1 a AC2 je v pomalé skupině
 * (`tightStrokesHorizontal.slow.test.ts`, `tightStrokesVertical.slow.test.ts`),
 * zpřísnění #116 AC6 na 45 000 znaků v `toolColorSetsLimit.test.ts`.
 * AC5 (uložení po tahu nezdrží hru) je ruční kontrola: měření času v CI
 * kolísá.
 *
 * Testy ověřují chování: uložit, obnovit a porovnat pixely. Kódování
 * vrstvy barev neznají. Z hlavičky záznamu znají jen pořadí polí
 * a kontrolní součet (`rewrittenRecord` v `manyColorsHelpers.ts`) a z pole
 * formátu jen to, že nový způsob ukládání nese jiné označení než dřívější
 * p1 až p4 (jinak by starší verze hry nový záznam četla jako p4).
 *
 * Navržené rozhraní: žádné nové. Nový formát dostane nové označení
 * (např. `p5`) v `LayerCodeVersion`, `READABLE_FORMATS` čte dál p1 až p4.
 */

/** Označení formátů, kterými hra ukládala před #119. */
const FORMATS_BEFORE_119: readonly string[] = ['p1', 'p2', 'p3', 'p4'];

/** Pole formátu v záznamu (první pole hlavičky). */
function formatOf(record: string): string {
  return record.split('|')[0] ?? '';
}

/** Úložiště hry se stavem, jak ho zapsala starší verze. */
function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}

/** Pevný záznam obrázku uložený dřívější verzí hry a co z něj má hra ukázat. */
interface LegacyCase {
  readonly name: string;
  readonly record: string;
  readonly storage: ReadonlyArray<readonly [string, string]>;
  readonly regions: () => RegionMap;
  readonly pixels: () => Array<number | null>;
  readonly selectedColor: number;
}

/** Všechny pevné záznamy p1 až p4, včetně nového záznamu p4 z dnešní verze (AC3). */
const LEGACY_CASES: readonly LegacyCase[] = [
  {
    name: 'p1 z #92',
    record: LEGACY_P1_RECORD,
    storage: [[PICTURE_KEY, LEGACY_P1_RECORD]],
    regions: legacyRegions,
    pixels: legacyPixels,
    selectedColor: LEGACY_SELECTED_COLOR,
  },
  {
    name: 'p2 z #93',
    record: LEGACY_P2_RECORD,
    storage: LEGACY_P2_STORAGE,
    regions: legacyP2Regions,
    pixels: legacyP2Pixels,
    selectedColor: LEGACY_P2_SELECTED_COLOR,
  },
  {
    name: 'p3 z #100',
    record: LEGACY_P3_RECORD,
    storage: LEGACY_P3_STORAGE,
    regions: legacyP3Regions,
    pixels: legacyP3Pixels,
    selectedColor: LEGACY_P3_SELECTED_COLOR,
  },
  {
    name: 'p3 s puntíky z #101',
    record: LEGACY_P3_DOTS_RECORD,
    storage: LEGACY_P3_DOTS_STORAGE,
    regions: legacyP3DotsRegions,
    pixels: legacyP3DotsPixels,
    selectedColor: LEGACY_P3_DOTS_SELECTED_COLOR,
  },
  {
    name: 'p3 s proužky z #102',
    record: LEGACY_P3_STRIPES_RECORD,
    storage: LEGACY_P3_STRIPES_STORAGE,
    regions: legacyP3StripesRegions,
    pixels: legacyP3StripesPixels,
    selectedColor: LEGACY_P3_STRIPES_SELECTED_COLOR,
  },
  {
    name: 'p3 s třpytkami z #103',
    record: LEGACY_P3_GLITTER_RECORD,
    storage: LEGACY_P3_GLITTER_STORAGE,
    regions: legacyP3GlitterRegions,
    pixels: legacyP3GlitterPixels,
    selectedColor: LEGACY_P3_GLITTER_SELECTED_COLOR,
  },
  {
    name: 'p3 před #111',
    record: LEGACY_BEFORE_111_RECORD,
    storage: LEGACY_BEFORE_111_STORAGE,
    regions: legacyBefore111Regions,
    pixels: legacyBefore111Pixels,
    selectedColor: LEGACY_BEFORE_111_TOOL_COLORS.brush ?? -1,
  },
  {
    name: 'p4 z dnešní verze (#118)',
    record: LEGACY_P4_RECORD,
    storage: LEGACY_P4_STORAGE,
    regions: legacyP4Regions,
    pixels: legacyP4Pixels,
    selectedColor: LEGACY_P4_SELECTED_COLOR,
  },
];

/** Hra s dnešní paletou (46 barev sad) a hra se zkušební paletou 64 barev. */
const OPENERS: ReadonlyArray<{
  readonly name: string;
  readonly open: (storage: RecordingStorage, regions: RegionMap) => SavedColoring;
  readonly enter: typeof enterColoring;
}> = [
  {
    name: 'dnešní paleta',
    open: (storage, regions) => openOn(storage, regions),
    enter: enterColoring,
  },
  { name: 'paleta 64 barev', open: openWithTestPalette, enter: enterWithTestPalette },
];

/** Stav prázdné omalovánky: vybraná barva hry, která nic uloženého nemá. */
function blankSelectedColor(regions: RegionMap): number {
  return openOn(new RecordingStorage(), regions).palette().selected;
}

/**
 * Otevřená omalovánka je prázdná, s vybranou barvou nové hry, a hra se
 * nezastaví (#92 AC4). `open` otevře hru nad poškozeným úložištěm.
 */
function expectBlankStart(open: () => SavedColoring, regions: RegionMap, what: string): void {
  let painted = -1;
  let selected = -1;
  expect(() => {
    const game = open();
    painted = pixelsFrom(game, regions).filter((color) => color !== null).length;
    selected = game.palette().selected;
  }, `${what}: hra se nezastaví`).not.toThrow();
  expect(painted, `${what}: prázdná omalovánka`).toBe(0);
  expect(selected, `${what}: vybraná barva nové hry`).toBe(blankSelectedColor(regions));
}

/** Kolik vodorovných řádků tahů pastelkou namaluje `paintCrayonRows` (na `twoHalves` těsně u sebe). */
const CRAYON_ROWS = 60;

/**
 * Dítě se zkušební paletou 64 barev namaluje pastelkou nejtenčí těsné
 * vodorovné tahy přes levou polovinu `twoHalves()`, každý jinou barvou
 * dokola přes 64 barev (malý vzor z AC1, který hra sama ukládá po tahu).
 */
function paintCrayonRows(game: SavedColoring): void {
  game.tapLineSize('tiny');
  // Stopa pastelky nejtenčí na ploše 300 px: 0,5 × 3 px = 1,5 px.
  const trace = 0.5 * strokeW('crayon', 'tiny', 300);
  for (let row = 0; row < CRAYON_ROWS; row += 1) {
    const y = trace / 2 + row * trace;
    drawWith(game, 'crayon', row % TEST_PALETTE_SIZE, [at(0.5, y), at(149.5, y)]);
  }
}

/** Záznam obrázku, který hra sama uloží po těsných tazích pastelkou v 64 barvách. */
function savedCrayonRecord(regions: RegionMap): string {
  const storage = new RecordingStorage();
  const game = openWithTestPalette(storage, regions);
  paintCrayonRows(game);
  game.suspend();
  return storage.data.get(PICTURE_KEY) ?? '';
}

describe('#119 AC1: vzor těsných tahů', () => {
  it('vzor se kreslí stejnou šířkou, jakou maluje hra po výběru nástroje a tloušťky', () => {
    const regions = tapPicture();
    for (const tool of PAINTING_TOOLS) {
      for (const size of ALL_SIZES) {
        const what = `${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}`;
        const path = [at(40.5, TAP_HEIGHT / 2), at(TAP_WIDTH - 40.5, TAP_HEIGHT / 2 + 30)];

        const game = openOn(new RecordingStorage(), regions);
        game.tapLineSize(size);
        pickTool(game, tool);
        game.tapHandle();
        paint(game, path);

        const reference = createColoring(regions);
        const color = game.toolColor(tool) ?? 0;
        const [first, ...rest] = path;
        reference.pointerDown(
          { id: 1, x: first?.x ?? 0, y: first?.y ?? 0, kind: 'touch' },
          color,
          tool,
          strokeW(tool, size, regions.width),
        );
        for (const point of rest) {
          reference.pointerMove({ id: 1, x: point.x, y: point.y, kind: 'touch' });
        }
        reference.pointerUp(1);

        expect(
          pixelDifferences(
            pixelsFrom(game, regions),
            pixelsFrom(reference, regions),
            regions.width,
          ),
          `${what}: tah hry a tah vzoru`,
        ).toEqual([]);
      }
    }
  });

  it('kontrola vzoru: stopy štětce nejtenčí pokryjí skoro celý obrázek a tahy mají barvy po řádcích shora a v řádku zleva', () => {
    // Výška 768 px je přesně 75 stop štětce nejtenčí (10,24 px), vzor tak pokryje celý obrázek.
    const regions = drawing(LAYER_WIDTH, LAYER_HEIGHT).verticalLine(500).regions();
    const tight = tightStrokes(regions, 'brush', 'tiny', 'horizontal');
    // Kulaté stopy se dotýkají jen ve středu mezi řádky, mezi otisky štětce zbydou drobné mezery.
    expect(paintedShare(regions, tight.places46), 'zabarvený díl obrázku').toBeGreaterThan(0.98);
    // Každý řádek má dva úseky (čára x 500): první tah vlevo nahoře, druhý vpravo nahoře.
    expect(tight.strokeCount, 'dva tahy v každém ze 75 řádků').toBe(150);
    expect(tight.places46[0], 'první tah: levý úsek prvního řádku').toBe(0);
    expect(tight.places46[regions.width - 1], 'druhý tah: pravý úsek prvního řádku').toBe(1);
    expect(
      tight.places46[(regions.height - 1) * regions.width],
      'předposlední tah: levý úsek posledního řádku (dokola přes 46 míst)',
    ).toBe(148 % 46);
    expect(
      tight.places64[regions.height * regions.width - 1],
      'poslední tah: pravý úsek posledního řádku (dokola přes 64 míst)',
    ).toBe(149 % 64);
  });
});

describe('#119 AC2: limit se nemění', () => {
  it('limit uložení zůstává 50 000 znaků', () => {
    expect(PICTURE_RECORD_LIMIT).toBe(RECORD_LIMIT);
    expect(RECORD_LIMIT).toBe(50_000);
  });
});

describe('#119 AC3: staré obrázky', () => {
  it('nový pevný záznam je uložený formátem p4 a přečte se pixel po pixelu i s vybranou barvou', () => {
    expect(formatOf(LEGACY_P4_RECORD), 'formát pevného záznamu').toBe('p4');
    const regions = legacyP4Regions();
    const decoded = decodePicture(LEGACY_P4_RECORD, PICTURE, regions);
    expect(decoded, 'záznam jde přečíst').not.toBeNull();
    expect(decoded?.selectedColor, 'vybraná barva').toBe(LEGACY_P4_SELECTED_COLOR);
    expect(
      pixelDifferences(
        decoded === null ? [] : pixelsFrom(decoded.colors, regions),
        legacyP4Pixels(),
        regions.width,
      ),
      'stejný obrázek pixel po pixelu',
    ).toEqual([]);
    expect(
      usedColors(legacyP4Pixels()).filter((color) => color >= 12),
      'obrázek má barvy, které starší formáty neznají',
    ).not.toEqual([]);
  });

  it('obrázky uložené dřív (p1 až p4) se otevřou pixel po pixelu stejně a se stejnou vybranou barvou', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      for (const opener of OPENERS) {
        const what = `${legacy.name}, ${opener.name}`;
        const game = opener.open(storageWith(legacy.storage), regions);
        expect(
          pixelDifferences(pixelsFrom(game, regions), legacy.pixels(), regions.width),
          `${what}: obrázek`,
        ).toEqual([]);
        expect(game.palette().selected, `${what}: vybraná barva`).toBe(legacy.selectedColor);
      }
    }
  });

  it('obrázek p4 z dnešní verze se otevře i s barvami nástrojů, nedávnými barvami a tloušťkou', () => {
    const game = openOn(storageWith(LEGACY_P4_STORAGE), legacyP4Regions());
    for (const tool of PAINTING_TOOLS) {
      expect(game.toolColor(tool), `barva nástroje ${TOOL_NAMES[tool]}`).toBe(
        LEGACY_P4_TOOL_COLORS[tool],
      );
    }
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P4_RECENT_COLORS);
    expect(game.lineSize(), 'tloušťka').toBe(LEGACY_P4_LINE_SIZE);
  });

  it('po dalším tahu se starý obrázek uloží novým způsobem a po obnovení stránky vypadá stejně', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      for (const opener of OPENERS) {
        const what = `${legacy.name}, ${opener.name}`;
        const device = new DeviceStorage();
        const gameStorage = openProfiles(device).gameStorage(COLORING_META.id);
        for (const [key, value] of legacy.storage) {
          gameStorage.setItem(key, value);
        }
        const game = opener.enter(openProfiles(device), regions);
        drawWith(game, 'brush', 3, [at(5, 5), at(regions.width / 3, regions.height - 5)]);
        const after = pixelsFrom(game, regions);
        const old = legacy.pixels();
        expect(
          after.filter((color, index) => color !== old[index]).length,
          `${what}: tah něco namaloval`,
        ).toBeGreaterThan(0);
        game.suspend();

        const again = opener.enter(openProfiles(device), regions);
        expect(
          pixelDifferences(pixelsFrom(again, regions), after, regions.width),
          `${what}: po obnovení stránky`,
        ).toEqual([]);
        expect(again.palette().selected, `${what}: vybraná barva`).toBe(3);

        const saved = openProfiles(device).gameStorage(COLORING_META.id).getItem(PICTURE_KEY);
        expect(
          FORMATS_BEFORE_119,
          `${what}: obrázek je uložený novým způsobem, ne formátem ${formatOf(saved ?? '')}`,
        ).not.toContain(formatOf(saved ?? ''));
      }
    }
  });
});

describe('#119 AC4: okrajové případy', () => {
  it('prázdná omalovánka se uloží a po návratu i po obnovení stránky je prázdná s vybranou barvou', () => {
    for (const opener of OPENERS) {
      for (const regions of [twoHalves(), drawing(LAYER_WIDTH, LAYER_HEIGHT).regions()]) {
        const what = `${opener.name}, ${regions.width} × ${regions.height}`;
        const device = new DeviceStorage();
        const store = openProfiles(device);
        const game = opener.enter(store, regions);
        // Ťuknutí na barvu obrázek uloží i bez tahu (#92).
        game.tapColor(5);
        game.suspend();
        expect(
          store.gameStorage(COLORING_META.id).getItem(PICTURE_KEY),
          `${what}: obrázek je uložený`,
        ).not.toBeNull();

        for (const [step, reopened] of [
          ['po návratu', opener.enter(store, regions)],
          ['po obnovení stránky', opener.enter(openProfiles(device), regions)],
        ] as const) {
          expect(
            pixelsFrom(reopened, regions).filter((color) => color !== null),
            `${what}, ${step}: prázdná`,
          ).toEqual([]);
          expect(reopened.palette().selected, `${what}, ${step}: vybraná barva`).toBe(5);
        }
      }
    }
  });

  it('obrázek s jediným tahem se uloží a po návratu i po obnovení stránky je beze změny', () => {
    for (const opener of OPENERS) {
      for (const tool of PAINTING_TOOLS) {
        const regions = twoHalves();
        const what = `${opener.name}, ${TOOL_NAMES[tool]}`;
        const device = new DeviceStorage();
        const store = openProfiles(device);
        const game = opener.enter(store, regions);
        drawWith(game, tool, 7, [at(20, 30), at(130, 170)]);
        const painted = pixelsFrom(game, regions);
        expect(usedColors(painted).length, `${what}: tah něco namaloval`).toBeGreaterThan(0);
        game.suspend();

        for (const [step, reopened] of [
          ['po návratu', opener.enter(store, regions)],
          ['po obnovení stránky', opener.enter(openProfiles(device), regions)],
        ] as const) {
          expect(
            pixelDifferences(pixelsFrom(reopened, regions), painted, regions.width),
            `${what}, ${step}`,
          ).toEqual([]);
        }
      }
    }
  });

  it('prázdný obrázek a obrázek s jediným tahem se zakódují a přečtou beze změny', () => {
    const regions = drawing(LAYER_WIDTH, LAYER_HEIGHT).regions();
    const single = createColoring(regions);
    single.pointerDown({ id: 1, x: 10, y: 10, kind: 'touch' }, TEST_PALETTE_SIZE - 1, 'crayon');
    single.pointerMove({ id: 1, x: 1000, y: 700, kind: 'touch' });
    single.pointerUp(1);
    for (const [what, pixels] of [
      ['prázdný obrázek', pixelsFrom({ colorAt: () => null }, regions)],
      ['jediný tah pastelkou', pixelsFrom(single, regions)],
    ] as const) {
      const record = encodeWithTestPalette(regions, pixels, TEST_PALETTE_SIZE - 1);
      const decoded = decodeWithTestPalette(record, regions);
      expect(decoded?.selectedColor, `${what}: vybraná barva`).toBe(TEST_PALETTE_SIZE - 1);
      expect(
        pixelDifferences(
          decoded === null ? [] : pixelsFrom(decoded.colors, regions),
          pixels,
          regions.width,
        ),
        `${what}: stejný obrázek`,
      ).toEqual([]);
    }
  });

  it('poškozený záznam (změněný znak) dá prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedCrayonRecord(regions);
    expect(
      decodeWithTestPalette(original, regions),
      'kontrola: uložený záznam platí',
    ).not.toBeNull();

    const random = seededRandom(119);
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const characters = [...original];
      const position = pick(random, characters.length);
      const code = (characters[position] ?? 'a').charCodeAt(0);
      characters[position] = String.fromCharCode(code ^ (1 + pick(random, 0x7fff)));
      const broken = characters.join('');
      expectBlankStart(
        () => openWithTestPalette(storageWith([[PICTURE_KEY, broken]]), regions),
        regions,
        `pokus ${attempt + 1}, znak ${position}`,
      );
    }
  });

  it('zkrácený záznam i zkrácená data s platným kontrolním součtem dají prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedCrayonRecord(regions);
    const dataLength = original.split('|')[DATA_FIELD]?.length ?? 0;
    expect(dataLength, 'kontrola: záznam má data').toBeGreaterThan(2);

    const random = seededRandom(1190);
    const cuts = [0, 1, Math.floor(original.length / 2), original.length - 1];
    const kept = [0, 1, Math.floor(dataLength / 2), dataLength - 1];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      cuts.push(1 + pick(random, original.length - 1));
      kept.push(pick(random, dataLength));
    }
    for (const cut of cuts) {
      expectBlankStart(
        () => openWithTestPalette(storageWith([[PICTURE_KEY, original.slice(0, cut)]]), regions),
        regions,
        `záznam zkrácený na ${cut} z ${original.length} znaků`,
      );
    }
    for (const length of kept) {
      const shortened = rewrittenRecord(original, (fields) => {
        fields[DATA_FIELD] = (fields[DATA_FIELD] ?? '').slice(0, length);
      });
      expectBlankStart(
        () => openWithTestPalette(storageWith([[PICTURE_KEY, shortened ?? '']]), regions),
        regions,
        `data zkrácená na ${length} z ${dataLength} znaků`,
      );
    }
  });

  it('prodloužený záznam i prodloužená data s platným kontrolním součtem dají prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedCrayonRecord(regions);
    const data = original.split('|')[DATA_FIELD] ?? '';
    // Znaky z rozsahu, který záznam používá (U+1000 až U+8FFF), i obyčejné znaky.
    const tails = ['က', '迿', '䉂ሴ', 'a', 'က'.repeat(10), data];
    for (const tail of tails) {
      const what = `přidáno ${tail.length} znaků`;
      expectBlankStart(
        () => openWithTestPalette(storageWith([[PICTURE_KEY, `${original}${tail}`]]), regions),
        regions,
        `${what} na konec záznamu`,
      );
      const longer = rewrittenRecord(original, (fields) => {
        fields[DATA_FIELD] = `${fields[DATA_FIELD] ?? ''}${tail}`;
      });
      expectBlankStart(
        () => openWithTestPalette(storageWith([[PICTURE_KEY, longer ?? '']]), regions),
        regions,
        `${what} na konec dat s platným kontrolním součtem`,
      );
    }
  });

  it('změněná data s platným kontrolním součtem nikdy neukážou barvu mimo paletu a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedCrayonRecord(regions);
    const random = seededRandom(1191);
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const changed = rewrittenRecord(original, (fields) => {
        const characters = [...(fields[DATA_FIELD] ?? '')];
        const position = pick(random, characters.length);
        const code = (characters[position] ?? 'a').charCodeAt(0);
        characters[position] = String.fromCharCode(code ^ (1 + pick(random, 0x7fff)));
        fields[DATA_FIELD] = characters.join('');
      });
      const what = `pokus ${attempt + 1}`;
      let pixels: Array<number | null> = [];
      expect(() => {
        pixels = pixelsFrom(
          openWithTestPalette(storageWith([[PICTURE_KEY, changed ?? '']]), regions),
          regions,
        );
      }, `${what}: hra se nezastaví`).not.toThrow();
      expect(
        usedColors(pixels).filter((color) => color >= TEST_PALETTE_SIZE),
        `${what}: žádná barva mimo paletu`,
      ).toEqual([]);
    }
  });

  it('opakované uložení a otevření dá pořád stejný obrázek', () => {
    const regions = twoHalves();
    const device = new DeviceStorage();
    const first = enterWithTestPalette(openProfiles(device), regions);
    paintCrayonRows(first);
    const painted = pixelsFrom(first, regions);
    first.suspend();

    for (let round = 1; round <= 5; round += 1) {
      const game = enterWithTestPalette(openProfiles(device), regions);
      expect(
        pixelDifferences(pixelsFrom(game, regions), painted, regions.width),
        `${round}. otevření`,
      ).toEqual([]);
      // Ťuknutí na jinou barvu uloží obrázek znovu celý.
      game.tapColor(round);
      game.suspend();
    }
  });

  it('opakované zakódování a přečtení těsných tahů dá pořád stejný obrázek i stejný záznam', () => {
    const regions = twoHalves();
    const tight = tightStrokes(regions, 'crayon', 'tiny', 'horizontal');
    for (const order of matrixOrders()) {
      const pixels = inMatrixOrder(order.testPalette ? tight.places64 : tight.places46, order);
      const selected = order.colors[0] ?? 0;
      let current = pixels;
      let previousRecord: string | null = null;
      for (let round = 1; round <= 3; round += 1) {
        const record = encodeInOrder(regions, current, selected, order);
        if (previousRecord !== null) {
          expect(record, `${order.name}, ${round}. uložení: stejný záznam`).toBe(previousRecord);
        }
        previousRecord = record;
        const decoded = decodeInOrder(record, regions, order);
        current = decoded === null ? [] : pixelsFrom(decoded.colors, regions);
        expect(
          pixelDifferences(current, pixels, regions.width),
          `${order.name}, ${round}. přečtení`,
        ).toEqual([]);
      }
    }
  });

  it('Zpět po tahu se v obrázku z těsných tahů uloží a po návratu i po obnovení stránky je stejný', () => {
    const regions = twoHalves();
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const game = enterWithTestPalette(store, regions);
    paintCrayonRows(game);
    const before = pixelsFrom(game, regions);
    drawWith(game, 'brush', 40, [at(160, 20), at(290, 180)]);
    expect(game.tapUndo().kind, 'kontrola: tah se vrátil').toBe('undone');
    expect(
      pixelDifferences(pixelsFrom(game, regions), before, regions.width),
      'po Zpět je obrázek jako před tahem',
    ).toEqual([]);
    game.suspend();

    for (const [step, reopened] of [
      ['po návratu', enterWithTestPalette(store, regions)],
      ['po obnovení stránky', enterWithTestPalette(openProfiles(device), regions)],
    ] as const) {
      expect(pixelDifferences(pixelsFrom(reopened, regions), before, regions.width), step).toEqual(
        [],
      );
    }
  });

  it('odchod do menu uprostřed tahu uloží obrázek z těsných tahů s rozpracovaným tahem', () => {
    const regions = twoHalves();
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const game = enterWithTestPalette(store, regions);
    paintCrayonRows(game);
    const before = pixelsFrom(game, regions);
    pickTool(game, 'brush');
    game.tapColor(50);
    startStroke(game, [at(160, 20), at(220, 100), at(290, 180)]);
    const midStroke = pixelsFrom(game, regions);
    expect(
      midStroke.filter((color, index) => color !== before[index]).length,
      'kontrola: rozpracovaný tah něco namaloval',
    ).toBeGreaterThan(0);
    // Odchod domečkem uprostřed tahu (prst je pořád na ploše).
    game.suspend();

    for (const [step, reopened] of [
      ['po návratu', enterWithTestPalette(store, regions)],
      ['po obnovení stránky', enterWithTestPalette(openProfiles(device), regions)],
    ] as const) {
      expect(
        pixelDifferences(pixelsFrom(reopened, regions), midStroke, regions.width),
        step,
      ).toEqual([]);
    }
  });
});
