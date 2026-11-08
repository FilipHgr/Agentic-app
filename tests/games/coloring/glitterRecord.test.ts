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
  GLITTER,
  GLITTER_SHARE_MAX,
  GLITTER_SHARE_MIN,
  GLITTER_WIDTH_FACTOR,
  glitterPixels,
  glitterStrokeProblems,
} from './glitterHelpers';
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
  LEGACY_P3_RECORD,
  LEGACY_P3_SELECTED_COLOR,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
import {
  LEGACY_P3_STRIPES_LINE_SIZE,
  LEGACY_P3_STRIPES_RECENT_COLORS,
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
import { bigBlank, widthOf } from './stampHelpers';
import { at } from './strokeHelpers';
import type { Point } from './outlineFixtures';

/**
 * Testy k #103 AC3 (uložený i vrácený obrázek obsahuje jen jiskry ze
 * vzoru, lesk se do něj nezapíše) a AC5 (uložení): vzorek jisker přes vzor V
 * se vejde do 50 000 znaků, obrázky s třpytkami se uloží a obnoví beze
 * změny a dříve uložené obrázky se otevřou beze změny pixel po pixelu: p1
 * z #92, p2 z #93, p3 z #100, p3 s puntíky z #101 a nově p3 s proužky
 * z #102 (`legacyP3StripesRecordFixture.ts`, stav úložiště těsně před #103).
 *
 * „Vzorek nástroje přes V“ podle #96: podkladem je vzor V (svislé pruhy
 * šířky W stř zleva bez mezer, barvy dokola přes všech 12 barev, obrys
 * prázdný). Každý pixel jisker (pevně umístěných vůči obrázku) má místo
 * barvy pruhu barvu o jednu dál v pořadí palety. Kde jsou pixely jisker,
 * se zjistí chováním jako v `glitterStrokes.test.ts`: prázdný obrázek
 * 1024 × 768 se celý přejede třpytkami (`glitterPixels`). Měří se na
 * stejných nejhorších obrysech jako u ostatních nástrojů (prázdný,
 * mřížka, domeček).
 *
 * Řídké drobné jiskry střídají barvu v řádku často, záznam může být delší
 * než u proužků. Vývojář smí kódování zlepšit podle pravidel z #96 (nová
 * verze záznamu), starší záznamy se ale musí číst dál. Když limit nejde
 * splnit ani tak, úkol se podle AC5 odloží a rozhodne vlastník; limit ani
 * vzhled jisker se nemění.
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

/** Vzorek jisker přes vzor V na obrysu `regions` (viz úvod souboru). */
function glitterOverV(regions: RegionMap): Array<number | null> {
  const v = stripePattern(regions);
  const glitter = glitterPixels(regions.width, regions.height);
  return pixelsOf(
    {
      colorAt(x, y) {
        const base = v.colorAt(x, y);
        if (base === null) {
          return null;
        }
        return glitter.isSparkle(x, y) ? (base + 1) % COLOR_COUNT : base;
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

/** Co nesedí na tahu třpytkami střední velikosti barvou `color` přes prázdný obrázek 900 × 600. */
function onlySparkles(
  game: { colorAt(x: number, y: number): number | null },
  regions: RegionMap,
  path: readonly Point[],
  color = BLUE,
): string[] {
  return glitterStrokeProblems({
    game,
    regions,
    before: pixelsOf({ colorAt: () => null }, regions),
    glitter: glitterPixels(BIG_WIDTH, BIG_HEIGHT),
    path,
    radius: (GLITTER_WIDTH_FACTOR * widthOf('medium')) / 2,
    color,
    region: null,
  });
}

/** Tah třpytkami barvou `color`: výběr barvy, výběr nástroje, tah. */
function glitterStroke(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, GLITTER, color, path);
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
] as const;

const SWIPE: readonly Point[] = [at(60.5, 300.5), at(420.5, 300.5), at(600.5, 420.5)];
const SECOND_SWIPE: readonly Point[] = [at(700.5, 80.5), at(700.5, 520.5)];

describe('#103 AC3: uložený i vrácený obrázek obsahuje jen jiskry ze vzoru', () => {
  it('po tahu třpytkami a návratu do hry jsou v obrázku jen jiskry ze vzoru, žádný lesk', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    glitterStroke(game, SWIPE);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(onlySparkles(reopened, regions, SWIPE), 'po návratu').toEqual([]);
    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
      'stejný obrázek jako ve hře',
    ).toEqual([]);
  });

  it('hned po zvednutí prstu je uložený jen obrázek s jiskrami ze vzoru', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);

    glitterStroke(game, SWIPE);

    expect(onlySparkles(openOn(storage, regions), regions, SWIPE)).toEqual([]);
  });

  it('po Zpět obsahuje obrázek jen jiskry ze vzoru z dřívějšího tahu, i po návratu do hry', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    glitterStroke(game, SWIPE);
    const afterFirst = pixelsOf(game, regions);
    glitterStroke(game, SECOND_SWIPE, BLACK);

    expect(game.tapUndo().kind).toBe('undone');

    expect(
      pixelDifferences(pixelsOf(game, regions), afterFirst, regions.width),
      'stav po prvním tahu',
    ).toEqual([]);
    expect(onlySparkles(game, regions, SWIPE), 've hře jen jiskry prvního tahu').toEqual([]);
    game.suspend();
    expect(
      onlySparkles(openOn(storage, regions), regions, SWIPE),
      'po návratu jen jiskry prvního tahu',
    ).toEqual([]);
  });

  it('Zpět po jediném tahu třpytkami vrátí prázdný obrázek bez zbytků lesku', () => {
    const regions = bigBlank();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    glitterStroke(game, SWIPE);

    game.tapUndo();
    game.suspend();

    const empty = pixelsOf({ colorAt: () => null }, regions);
    expect(pixelDifferences(pixelsOf(game, regions), empty, regions.width), 've hře').toEqual([]);
    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), empty, regions.width),
      'po návratu',
    ).toEqual([]);
  });

  it('uložený záznam je po stejných tazích stejný, ať náhoda lesku padne jakkoli', () => {
    const records: string[] = [];
    for (const value of [0.02, 0.51, 0.98]) {
      vi.spyOn(Math, 'random').mockReturnValue(value);
      const storage = new RecordingStorage();
      const game = openOn(storage, twoHalves());
      drawWith(game, GLITTER, PINK, [at(10, 100), at(140, 100), at(140, 20)]);
      drawWith(game, GLITTER, BLUE, [at(170, 30), at(290, 180)]);
      game.suspend();
      records.push(JSON.stringify([...storage.data].sort()));
      vi.restoreAllMocks();
    }

    expect(records[1], 'druhý záznam').toBe(records[0]);
    expect(records[2], 'třetí záznam').toBe(records[0]);
  });
});

describe('#103 AC5: vzorek jisker přes vzor V se vejde do 50 000 znaků', () => {
  it('vzorek jisker přes vzor V má záznam nejvýš 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      expect(regions.width, 'vrstva jako u ostatních vzorů').toBe(LAYER_WIDTH);
      expect(regions.height, 'vrstva jako u ostatních vzorů').toBe(LAYER_HEIGHT);
      const pixels = glitterOverV(regions);
      expect(usedColors(pixels).length, `${name}: ve vzorku je všech 12 barev`).toBe(COLOR_COUNT);
      // Vzorek musí mít jiskry, jinak by test měřil jen vzor V.
      const v = pixelsOf(stripePattern(regions), regions);
      const changed = pixels.filter((color, index) => color !== v[index]).length;
      const free = v.filter((color) => color !== null).length;
      expect(changed / free, `${name}: díl pixelů jisker`).toBeGreaterThan(GLITTER_SHARE_MIN / 2);
      expect(changed / free, `${name}: díl pixelů jisker`).toBeLessThan(GLITTER_SHARE_MAX * 1.5);

      expectRecordWithinLimit(name, regions, pixels);
    }
  });
});

describe('#103 AC5: obrázek s třpytkami se uloží a obnoví beze změny', () => {
  it('třpytky namalované ve hře se po návratu do hry obnoví pixel po pixelu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    drawWith(game, 'brush', PINK, [at(10, 40), at(140, 160)]);
    drawWith(game, GLITTER, LIGHT_BLUE, [at(10, 100), at(140, 100), at(140, 20)]);
    drawWith(game, 'stripes', BLACK, [at(20, 150), at(130, 150)]);
    drawWith(game, GLITTER, BLUE, [at(170, 30), at(290, 180)]);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
    // Přepsáno k #110 AC5: dřív „vybraná je poslední barva (modrá)“. Od #110
    // má každý nástroj svou barvu: po návratu je vybraný štětec v růžové
    // a nástroj si nechal svou modrou.
    expect(reopened.handleView(), 'štětec').toMatchObject({ tool: 'brush', color: PINK });
    choose(reopened, GLITTER);
    expect(reopened.handleView(), 'nástroj').toMatchObject({ tool: GLITTER, color: BLUE });
  });

  it('obrázek s třpytkami se obnoví i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(PINK);
    choose(game, GLITTER);
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

describe('#103 AC5: dříve uložené obrázky se otevřou beze změny', () => {
  it('pevné záznamy p1, p2, p3, p3 s puntíky a p3 s proužky se přečtou pixel po pixelu a s vybranou barvou', () => {
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

  it('dítě po otevření hry vidí obrázek s proužky uložený před třpytkami i s barvou, nedávnými barvami a velikostí', () => {
    const regions = legacyP3StripesRegions();

    const game = openOn(storageWith(LEGACY_P3_STRIPES_STORAGE), regions);

    expect(
      pixelDifferences(pixelsOf(game, regions), legacyP3StripesPixels(), regions.width),
      'obrázek',
    ).toEqual([]);
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_P3_STRIPES_SELECTED_COLOR);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P3_STRIPES_RECENT_COLORS);
    expect(game.lineSize(), 'velikost').toBe(LEGACY_P3_STRIPES_LINE_SIZE);
  });

  it('výběr třpytek ve starém obrázku a odchod z hry obrázek nezmění', () => {
    for (const { name, storage, regions, pixels } of [
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
      choose(game, GLITTER);
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

  it('starý obrázek s proužky jde dál malovat třpytkami a po návratu je vidět staré i nové', () => {
    const regions = legacyP3StripesRegions();
    const storage = storageWith(LEGACY_P3_STRIPES_STORAGE);
    const game = openOn(storage, regions);
    drawWith(game, GLITTER, PINK, [at(170, 150), at(290, 150)]);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(pixelDifferences(pixelsOf(reopened, regions), drawn, regions.width)).toEqual([]);
    const old = legacyP3StripesPixels();
    const kept = drawn.filter((color, index) => color === old[index] && color !== null).length;
    const added = drawn.filter((color, index) => color !== old[index]).length;
    expect(kept, 'staré tahy zůstaly').toBeGreaterThan(0);
    expect(added, 'třpytky přibyly').toBeGreaterThan(0);
  });
});
