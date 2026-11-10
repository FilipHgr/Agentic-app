import { describe, expect, it } from 'vitest';

import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
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
  LEGACY_P2_SELECTED_COLOR,
  LEGACY_P2_STORAGE,
  legacyP2Pixels,
  legacyP2Regions,
} from './legacyP2RecordFixture';
import {
  LEGACY_P3_DOTS_SELECTED_COLOR,
  LEGACY_P3_DOTS_STORAGE,
  legacyP3DotsPixels,
  legacyP3DotsRegions,
} from './legacyP3DotsRecordFixture';
import {
  LEGACY_P3_GLITTER_SELECTED_COLOR,
  LEGACY_P3_GLITTER_STORAGE,
  legacyP3GlitterPixels,
  legacyP3GlitterRegions,
} from './legacyP3GlitterRecordFixture';
import {
  LEGACY_P3_SELECTED_COLOR,
  LEGACY_P3_STORAGE,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
import {
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
import { TOOL_NAMES } from './lineSizeHelpers';
import { PICTURE_KEY, TEST_PALETTE_SIZE, encodeWithTestPalette } from './manyColorsHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  keysAddedBy110,
  openOn,
  paint,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { COLOR_TOOLS, pickTool, toolColorsOf } from './toolColorsHelpers';
import type { ColorTool } from './toolColorsHelpers';
import {
  ALL_COLOR_COUNT,
  BRUSH_SET,
  DEFAULT_HEXES,
  PLACE_NAMES,
  SET_SIZE,
  TOOL_SETS,
  allSetColors,
  giveToolPlace,
  hexOf,
} from './toolColorSetsHelpers';

/**
 * Testy k #116 AC5 (starší uložené stavy) a AC6 první část (obrázek
 * namalovaný barvami ze všech sad se obnoví pixel po pixelu). Limit
 * z AC6 je v `toolColorSetsLimit.test.ts`.
 *
 * Pevné záznamy (p1 z #92, p2 z #93, p3 z #100 až #111) se nikdy
 * neregenerují. Záznam barev nástrojů z #110 je v pevném úložišti
 * `LEGACY_BEFORE_111_STORAGE`: štětec modrá, fix černá, pastelka oranžová,
 * razítkový fix žlutá, puntíkový fix zelená, proužkový fix modrá, třpytky
 * růžová, sprej fialová (vše barvy štětce). Pastelka, puntíkový
 * a proužkový fix, třpytky a sprej tyto barvy ve své sadě nemají (AC5,
 * otázka 2; puntíkový podle tabulky v2).
 *
 * Navržené rozhraní: viz `toolColorSets.test.ts` (`colorStep()`,
 * `markedColorPlace()`).
 */

/** Pevný starý stav úložiště hry jednoho profilu a co má hra po otevření ukázat. */
interface LegacyCase {
  readonly name: string;
  readonly storage: ReadonlyArray<readonly [string, string]>;
  readonly regions: () => RegionMap;
  readonly pixels: () => Array<number | null>;
  readonly selectedColor: number;
}

/** Všechny pevné záznamy, které hra kdy uložila. */
const LEGACY_CASES: readonly LegacyCase[] = [
  {
    name: 'p1 z #92',
    storage: [[PICTURE_KEY, LEGACY_P1_RECORD]],
    regions: legacyRegions,
    pixels: legacyPixels,
    selectedColor: LEGACY_SELECTED_COLOR,
  },
  {
    name: 'p2 z #93',
    storage: LEGACY_P2_STORAGE,
    regions: legacyP2Regions,
    pixels: legacyP2Pixels,
    selectedColor: LEGACY_P2_SELECTED_COLOR,
  },
  {
    name: 'p3 z #100',
    storage: LEGACY_P3_STORAGE,
    regions: legacyP3Regions,
    pixels: legacyP3Pixels,
    selectedColor: LEGACY_P3_SELECTED_COLOR,
  },
  {
    name: 'p3 s puntíky z #101',
    storage: LEGACY_P3_DOTS_STORAGE,
    regions: legacyP3DotsRegions,
    pixels: legacyP3DotsPixels,
    selectedColor: LEGACY_P3_DOTS_SELECTED_COLOR,
  },
  {
    name: 'p3 s proužky z #102',
    storage: LEGACY_P3_STRIPES_STORAGE,
    regions: legacyP3StripesRegions,
    pixels: legacyP3StripesPixels,
    selectedColor: LEGACY_P3_STRIPES_SELECTED_COLOR,
  },
  {
    name: 'p3 s třpytkami z #103',
    storage: LEGACY_P3_GLITTER_STORAGE,
    regions: legacyP3GlitterRegions,
    pixels: legacyP3GlitterPixels,
    selectedColor: LEGACY_P3_GLITTER_SELECTED_COLOR,
  },
  {
    name: 'p3 s barvami nástrojů z #110',
    storage: LEGACY_BEFORE_111_STORAGE,
    regions: legacyBefore111Regions,
    pixels: legacyBefore111Pixels,
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

/** Hra otevřená nad pevným úložištěm z #110. */
function openLegacy110(): { game: SavedColoring; regions: RegionMap; storage: RecordingStorage } {
  const regions = legacyBefore111Regions();
  const storage = legacyStorage(LEGACY_BEFORE_111_STORAGE);
  return { game: openOn(storage, regions), regions, storage };
}

/** Uložená barva nástroje z #110 (číslo barvy štětce). */
function legacyColorOf(tool: ColorTool): number {
  return LEGACY_BEFORE_111_TOOL_COLORS[tool] ?? -1;
}

/** Má nástroj uloženou barvu z #110 ve své sadě? Podle tabulky ze zadání (v2). */
function legacyColorInSet(tool: ColorTool): boolean {
  return TOOL_SETS[tool].includes(BRUSH_SET[legacyColorOf(tool)] ?? '');
}

function placeName(place: number): string {
  return `místo ${place + 1} (${PLACE_NAMES[place] ?? '?'})`;
}

/** Tah v oblasti A, kam starý obrázek z #110 ještě nesahá jen jednou barvou. */
const STROKE = [at(20, 20), at(60, 20)];

/** Barvy, které změnil tah: porovnání před a po. */
function strokeColors(before: ReadonlyArray<number | null>, after: ReadonlyArray<number | null>) {
  return usedColors(after.filter((color, index) => color !== before[index]));
}

describe('#116 AC5: starší uložené stavy', () => {
  it('obrázky p1 až p3 se otevřou pixel po pixelu beze změny a se stejnou vybranou barvou', () => {
    for (const legacy of LEGACY_CASES) {
      const regions = legacy.regions();
      const game = openOn(legacyStorage(legacy.storage), regions);

      expect(
        pixelDifferences(pixelsOf(game, regions), legacy.pixels(), regions.width),
        `${legacy.name}: starý obrázek`,
      ).toEqual([]);
      expect(game.palette().selected, `${legacy.name}: vybraná barva`).toBe(legacy.selectedColor);
    }
  });

  it('kontrola tabulky: pastelka, puntíkový a proužkový fix, třpytky a sprej nemají uloženou barvu z #110 ve své sadě', () => {
    const outside = COLOR_TOOLS.filter((tool) => !legacyColorInSet(tool));
    // Podle tabulky v2 nemá puntíkový fix zelenou štětce (místo 4 je #00C08A).
    expect(outside).toEqual(['crayon', 'dots', 'stripes', 'glitter', 'spray']);
  });

  it('záznam barev nástrojů z #110 se přečte: každý nástroj má svou uloženou barvu', () => {
    const { game } = openLegacy110();
    for (const tool of COLOR_TOOLS) {
      expect(game.toolColor(tool), TOOL_NAMES[tool]).toBe(legacyColorOf(tool));
    }
  });

  it('uložená barva ve vlastní sadě nástroje je v kroku barev označená na svém místě', () => {
    for (const tool of COLOR_TOOLS.filter(legacyColorInSet)) {
      const { game } = openLegacy110();
      pickTool(game, tool);
      expect(game.markedColorPlace(), TOOL_NAMES[tool]).toBe(
        TOOL_SETS[tool].indexOf(BRUSH_SET[legacyColorOf(tool)] ?? ''),
      );
    }
  });

  it('nástroj s uloženou barvou mimo svou sadu nemá v kroku barev označenou žádnou barvu', () => {
    for (const tool of COLOR_TOOLS.filter((each) => !legacyColorInSet(each))) {
      const { game } = openLegacy110();
      pickTool(game, tool);
      expect(game.markedColorPlace(), TOOL_NAMES[tool]).toBeNull();
      expect(game.toolColor(tool), `${TOOL_NAMES[tool]}: barva zůstala`).toBe(legacyColorOf(tool));
    }
  });

  it('nástroj s uloženou barvou mimo svou sadu jí maluje až do výběru jiné, i po návratu do hry', () => {
    for (const tool of COLOR_TOOLS.filter((each) => !legacyColorInSet(each))) {
      const { game, regions, storage } = openLegacy110();
      // Mezitím dítě maluje jiným nástrojem.
      const other: ColorTool = tool === 'brush' ? 'marker' : 'brush';
      giveToolPlace(game, other, 9);
      game.suspend();

      const again = openOn(storage, regions);
      pickTool(again, tool);
      again.tapHandle();
      const before = pixelsOf(again, regions);
      paint(again, STROKE);

      const name = TOOL_NAMES[tool];
      expect(again.toolColor(tool), `${name}: barva po návratu`).toBe(legacyColorOf(tool));
      expect(strokeColors(before, pixelsOf(again, regions)), `${name}: tah`).toEqual([
        legacyColorOf(tool),
      ]);
    }
  });

  it('výběr barvy ze sady nahradí uloženou barvu mimo sadu a místo je pak označené', () => {
    for (const tool of COLOR_TOOLS.filter((each) => !legacyColorInSet(each))) {
      for (const place of [0, 6, 11]) {
        const { game, regions, storage } = openLegacy110();
        giveToolPlace(game, tool, place);

        const what = `${TOOL_NAMES[tool]}, ${placeName(place)}`;
        expect(hexOf(game.toolColor(tool)), `${what}: barva`).toBe(TOOL_SETS[tool][place]);
        pickTool(game, tool);
        expect(game.markedColorPlace(), `${what}: označené místo`).toBe(place);
        game.suspend();

        const again = openOn(storage, regions);
        pickTool(again, tool);
        expect(again.markedColorPlace(), `${what}: po návratu`).toBe(place);
      }
    }
  });

  it('nedávnou barvu mimo sadu nástroj po ťuknutí dostane tak, jak je, a maluje jí', () => {
    const regions = twoHalves();
    for (const tool of COLOR_TOOLS) {
      for (let brushPlace = 0; brushPlace < SET_SIZE; brushPlace += 1) {
        const brushHex = BRUSH_SET[brushPlace] ?? '';
        if (TOOL_SETS[tool].includes(brushHex) || tool === 'brush') {
          continue;
        }
        const game = openOn(new RecordingStorage(), regions);
        // Štětec dostane barvu z místa `brushPlace` a pak jinou, barva štětce je nedávná.
        giveToolPlace(game, 'brush', brushPlace);
        const recentColor = game.toolColor('brush');
        giveToolPlace(game, 'brush', brushPlace === 0 ? 1 : 0);
        const slot = game.recentColors().indexOf(recentColor);
        expect(slot, `kontrola: ${brushHex} je mezi nedávnými`).toBeGreaterThanOrEqual(0);
        pickTool(game, tool);
        game.tapHandle();

        game.tapRecentColor(slot);

        const what = `${TOOL_NAMES[tool]}, nedávná ${brushHex}`;
        expect(game.selectedTool(), `${what}: nástroj`).toBe(tool);
        expect(game.toolColor(tool), `${what}: barva tak, jak je`).toBe(recentColor);
        expect(hexOf(game.toolColor(tool)), `${what}: odstín`).toBe(brushHex);
        pickTool(game, tool);
        expect(game.markedColorPlace(), `${what}: nic označeného`).toBeNull();
        game.tapHandle();
        const before = pixelsOf(game, regions);
        paint(game, STROKE);
        expect(strokeColors(before, pixelsOf(game, regions)), `${what}: tah`).toEqual([
          recentColor,
        ]);
      }
    }
  });

  it('záznam barev nástrojů s barvou, kterou hra nezná, se nepoužije a nástroje dostanou barvu obrázku (#110 AC6)', () => {
    const regions = twoHalves();
    for (const unknown of [ALL_COLOR_COUNT, ALL_COLOR_COUNT + 5, TEST_PALETTE_SIZE - 1]) {
      // Uložený obrázek z dnešní hry: štětec namaluje tah barvou z místa 5.
      const saved = new RecordingStorage();
      const today = openOn(saved, regions);
      giveToolPlace(today, 'brush', 4);
      paint(today, STROKE);
      today.suspend();
      const selected = today.palette().selected;

      // Záznam barev nástrojů, ve kterém má štětec barvu `unknown` (hra se 64 barvami ji zná).
      const future = new RecordingStorage();
      const wider = openColoring({
        regions,
        picture: PICTURE,
        storage: future,
        paletteSize: TEST_PALETTE_SIZE,
      });
      wider.tapColor(unknown);
      wider.suspend();
      const storage = new RecordingStorage();
      for (const [key, value] of saved.data) {
        storage.data.set(key, value);
      }
      for (const key of keysAddedBy110(future)) {
        storage.data.set(key, future.data.get(key) ?? '');
      }

      let game: SavedColoring | null = null;
      expect(() => {
        game = openOn(storage, regions);
      }, `barva ${unknown}: hra se nezastaví`).not.toThrow();
      const opened = game as SavedColoring | null;
      expect(
        opened === null ? null : toolColorsOf(opened),
        `barva ${unknown}: všech 8 nástrojů v barvě obrázku`,
      ).toEqual(Object.fromEntries(COLOR_TOOLS.map((tool) => [tool, selected])));
    }
  });

  it('obrázek s barvou, kterou hra nezná, je prázdná omalovánka s výchozími barvami (#100 AC5)', () => {
    const regions = twoHalves();
    for (const unknown of [ALL_COLOR_COUNT, TEST_PALETTE_SIZE - 1]) {
      for (const [what, pixel, selected] of [
        ['pixely', unknown, 0],
        ['vybraná barva', 0, unknown],
      ] as const) {
        const storage = new RecordingStorage();
        const pixels = pixelsOf({ colorAt: (x) => (x < 150 ? pixel : null) }, regions);
        storage.data.set(PICTURE_KEY, encodeWithTestPalette(regions, pixels, selected));

        const game = openOn(storage, regions);

        const label = `${what} v barvě ${unknown}`;
        expect(usedColors(pixelsOf(game, regions)), `${label}: prázdná omalovánka`).toEqual([]);
        for (const tool of COLOR_TOOLS) {
          expect(hexOf(game.toolColor(tool)), `${label}: ${TOOL_NAMES[tool]}`).toBe(
            DEFAULT_HEXES[tool],
          );
        }
      }
    }
  });

  it('obrázek s nejvyšší barvou ze sad, uložený formátem p4, se otevře', () => {
    const regions = twoHalves();
    const highest = Math.max(...allSetColors(openOn(new RecordingStorage(), regions)));
    expect(highest, 'kontrola: barvy sad jsou 0 až 45').toBe(ALL_COLOR_COUNT - 1);
    const storage = new RecordingStorage();
    // Čára obrysu (x 150 a 151) barvu nemá.
    const pixels = pixelsOf({ colorAt: (x) => (x < 150 ? highest : x > 151 ? 0 : null) }, regions);
    storage.data.set(PICTURE_KEY, encodeWithTestPalette(regions, pixels, highest));

    const game = openOn(storage, regions);

    expect(pixelDifferences(pixelsOf(game, regions), pixels, regions.width)).toEqual([]);
    expect(game.palette().selected).toBe(highest);
  });
});

/** Sloupce tahů v oblasti A a B zkušebního obrázku (mimo čáru x 150 a 151). */
const STROKE_XS = [5, 28, 51, 74, 97, 120, 165, 188, 211, 234, 257, 280];

/**
 * Dítě namaluje každým nástrojem každou barvu jeho sady krátký tah na
 * vlastním místě mřížky 12 × 8 (řádek = nástroj, sloupec = místo).
 */
function paintAllSets(game: SavedColoring): void {
  COLOR_TOOLS.forEach((tool, row) => {
    for (let place = 0; place < SET_SIZE; place += 1) {
      giveToolPlace(game, tool, place);
      const x = STROKE_XS[place] ?? 0;
      const y = 10 + row * 24;
      paint(game, [at(x, y), at(x + 8, y + 4)]);
    }
  });
}

describe('#116 AC6: obrázek namalovaný barvami ze všech sad se obnoví', () => {
  it('po návratu do hry je obrázek se všemi 46 barvami stejný pixel po pixelu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    paintAllSets(game);
    const painted = pixelsOf(game, regions);
    expect(usedColors(painted).length, 'v obrázku je všech 46 barev').toBe(ALL_COLOR_COUNT);
    const colors = toolColorsOf(game);
    game.suspend();

    const again = openOn(storage, regions);

    expect(pixelDifferences(pixelsOf(again, regions), painted, regions.width)).toEqual([]);
    expect(toolColorsOf(again), 'barvy nástrojů').toEqual(colors);
  });

  it('po obnovení stránky je obrázek se všemi 46 barvami stejný pixel po pixelu', () => {
    const regions = twoHalves();
    const device = new DeviceStorage();
    const game = enterColoring(openProfiles(device), regions);
    paintAllSets(game);
    const painted = pixelsOf(game, regions);
    expect(usedColors(painted).length, 'v obrázku je všech 46 barev').toBe(ALL_COLOR_COUNT);
    const colors = toolColorsOf(game);
    game.suspend();

    const again = enterColoring(openProfiles(device), regions);

    expect(pixelDifferences(pixelsOf(again, regions), painted, regions.width)).toEqual([]);
    expect(toolColorsOf(again), 'barvy nástrojů').toEqual(colors);
    expect(
      openProfiles(device).gameStorage(COLORING_META.id).getItem(PICTURE_KEY),
      'obrázek je v úložišti hry profilu',
    ).not.toBeNull();
  });

  it('starý obrázek z #110 s novým tahem barvou ze sady se po obnovení stránky obnoví celý', () => {
    const regions = legacyBefore111Regions();
    const device = new DeviceStorage();
    const gameStorage = openProfiles(device).gameStorage(COLORING_META.id);
    for (const [key, value] of LEGACY_BEFORE_111_STORAGE) {
      gameStorage.setItem(key, value);
    }
    expect(gameStorage.getItem(PICTURE_KEY), 'kontrola: starý záznam').toBe(
      LEGACY_BEFORE_111_RECORD,
    );
    const game = enterColoring(openProfiles(device), regions);
    giveToolPlace(game, 'glitter', 2);
    paint(game, STROKE);
    const painted = pixelsOf(game, regions);
    game.suspend();

    const again = enterColoring(openProfiles(device), regions);

    expect(pixelDifferences(pixelsOf(again, regions), painted, regions.width)).toEqual([]);
    expect(hexOf(again.toolColor('glitter')), 'zlaté třpytky').toBe('#C9A227');
  });
});
