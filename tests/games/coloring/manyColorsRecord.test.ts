import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { DeviceStorage } from '../../shared/profileFixtures';
import { pixelDifferences, usedColors } from './extendedPaletteHelpers';
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
  LEGACY_P1_RECORD,
  LEGACY_SELECTED_COLOR,
  legacyPixels,
  legacyRegions,
} from './legacyRecordFixture';
import {
  DATA_FIELD,
  PICTURE_KEY,
  SELECTED_FIELD,
  TEST_PALETTE_SIZE,
  decodeWithTestPalette,
  encodeWithTestPalette,
  enterWithTestPalette,
  openWithTestPalette,
  pixelsFrom,
  rewrittenRecord,
} from './manyColorsHelpers';
import { pick, seededRandom } from './recentColorsHelpers';
import { PICTURE, RecordingStorage, openOn, paint, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #115 AC1 (obrázek s až 64 barvami se obnoví), AC3 (staré obrázky
 * p1 až p3 se otevřou beze změny a po prvním tahu se uloží novým formátem)
 * a AC4 (poškozený, zkrácený nebo nepoznaný záznam dá prázdnou
 * omalovánku). Limit z AC2 je v `manyColorsLimit.test.ts`, AC5 je ruční
 * kontrola (měření času v CI kolísá).
 *
 * Testy ověřují chování: uložit, obnovit a porovnat pixely. Kódování
 * vrstvy barev neznají. U AC4 znají jen hlavičku záznamu popsanou
 * v `savedPicture.ts` (pořadí polí a kontrolní součet), aby šlo poškodit
 * data i vybranou barvu tak, že to nezachytí kontrolní součet a musí to
 * poznat čtení formátu (`rewrittenRecord`).
 *
 * Navržené rozhraní (dnes chybí): velikost palety jako volba
 * `paletteSize` (výchozí `PALETTE.length`, formát umí nejvýš 64):
 * - `encodePicture({ picture, regions, colors, selectedColor, paletteSize? })`,
 * - `decodePicture(record, picture, regions, paletteSize?)`,
 * - `openColoring({ regions, picture, storage, paletteSize? })`: barvy
 *   0 až `paletteSize − 1` jde vybrat (`tapColor`), malovat, uložit
 *   a obnovit; barva mimo paletu se řídí #100 AC5.
 */

/** Nejvyšší barva zkušební palety. */
const HIGHEST_COLOR = TEST_PALETTE_SIZE - 1;

/** Barva, kterou zná formát, ale dnešní paleta s 12 barvami ne. */
const BEYOND_TODAY = 40;

/** Barva dnešní palety (světle modrá z #100). */
const TODAY_COLOR = 11;

/**
 * Dítě vybere postupně všech 64 barev a každou namaluje krátký tah na
 * obrázku `twoHalves()` (mřížka 8 × 8, žádný tah nepřejde čáru x 150),
 * nakonec vybere barvu `lastPick`.
 */
function paintAllColors(game: SavedColoring, lastPick: number): void {
  for (let color = 0; color < TEST_PALETTE_SIZE; color += 1) {
    game.tapColor(color);
    const x = 12 + (color % 8) * 36;
    const y = 12 + Math.floor(color / 8) * 24;
    paint(game, [at(x, y), at(x + 10, y + 2)]);
  }
  game.tapColor(lastPick);
}

/** Úložiště jen se záznamem obrázku `record` (bez barev nástrojů a nedávných barev). */
function storageWithPicture(record: string): RecordingStorage {
  const storage = new RecordingStorage();
  storage.data.set(PICTURE_KEY, record);
  return storage;
}

/** Záznam obrázku se všemi 64 barvami, jak ho hra sama uloží. */
function savedRecordWithAllColors(regions: RegionMap): string {
  const storage = new RecordingStorage();
  const game = openWithTestPalette(storage, regions);
  paintAllColors(game, BEYOND_TODAY);
  game.suspend();
  return storage.data.get(PICTURE_KEY) ?? '';
}

/**
 * Otevřená omalovánka je prázdná, vybraná je první barva a hra se
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
  expect(selected, `${what}: vybraná první barva`).toBe(0);
}

describe('#115 AC1: obrázek s až 64 barvami se obnoví pixel po pixelu i s vybranou barvou', () => {
  it('po návratu do hry je obrázek se všemi 64 barvami stejný a vybraná barva zůstane', () => {
    const regions = twoHalves();
    for (const lastPick of [0, BEYOND_TODAY, HIGHEST_COLOR]) {
      const storage = new RecordingStorage();
      const game = openWithTestPalette(storage, regions);
      paintAllColors(game, lastPick);
      const painted = pixelsFrom(game, regions);
      expect(usedColors(painted), `vybraná ${lastPick}: v obrázku je všech 64 barev`).toHaveLength(
        TEST_PALETTE_SIZE,
      );
      game.suspend();

      const reopened = openWithTestPalette(storage, regions);

      expect(
        pixelDifferences(pixelsFrom(reopened, regions), painted, regions.width),
        `vybraná ${lastPick}: stejný obrázek pixel po pixelu`,
      ).toEqual([]);
      expect(reopened.palette().selected, `vybraná ${lastPick}: vybraná barva`).toBe(lastPick);
    }
  });

  it('po obnovení stránky je obrázek se všemi 64 barvami stejný a vybraná barva zůstane', () => {
    const regions = twoHalves();
    for (const lastPick of [0, BEYOND_TODAY, HIGHEST_COLOR]) {
      const device = new DeviceStorage();
      const game = enterWithTestPalette(openProfiles(device), regions);
      paintAllColors(game, lastPick);
      const painted = pixelsFrom(game, regions);
      game.suspend();

      const again = enterWithTestPalette(openProfiles(device), regions);

      expect(
        pixelDifferences(pixelsFrom(again, regions), painted, regions.width),
        `vybraná ${lastPick}: stejný obrázek pixel po pixelu`,
      ).toEqual([]);
      expect(again.palette().selected, `vybraná ${lastPick}: vybraná barva`).toBe(lastPick);
    }
  });

  it('každá z 64 barev jako vybraná barva se uloží a přečte beze změny', () => {
    const regions = twoHalves();
    const pixels = pixelsFrom(
      { colorAt: (x, y) => (x < 150 ? (x + y) % TEST_PALETTE_SIZE : null) },
      regions,
    );
    for (let selected = 0; selected < TEST_PALETTE_SIZE; selected += 1) {
      const record = encodeWithTestPalette(regions, pixels, selected);
      const decoded = decodeWithTestPalette(record, regions);
      expect(decoded?.selectedColor, `vybraná barva ${selected}`).toBe(selected);
    }
  });

  it('každá z 64 barev v pixelu se uloží a přečte beze změny i vedle každé jiné barvy', () => {
    const regions = twoHalves();
    // Každá dvojice barev (a, b) leží v řádku vedle sebe, takže se vyzkouší
    // každá barva po každé jiné i po prázdnu.
    const pixels = pixelsFrom(
      {
        colorAt(x, y) {
          if (x === 150 || x === 151) {
            return null;
          }
          const pair = (y * 300 + x) >> 1;
          const first = pair % TEST_PALETTE_SIZE;
          const second = Math.floor(pair / TEST_PALETTE_SIZE) % (TEST_PALETTE_SIZE + 1);
          if (x % 2 === 0) {
            return first;
          }
          return second === TEST_PALETTE_SIZE ? null : second;
        },
      },
      regions,
    );
    expect(usedColors(pixels), 'v obrázku je všech 64 barev').toHaveLength(TEST_PALETTE_SIZE);

    const decoded = decodeWithTestPalette(encodeWithTestPalette(regions, pixels, 7), regions);

    expect(decoded, 'záznam jde přečíst').not.toBeNull();
    expect(
      pixelDifferences(
        decoded === null ? [] : pixelsFrom(decoded.colors, regions),
        pixels,
        regions.width,
      ),
    ).toEqual([]);
  });

  it('vybraná barva z 64 se pamatuje i bez tahu', () => {
    const regions = twoHalves();
    for (const picked of [12, BEYOND_TODAY, HIGHEST_COLOR]) {
      const storage = new RecordingStorage();
      openWithTestPalette(storage, regions).tapColor(picked);

      expect(openWithTestPalette(storage, regions).palette().selected, `barva ${picked}`).toBe(
        picked,
      );
    }
  });
});

/** Pevný starý stav úložiště hry jednoho profilu a co má hra po otevření ukázat. */
interface LegacyCase {
  readonly name: string;
  readonly record: string;
  readonly storage: ReadonlyArray<readonly [string, string]>;
  readonly regions: () => RegionMap;
  readonly pixels: () => Array<number | null>;
  readonly selectedColor: number;
}

/** Všechny pevné záznamy, které hra kdy uložila (p1 z #92, p2 z #93, p3 z #100 až #111). */
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
    // Štětec má uloženou barvu z #110; je to i vybraná barva v záznamu.
    selectedColor: LEGACY_BEFORE_111_TOOL_COLORS.brush ?? -1,
  },
];

/** Úložiště hry se starým stavem, jak ho zapsala starší verze. */
function legacyStorage(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}

/** Hra s dnešní paletou a hra se zkušební paletou 64 barev. */
const OPENERS: ReadonlyArray<{
  readonly name: string;
  readonly open: (storage: RecordingStorage, regions: RegionMap) => SavedColoring;
}> = [
  { name: 'dnešní paleta', open: (storage, regions) => openOn(storage, regions) },
  { name: 'paleta 64 barev', open: openWithTestPalette },
];

/** Dítě namaluje do starého obrázku jeden tah barvou `color`. */
function strokeInto(game: SavedColoring, color: number): void {
  game.tapColor(color);
  paint(game, [at(30, 75), at(50, 75)]);
}

describe('#115 AC3: dnešní obrázky p1 až p3 se otevřou beze změny', () => {
  it('každý pevný starý záznam se přečte pixel po pixelu a s vybranou barvou', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      for (const [paletteName, decoded] of [
        ['dnešní paleta', decodePicture(legacy.record, PICTURE, regions)],
        ['paleta 64 barev', decodeWithTestPalette(legacy.record, regions)],
      ] as const) {
        const what = `${legacy.name}, ${paletteName}`;
        expect(decoded, `${what}: starý záznam jde přečíst`).not.toBeNull();
        expect(decoded?.selectedColor, `${what}: vybraná barva`).toBe(legacy.selectedColor);
        expect(
          pixelDifferences(
            decoded === null ? [] : pixelsFrom(decoded.colors, regions),
            legacy.pixels(),
            regions.width,
          ),
          `${what}: stejný obrázek pixel po pixelu`,
        ).toEqual([]);
      }
    }
  });

  it('dítě po otevření hry vidí starý obrázek beze změny a se stejnou vybranou barvou', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      for (const opener of OPENERS) {
        const what = `${legacy.name}, ${opener.name}`;
        const game = opener.open(legacyStorage(legacy.storage), regions);
        expect(
          pixelDifferences(pixelsFrom(game, regions), legacy.pixels(), regions.width),
          `${what}: starý obrázek`,
        ).toEqual([]);
        expect(game.palette().selected, `${what}: vybraná barva`).toBe(legacy.selectedColor);
      }
    }
  });

  it('po prvním tahu do starého obrázku je po návratu do hry starý obrázek i nový tah', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      for (const [opener, color] of [
        [OPENERS[0], TODAY_COLOR],
        [OPENERS[1], BEYOND_TODAY],
      ] as const) {
        const what = `${legacy.name}, ${opener?.name ?? ''}, barva ${color}`;
        const open = opener?.open ?? openOn;
        const storage = legacyStorage(legacy.storage);
        const old = legacy.pixels();
        const game = open(storage, regions);
        strokeInto(game, color);
        const after = pixelsFrom(game, regions);
        const changed = after.filter((pixel, index) => pixel !== old[index]);
        expect(changed.length, `${what}: tah něco namaloval`).toBeGreaterThan(0);
        expect(usedColors(changed), `${what}: tah má vybranou barvu`).toEqual([color]);
        game.suspend();

        const reopened = open(storage, regions);

        expect(
          pixelDifferences(pixelsFrom(reopened, regions), after, regions.width),
          `${what}: uloží se celý obrázek`,
        ).toEqual([]);
        expect(reopened.palette().selected, `${what}: vybraná barva`).toBe(color);
      }
    }
  });

  it('po prvním tahu do starého obrázku vypadá obrázek po obnovení stránky stejně', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      const what = legacy.name;
      const device = new DeviceStorage();
      // Starší verze zapsala svůj stav do úložiště hry aktivního profilu.
      const gameStorage = openProfiles(device).gameStorage(COLORING_META.id);
      for (const [key, value] of legacy.storage) {
        gameStorage.setItem(key, value);
      }
      const game = enterWithTestPalette(openProfiles(device), regions);
      expect(
        pixelDifferences(pixelsFrom(game, regions), legacy.pixels(), regions.width),
        `${what}: starý obrázek po otevření`,
      ).toEqual([]);
      strokeInto(game, BEYOND_TODAY);
      const after = pixelsFrom(game, regions);
      game.suspend();

      const again = enterWithTestPalette(openProfiles(device), regions);

      expect(
        pixelDifferences(pixelsFrom(again, regions), after, regions.width),
        `${what}: po obnovení stránky stejný obrázek`,
      ).toEqual([]);
      expect(again.palette().selected, `${what}: vybraná barva`).toBe(BEYOND_TODAY);
    }
  });
});

describe('#115 AC4: poškozený nebo nepoznaný záznam dá prázdnou omalovánku', () => {
  it('záznam s 64 barvami se změněným znakem dá prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedRecordWithAllColors(regions);
    expect(
      decodeWithTestPalette(original, regions),
      'kontrola: uložený záznam platí',
    ).not.toBeNull();

    const random = seededRandom(115);
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const characters = [...original];
      const position = pick(random, characters.length);
      const code = (characters[position] ?? 'a').charCodeAt(0);
      characters[position] = String.fromCharCode(code ^ (1 + pick(random, 0x7fff)));
      const broken = characters.join('');

      expectBlankStart(
        () => openWithTestPalette(storageWithPicture(broken), regions),
        regions,
        `pokus ${attempt + 1}, znak ${position}`,
      );
    }
  });

  it('zkrácený záznam s 64 barvami dá prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedRecordWithAllColors(regions);
    const random = seededRandom(1150);
    const cuts = [0, 1, Math.floor(original.length / 2), original.length - 1];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      cuts.push(1 + pick(random, original.length - 1));
    }
    for (const cut of cuts) {
      expectBlankStart(
        () => openWithTestPalette(storageWithPicture(original.slice(0, cut)), regions),
        regions,
        `zkráceno na ${cut} z ${original.length} znaků`,
      );
    }
  });

  it('zkrácená data s platným kontrolním součtem dají prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedRecordWithAllColors(regions);
    expect(
      rewrittenRecord(original, () => undefined),
      'kontrola pomůcky: záznam má popsanou hlavičku a kontrolní součet',
    ).toBe(original);
    const dataLength = original.split('|')[DATA_FIELD]?.length ?? 0;
    expect(dataLength, 'kontrola: záznam má data').toBeGreaterThan(2);

    const random = seededRandom(1151);
    const kept = [0, 1, Math.floor(dataLength / 2), dataLength - 1];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      kept.push(pick(random, dataLength));
    }
    for (const length of kept) {
      const shortened = rewrittenRecord(original, (fields) => {
        fields[DATA_FIELD] = (fields[DATA_FIELD] ?? '').slice(0, length);
      });
      expectBlankStart(
        () => openWithTestPalette(storageWithPicture(shortened ?? ''), regions),
        regions,
        `data zkrácená na ${length} z ${dataLength} znaků`,
      );
    }
  });

  it('vybraná barva mimo 64 barev formátu dá prázdnou omalovánku a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedRecordWithAllColors(regions);
    const withSelected = (selected: string): string =>
      rewrittenRecord(original, (fields) => {
        fields[SELECTED_FIELD] = selected;
      }) ?? '';
    // Kontrola pomůcky: platná vybraná barva záznam nerozbije.
    expect(
      decodeWithTestPalette(withSelected(String(HIGHEST_COLOR)), regions)?.selectedColor,
      'platná vybraná barva 63',
    ).toBe(HIGHEST_COLOR);

    for (const selected of ['64', '65', '99', '255', '256', '-1', '1.5', '']) {
      expectBlankStart(
        () => openWithTestPalette(storageWithPicture(withSelected(selected)), regions),
        regions,
        `vybraná barva „${selected}“`,
      );
    }
  });

  it('změněná data s platným kontrolním součtem nikdy neukážou barvu mimo paletu a hru nezastaví', () => {
    const regions = twoHalves();
    const original = savedRecordWithAllColors(regions);
    const random = seededRandom(1152);
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const changed = rewrittenRecord(original, (fields) => {
        const data = [...(fields[DATA_FIELD] ?? '')];
        const position = pick(random, data.length);
        const code = (data[position] ?? 'a').charCodeAt(0);
        data[position] = String.fromCharCode(code ^ (1 + pick(random, 0x7fff)));
        fields[DATA_FIELD] = data.join('');
      });
      const what = `pokus ${attempt + 1}`;
      for (const [paletteName, paletteSize, open] of [
        ['paleta 64 barev', TEST_PALETTE_SIZE, openWithTestPalette],
        ['dnešní paleta', 12, (storage: RecordingStorage, map: RegionMap) => openOn(storage, map)],
      ] as const) {
        let pixels: Array<number | null> = [];
        let selected = -1;
        expect(() => {
          const game = open(storageWithPicture(changed ?? ''), regions);
          pixels = pixelsFrom(game, regions);
          selected = game.palette().selected;
        }, `${what}, ${paletteName}: hra se nezastaví`).not.toThrow();
        const outside = usedColors(pixels).filter((color) => color >= paletteSize);
        expect(outside, `${what}, ${paletteName}: žádná barva mimo paletu`).toEqual([]);
        expect(selected, `${what}, ${paletteName}: vybraná barva z palety`).toBeLessThan(
          paletteSize,
        );
      }
    }
  });

  it('barva, kterou formát zná, ale dnešní paleta ne, dá podle #100 AC5 prázdnou omalovánku', () => {
    const regions = twoHalves();
    const todayPixels = pixelsFrom({ colorAt: (x) => (x < 150 ? TODAY_COLOR : null) }, regions);
    const beyondPixels = pixelsFrom({ colorAt: (x) => (x < 150 ? BEYOND_TODAY : 3) }, regions);
    // Kontrola: obrázek jen s dnešními barvami se z nového formátu otevře i s dnešní paletou.
    const todayGame = openOn(
      storageWithPicture(encodeWithTestPalette(regions, todayPixels, TODAY_COLOR)),
      regions,
    );
    expect(
      pixelDifferences(pixelsFrom(todayGame, regions), todayPixels, regions.width),
      'obrázek s dnešními barvami',
    ).toEqual([]);
    expect(todayGame.palette().selected, 'dnešní vybraná barva').toBe(TODAY_COLOR);

    for (const [what, pixels, selected] of [
      ['pixely v barvě 40', beyondPixels, 3],
      ['vybraná barva 40', todayPixels, BEYOND_TODAY],
      [
        'pixely i vybraná barva 63',
        pixelsFrom({ colorAt: () => HIGHEST_COLOR }, regions),
        HIGHEST_COLOR,
      ],
    ] as const) {
      const record = encodeWithTestPalette(regions, pixels, selected);
      expect(
        decodeWithTestPalette(record, regions),
        `${what}: s paletou 64 barev platí`,
      ).not.toBeNull();
      expect(
        decodePicture(record, PICTURE, regions),
        `${what}: s dnešní paletou nečitelný`,
      ).toBeNull();
      expectBlankStart(() => openOn(storageWithPicture(record), regions), regions, what);
    }
  });
});
