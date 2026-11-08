import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { BIG_HEIGHT, BIG_WIDTH, choose, drawWith } from './drawingToolHelpers';
import {
  COLOR_COUNT,
  LAYER_HEIGHT,
  LAYER_WIDTH,
  LIGHT_BLUE,
  PINK,
  RECORD_LIMIT,
  pixelDifferences,
  stripePattern,
  usedColors,
  worstCaseOutlines,
} from './extendedPaletteHelpers';
import {
  LEGACY_P2_RECORD,
  LEGACY_P2_SELECTED_COLOR,
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
  LEGACY_P3_GLITTER_LINE_SIZE,
  LEGACY_P3_GLITTER_RECENT_COLORS,
  LEGACY_P3_GLITTER_RECORD,
  LEGACY_P3_GLITTER_SELECTED_COLOR,
  LEGACY_P3_GLITTER_STORAGE,
  legacyP3GlitterPixels,
  legacyP3GlitterRegions,
} from './legacyP3GlitterRecordFixture';
import {
  LEGACY_P3_RECORD,
  LEGACY_P3_SELECTED_COLOR,
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
  PICTURE,
  RecordingStorage,
  enterColoring,
  openOn,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import { SPRAY, sprayPixels, sprayStrokeProblems } from './sprayHelpers';
import { bigBlank, widthOf } from './stampHelpers';
import { at } from './strokeHelpers';
import type { Point } from './outlineFixtures';

/**
 * Testy k #104 AC5 (uložení): vzorek spreje přes vzor V se vejde do
 * 50 000 znaků, obrázky se sprejem se uloží a obnoví beze změny a dříve
 * uložené obrázky se otevřou beze změny pixel po pixelu: p1 z #92, p2
 * z #93, p3 z #100, p3 s puntíky z #101, p3 s proužky z #102 a nově p3
 * s třpytkami z #103 (`legacyP3GlitterRecordFixture.ts`, stav úložiště
 * těsně před #104).
 *
 * „Vzorek nástroje přes V“ podle #96 a #104 AC5: podkladem je vzor V
 * (svislé pruhy šířky W stř zleva bez mezer, barvy dokola přes všech 12
 * barev, obrys prázdný). Vzorek spreje tvoří všechny pixely, které by
 * zabarvil tah vedený přímo přes ně (vzdálenost 0 od čáry); každý z nich
 * má místo barvy pruhu barvu o jednu dál v pořadí palety. Kde vzorek je,
 * se zjistí chováním (`sprayPixels` v `sprayHelpers.ts`) na prázdném
 * obrázku 1024 × 768. Měří se na stejných nejhorších obrysech jako
 * u ostatních nástrojů (prázdný, mřížka, domeček).
 *
 * Drobné husté tečky střídají barvu v řádku často, záznam může být delší
 * než u třpytek. Vývojář smí kódování zlepšit podle pravidel z #96 (nová
 * verze záznamu), starší záznamy se ale musí číst dál. Když limit nejde
 * splnit ani tak, úkol se podle AC5 odloží a rozhodne vlastník o hustotě
 * nebo velikosti teček; limit se nemění.
 *
 * Navržené rozhraní: žádné nové (`encodePicture`, `decodePicture`,
 * `openColoring`); případná nová verze záznamu (např. `p4`) jen uvnitř
 * `savedPicture.ts` a `colorLayerCode.ts`.
 */

const BLUE = 4;
const BLACK = 7;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Vzorek spreje přes vzor V na obrysu `regions` (viz úvod souboru). */
function sprayOverV(regions: RegionMap): Array<number | null> {
  const v = stripePattern(regions);
  const pattern = sprayPixels(regions.width, regions.height);
  return pixelsOf(
    {
      colorAt(x, y) {
        const base = v.colorAt(x, y);
        if (base === null) {
          return null;
        }
        return pattern.isDot(x, y) ? (base + 1) % COLOR_COUNT : base;
      },
    },
    regions,
  );
}

/** Obrázek s pixely `pixels` se vejde do limitu a přečte se beze ztráty. */
function expectRecordWithinLimit(
  name: string,
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
): void {
  const colors = { colorAt: (x: number, y: number) => pixels[y * regions.width + x] ?? null };
  const record = encodePicture({ picture: PICTURE, regions, colors, selectedColor: LIGHT_BLUE });
  expect(record.length, `${name}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

  const decoded = decodePicture(record, PICTURE, regions);
  expect(decoded, `${name}: záznam jde přečíst`).not.toBeNull();
  expect(decoded?.selectedColor, `${name}: vybraná barva`).toBe(LIGHT_BLUE);
  expect(
    pixelDifferences(
      decoded === null ? [] : pixelsOf(decoded.colors, regions),
      pixels,
      regions.width,
    ),
    `${name}: stejný obrázek pixel po pixelu`,
  ).toEqual([]);
}

/** Úložiště hry se stavem `entries`, jak ho zapsala starší verze. */
function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}

/** Co nesedí na tahu sprejem střední velikosti barvou `color` přes prázdný obrázek 900 × 600. */
function onlySprayDots(
  game: { colorAt(x: number, y: number): number | null },
  regions: RegionMap,
  path: readonly Point[],
  color = BLUE,
): string[] {
  return sprayStrokeProblems({
    game,
    regions,
    before: pixelsOf({ colorAt: () => null }, regions),
    spray: sprayPixels(BIG_WIDTH, BIG_HEIGHT),
    path,
    width: widthOf('medium'),
    color,
    region: null,
  });
}

/** Tah sprejem barvou `color`: výběr barvy, výběr nástroje, tah. */
function sprayStroke(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, SPRAY, color, path);
}

/** Pevné záznamy starších verzí: záznam, obrys, očekávané pixely a vybraná barva. */
const LEGACY_RECORDS = [
  {
    name: 'p1',
    record: LEGACY_P1_RECORD,
    regions: legacyRegions,
    pixels: legacyPixels,
    selected: LEGACY_SELECTED_COLOR,
  },
  {
    name: 'p2',
    record: LEGACY_P2_RECORD,
    regions: legacyP2Regions,
    pixels: legacyP2Pixels,
    selected: LEGACY_P2_SELECTED_COLOR,
  },
  {
    name: 'p3',
    record: LEGACY_P3_RECORD,
    regions: legacyP3Regions,
    pixels: legacyP3Pixels,
    selected: LEGACY_P3_SELECTED_COLOR,
  },
  {
    name: 'p3 s puntíky',
    record: LEGACY_P3_DOTS_RECORD,
    regions: legacyP3DotsRegions,
    pixels: legacyP3DotsPixels,
    selected: LEGACY_P3_DOTS_SELECTED_COLOR,
  },
  {
    name: 'p3 s proužky',
    record: LEGACY_P3_STRIPES_RECORD,
    regions: legacyP3StripesRegions,
    pixels: legacyP3StripesPixels,
    selected: LEGACY_P3_STRIPES_SELECTED_COLOR,
  },
  {
    name: 'p3 s třpytkami',
    record: LEGACY_P3_GLITTER_RECORD,
    regions: legacyP3GlitterRegions,
    pixels: legacyP3GlitterPixels,
    selected: LEGACY_P3_GLITTER_SELECTED_COLOR,
  },
] as const;

const SWIPE: readonly Point[] = [at(60.5, 300.5), at(420.5, 300.5), at(600.5, 420.5)];
const SECOND_SWIPE: readonly Point[] = [at(700.5, 80.5), at(700.5, 520.5)];

/**
 * Test měří tři obrázky 1024 × 768 a sám trvá asi 4 s, při souběhu s dalšími
 * testy přes výchozích 5 s. Delší čas jen pro tento test, kontrola se nemění.
 */
const RECORD_TEST_TIMEOUT_MS = 30_000;

describe('#104 AC5: vzorek spreje přes vzor V se vejde do 50 000 znaků', () => {
  it(
    'vzorek spreje přes vzor V (pixely ve vzdálenosti 0 od čáry) má záznam nejvýš 50 000 znaků a přečte se beze ztráty',
    () => {
      for (const { name, regions } of worstCaseOutlines()) {
        expect(regions.width, 'vrstva jako u ostatních vzorů').toBe(LAYER_WIDTH);
        expect(regions.height, 'vrstva jako u ostatních vzorů').toBe(LAYER_HEIGHT);
        const pixels = sprayOverV(regions);
        expect(usedColors(pixels).length, `${name}: ve vzorku je všech 12 barev`).toBe(COLOR_COUNT);
        // Vzorek musí mít tečky, jinak by test měřil jen vzor V. U čáry je
        // zabarveno aspoň tolik jako průměr vnitřního pásma (50 %, AC2).
        const v = pixelsOf(stripePattern(regions), regions);
        const changed = pixels.filter((color, index) => color !== v[index]).length;
        const free = v.filter((color) => color !== null).length;
        expect(changed / free, `${name}: díl pixelů vzorku`).toBeGreaterThanOrEqual(0.5);

        expectRecordWithinLimit(name, regions, pixels);
      }
    },
    RECORD_TEST_TIMEOUT_MS,
  );
});

describe('#104 AC5: obrázek se sprejem se uloží a obnoví beze změny', () => {
  it('po tahu sprejem a návratu do hry jsou v obrázku jen tečky vzorku, stejné jako ve hře', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    sprayStroke(game, SWIPE);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(onlySprayDots(reopened, regions, SWIPE), 'po návratu').toEqual([]);
    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
      'stejný obrázek jako ve hře',
    ).toEqual([]);
  });

  it('hned po zvednutí prstu je obrázek se sprejem uložený', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);

    sprayStroke(game, SWIPE);

    expect(
      pixelDifferences(
        pixelsOf(openOn(storage, regions), regions),
        pixelsOf(game, regions),
        regions.width,
      ),
    ).toEqual([]);
  });

  it('po Zpět je uložený stav po dřívějším tahu, i po návratu do hry', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    sprayStroke(game, SWIPE);
    const afterFirst = pixelsOf(game, regions);
    sprayStroke(game, SECOND_SWIPE, BLACK);

    expect(game.tapUndo().kind).toBe('undone');
    game.suspend();

    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), afterFirst, regions.width),
    ).toEqual([]);
  });

  it('uložený záznam je po stejných tazích stejný, ať náhoda padne jakkoli', () => {
    const records: string[] = [];
    for (const value of [0.02, 0.51, 0.98]) {
      vi.spyOn(Math, 'random').mockReturnValue(value);
      const storage = new RecordingStorage();
      const game = openOn(storage, twoHalves());
      drawWith(game, SPRAY, PINK, [at(10, 100), at(140, 100), at(140, 20)]);
      drawWith(game, SPRAY, BLUE, [at(170, 30), at(290, 180)]);
      game.suspend();
      records.push(JSON.stringify([...storage.data].sort()));
      vi.restoreAllMocks();
    }

    expect(records[1], 'druhý záznam').toBe(records[0]);
    expect(records[2], 'třetí záznam').toBe(records[0]);
  });

  it('sprej namalovaný ve hře s jinými nástroji se po návratu do hry obnoví pixel po pixelu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    drawWith(game, 'brush', PINK, [at(10, 40), at(140, 160)]);
    drawWith(game, SPRAY, LIGHT_BLUE, [at(10, 100), at(140, 100), at(140, 20)]);
    drawWith(game, 'glitter', BLACK, [at(20, 150), at(130, 150)]);
    drawWith(game, SPRAY, BLUE, [at(170, 30), at(290, 180)]);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
    expect(reopened.palette().selected).toBe(BLUE);
  });

  it('obrázek se sprejem se obnoví i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(PINK);
    choose(game, SPRAY);
    game.pointerDown({ id: 1, x: 20, y: 100, kind: 'touch' });
    game.pointerMove({ id: 1, x: 280, y: 100, kind: 'touch' });
    game.pointerUp(1);
    game.suspend();

    const again = enterColoring(openProfiles(storage), regions);

    expect(
      pixelDifferences(pixelsOf(again, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
  });
});

describe('#104 AC5: dříve uložené obrázky se otevřou beze změny', () => {
  it('pevné záznamy p1, p2, p3, p3 s puntíky, s proužky a s třpytkami se přečtou pixel po pixelu a s vybranou barvou', () => {
    for (const { name, record, regions, pixels, selected } of LEGACY_RECORDS) {
      const decoded = decodePicture(record, PICTURE, regions());

      expect(decoded, `${name}: záznam jde přečíst`).not.toBeNull();
      expect(decoded?.selectedColor, `${name}: vybraná barva`).toBe(selected);
      expect(
        pixelDifferences(
          decoded === null ? [] : pixelsOf(decoded.colors, regions()),
          pixels(),
          regions().width,
        ),
        `${name}: obrázek`,
      ).toEqual([]);
    }
  });

  it('dítě po otevření hry vidí obrázek s třpytkami uložený před sprejem i s barvou, nedávnými barvami a velikostí', () => {
    const regions = legacyP3GlitterRegions();

    const game = openOn(storageWith(LEGACY_P3_GLITTER_STORAGE), regions);

    expect(
      pixelDifferences(pixelsOf(game, regions), legacyP3GlitterPixels(), regions.width),
      'obrázek',
    ).toEqual([]);
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_P3_GLITTER_SELECTED_COLOR);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P3_GLITTER_RECENT_COLORS);
    expect(game.lineSize(), 'velikost').toBe(LEGACY_P3_GLITTER_LINE_SIZE);
  });

  it('výběr spreje ve starém obrázku a odchod z hry obrázek nezmění', () => {
    for (const { name, storage, regions, pixels } of [
      {
        name: 'p3 s třpytkami',
        storage: storageWith(LEGACY_P3_GLITTER_STORAGE),
        regions: legacyP3GlitterRegions(),
        pixels: legacyP3GlitterPixels(),
      },
      {
        name: 'p3 s proužky',
        storage: storageWith(LEGACY_P3_STRIPES_STORAGE),
        regions: legacyP3StripesRegions(),
        pixels: legacyP3StripesPixels(),
      },
      {
        name: 'p3 s puntíky',
        storage: storageWith(LEGACY_P3_DOTS_STORAGE),
        regions: legacyP3DotsRegions(),
        pixels: legacyP3DotsPixels(),
      },
    ]) {
      const game = openOn(storage, regions);
      game.tapColor(PINK);
      choose(game, SPRAY);
      game.tapSizeToggle();
      game.suspend();

      const reopened = openOn(storage, regions);
      expect(
        pixelDifferences(pixelsOf(reopened, regions), pixels, regions.width),
        `${name}: obrázek beze změny`,
      ).toEqual([]);
      expect(reopened.palette().selected, `${name}: vybraná růžová`).toBe(PINK);
    }
  });

  it('starý obrázek s třpytkami jde dál malovat sprejem a po návratu je vidět staré i nové', () => {
    const regions = legacyP3GlitterRegions();
    const storage = storageWith(LEGACY_P3_GLITTER_STORAGE);
    const game = openOn(storage, regions);
    drawWith(game, SPRAY, PINK, [at(170, 150), at(290, 150)]);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(pixelDifferences(pixelsOf(reopened, regions), drawn, regions.width)).toEqual([]);
    const old = legacyP3GlitterPixels();
    const kept = drawn.filter((color, index) => color === old[index] && color !== null).length;
    const added = drawn.filter((color, index) => color !== old[index]).length;
    expect(kept, 'staré tahy zůstaly').toBeGreaterThan(0);
    expect(added, 'sprej přibyl').toBeGreaterThan(0);
  });
});
