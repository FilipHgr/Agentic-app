import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { DOTS, dotPixels } from './dotsHelpers';
import { choose, drawWith } from './drawingToolHelpers';
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
  LEGACY_P2_RECENT_COLORS,
  LEGACY_P2_RECORD,
  LEGACY_P2_SELECTED_COLOR,
  LEGACY_P2_STORAGE,
  legacyP2Pixels,
  legacyP2Regions,
} from './legacyP2RecordFixture';
import {
  LEGACY_P3_LINE_SIZE,
  LEGACY_P3_RECENT_COLORS,
  LEGACY_P3_RECORD,
  LEGACY_P3_SELECTED_COLOR,
  LEGACY_P3_STORAGE,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
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
import { at } from './strokeHelpers';

/**
 * Testy k #101 AC5 (uložení): vzorek puntíků přes vzor V se vejde do
 * 50 000 znaků, obrázky s puntíky se uloží a obnoví beze změny a dříve
 * uložené obrázky (p1 z #92, p2 z #93, p3 z #100) se otevřou beze změny
 * pixel po pixelu.
 *
 * „Vzorek nástroje přes V“ podle #96: podkladem je vzor V (svislé pruhy
 * šířky W stř zleva bez mezer, barvy dokola přes všech 12 barev, obrys
 * prázdný). Každý pixel puntíků (mřížka pevně umístěná vůči obrázku) má
 * místo barvy pruhu barvu o jednu dál v pořadí palety. Kde jsou pixely
 * puntíků, se zjistí chováním jako ve `dotsStrokes.test.ts`: prázdný
 * obrázek 1024 × 768 se celý přejede puntíkovým fixem (`dotPixels`).
 * Měří se na stejných nejhorších obrysech jako u ostatních nástrojů
 * (prázdný, mřížka, domeček).
 *
 * Vývojář smí kódování zlepšit podle pravidel z #96 (nová verze záznamu),
 * starší záznamy se ale musí číst dál. Když limit nejde splnit, úkol se
 * podle AC5 odloží a vlastník se to dozví; limit ani vzhled puntíků se
 * nemění.
 *
 * Navržené rozhraní: žádné nové (`encodePicture`, `decodePicture`,
 * `openColoring`).
 */

const BLUE = 4;

/** Vzorek puntíků přes vzor V na obrysu `regions` (viz úvod souboru). */
function dotsOverStripes(regions: RegionMap): Array<number | null> {
  const stripes = stripePattern(regions);
  const dots = dotPixels(regions.width, regions.height);
  return pixelsOf(
    {
      colorAt(x, y) {
        const stripe = stripes.colorAt(x, y);
        if (stripe === null) {
          return null;
        }
        return dots.isDot(x, y) ? (stripe + 1) % COLOR_COUNT : stripe;
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

/** Úložiště se starým záznamem p1 pod klíčem, který tam hra sama zapíše. */
function storageWithLegacyP1(): RecordingStorage {
  const storage = new RecordingStorage();
  const game = openOn(storage, legacyRegions());
  game.tapColor(BLUE);
  game.suspend();
  const pictureKeys = storage
    .keys()
    .filter((key) => decodePicture(storage.data.get(key) ?? '', PICTURE, legacyRegions()) !== null);
  storage.data.clear();
  for (const key of pictureKeys) {
    storage.data.set(key, LEGACY_P1_RECORD);
  }
  return storage;
}

describe('#101 AC5: vzorek puntíků přes vzor V se vejde do 50 000 znaků', () => {
  it('vzorek puntíků přes vzor V má záznam nejvýš 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      expect(regions.width, 'vrstva jako u ostatních vzorů').toBe(LAYER_WIDTH);
      expect(regions.height, 'vrstva jako u ostatních vzorů').toBe(LAYER_HEIGHT);
      const pixels = dotsOverStripes(regions);
      expect(usedColors(pixels).length, `${name}: ve vzorku je všech 12 barev`).toBe(COLOR_COUNT);
      // Vzorek musí mít puntíky, jinak by test měřil jen vzor V.
      const stripes = pixelsOf(stripePattern(regions), regions);
      const changed = pixels.filter((color, index) => color !== stripes[index]).length;
      const free = stripes.filter((color) => color !== null).length;
      expect(changed / free, `${name}: díl pixelů puntíků`).toBeGreaterThan(0.25);
      expect(changed / free, `${name}: díl pixelů puntíků`).toBeLessThan(0.45);

      expectRecordWithinLimit(name, regions, pixels);
    }
  });
});

describe('#101 AC5: obrázek s puntíky se uloží a obnoví beze změny', () => {
  it('puntíky namalované ve hře se po návratu do hry obnoví pixel po pixelu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    drawWith(game, 'brush', PINK, [at(10, 40), at(140, 160)]);
    drawWith(game, DOTS, LIGHT_BLUE, [at(10, 100), at(140, 100), at(140, 20)]);
    drawWith(game, DOTS, BLUE, [at(170, 30), at(290, 180)]);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
    // Přepsáno k #110 AC5: dřív „vybraná je poslední barva (modrá)“. Od #110
    // má každý nástroj svou barvu: po návratu je vybraný štětec v růžové
    // a nástroj si nechal svou modrou.
    expect(reopened.handleView(), 'štětec').toMatchObject({ tool: 'brush', color: PINK });
    choose(reopened, DOTS);
    expect(reopened.handleView(), 'nástroj').toMatchObject({ tool: DOTS, color: BLUE });
  });

  it('obrázek s puntíky se obnoví i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(PINK);
    choose(game, DOTS);
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

describe('#101 AC5: dříve uložené obrázky se otevřou beze změny', () => {
  it('pevný záznam p3 uložený před puntíkovým fixem se přečte pixel po pixelu a s vybranou barvou', () => {
    const regions = legacyP3Regions();

    const decoded = decodePicture(LEGACY_P3_RECORD, PICTURE, regions);

    expect(decoded, 'záznam jde přečíst').not.toBeNull();
    expect(decoded?.selectedColor, 'vybraná barva').toBe(LEGACY_P3_SELECTED_COLOR);
    expect(
      pixelDifferences(
        decoded === null ? [] : pixelsOf(decoded.colors, regions),
        legacyP3Pixels(),
        regions.width,
      ),
    ).toEqual([]);
  });

  it('dítě po otevření hry vidí obrázek uložený před puntíkovým fixem i s barvou, nedávnými barvami a velikostí', () => {
    const regions = legacyP3Regions();

    const game = openOn(storageWith(LEGACY_P3_STORAGE), regions);

    expect(
      pixelDifferences(pixelsOf(game, regions), legacyP3Pixels(), regions.width),
      'obrázek',
    ).toEqual([]);
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_P3_SELECTED_COLOR);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P3_RECENT_COLORS);
    expect(game.lineSize(), 'velikost').toBe(LEGACY_P3_LINE_SIZE);
  });

  it('pevné záznamy p1 a p2 se dál přečtou pixel po pixelu a s vybranou barvou', () => {
    for (const { name, record, regions, pixels, selected } of [
      {
        name: 'p1',
        record: LEGACY_P1_RECORD,
        regions: legacyRegions(),
        pixels: legacyPixels(),
        selected: LEGACY_SELECTED_COLOR,
      },
      {
        name: 'p2',
        record: LEGACY_P2_RECORD,
        regions: legacyP2Regions(),
        pixels: legacyP2Pixels(),
        selected: LEGACY_P2_SELECTED_COLOR,
      },
    ]) {
      const decoded = decodePicture(record, PICTURE, regions);

      expect(decoded, `${name}: záznam jde přečíst`).not.toBeNull();
      expect(decoded?.selectedColor, `${name}: vybraná barva`).toBe(selected);
      expect(
        pixelDifferences(
          decoded === null ? [] : pixelsOf(decoded.colors, regions),
          pixels,
          regions.width,
        ),
        `${name}: obrázek`,
      ).toEqual([]);
    }
  });

  it('dítě po otevření hry vidí obrázky ze záznamů p1 a p2 beze změny', () => {
    const p2 = openOn(storageWith(LEGACY_P2_STORAGE), legacyP2Regions());
    expect(
      pixelDifferences(pixelsOf(p2, legacyP2Regions()), legacyP2Pixels(), legacyP2Regions().width),
      'p2',
    ).toEqual([]);
    expect(p2.recentColors(), 'p2: nedávné barvy').toEqual(LEGACY_P2_RECENT_COLORS);

    const p1 = openOn(storageWithLegacyP1(), legacyRegions());
    expect(
      pixelDifferences(pixelsOf(p1, legacyRegions()), legacyPixels(), legacyRegions().width),
      'p1',
    ).toEqual([]);
  });

  it('výběr puntíkového fixu ve starém obrázku a odchod z hry obrázek nezmění', () => {
    for (const { name, storage, regions, pixels } of [
      {
        name: 'p3',
        storage: storageWith(LEGACY_P3_STORAGE),
        regions: legacyP3Regions(),
        pixels: legacyP3Pixels(),
      },
      {
        name: 'p2',
        storage: storageWith(LEGACY_P2_STORAGE),
        regions: legacyP2Regions(),
        pixels: legacyP2Pixels(),
      },
      {
        name: 'p1',
        storage: storageWithLegacyP1(),
        regions: legacyRegions(),
        pixels: legacyPixels(),
      },
    ]) {
      const game = openOn(storage, regions);
      game.tapColor(PINK);
      choose(game, DOTS);
      game.tapLineSize('large');
      game.suspend();

      const reopened = openOn(storage, regions);
      expect(
        pixelDifferences(pixelsOf(reopened, regions), pixels, regions.width),
        `${name}: obrázek beze změny`,
      ).toEqual([]);
      expect(reopened.palette().selected, `${name}: vybraná růžová`).toBe(PINK);
    }
  });
});
