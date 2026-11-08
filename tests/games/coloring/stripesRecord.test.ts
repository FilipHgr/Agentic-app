import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
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
  LEGACY_P2_RECORD,
  LEGACY_P2_SELECTED_COLOR,
  legacyP2Pixels,
  legacyP2Regions,
} from './legacyP2RecordFixture';
import {
  LEGACY_P3_DOTS_LINE_SIZE,
  LEGACY_P3_DOTS_RECENT_COLORS,
  LEGACY_P3_DOTS_RECORD,
  LEGACY_P3_DOTS_SELECTED_COLOR,
  LEGACY_P3_DOTS_STORAGE,
  legacyP3DotsPixels,
  legacyP3DotsRegions,
} from './legacyP3DotsRecordFixture';
import {
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
import { STRIPES, stripePixels } from './stripesHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #102 AC5 (uložení): vzorek proužků přes vzor V se vejde do
 * 50 000 znaků, obrázky s proužky se uloží a obnoví beze změny a dříve
 * uložené obrázky se otevřou beze změny pixel po pixelu: p1 z #92, p2
 * z #93, p3 z #100 a nově i p3 s puntíky z #101
 * (`legacyP3DotsRecordFixture.ts`, stav úložiště těsně před #102).
 *
 * „Vzorek nástroje přes V“ podle #96: podkladem je vzor V (svislé pruhy
 * šířky W stř zleva bez mezer, barvy dokola přes všech 12 barev, obrys
 * prázdný). Každý pixel proužků (pevně umístěných vůči obrázku) má místo
 * barvy pruhu barvu o jednu dál v pořadí palety. Kde jsou pixely proužků,
 * se zjistí chováním jako ve `stripesStrokes.test.ts`: prázdný obrázek
 * 1024 × 768 se celý přejede proužkovým fixem (`stripePixels`). Měří se na
 * stejných nejhorších obrysech jako u ostatních nástrojů (prázdný,
 * mřížka, domeček).
 *
 * Šikmé proužky střídají barvu v každém řádku zhruba po 16 px. Předem
 * odhadovaných asi 55 000 znaků se nepotvrdilo, v p3 je to kolem 33 000. Vývojář smí kódování zlepšit
 * podle pravidel z #96 (nová verze záznamu), starší záznamy se ale musí
 * číst dál. Když limit nejde splnit ani tak, úkol se podle AC5 a otevřené
 * otázky 1 odloží a rozhodne vlastník; limit ani vzhled proužků se nemění.
 *
 * Navržené rozhraní: žádné nové (`encodePicture`, `decodePicture`,
 * `openColoring`); nová verze záznamu (např. `p4`) jen uvnitř
 * `savedPicture.ts` a `colorLayerCode.ts`.
 */

const BLUE = 4;

/** Vzorek proužků přes vzor V na obrysu `regions` (viz úvod souboru). */
function stripesOverV(regions: RegionMap): Array<number | null> {
  const v = stripePattern(regions);
  const stripes = stripePixels(regions.width, regions.height);
  return pixelsOf(
    {
      colorAt(x, y) {
        const base = v.colorAt(x, y);
        if (base === null) {
          return null;
        }
        return stripes.isStripe(x, y) ? (base + 1) % COLOR_COUNT : base;
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
] as const;

describe('#102 AC5: vzorek proužků přes vzor V se vejde do 50 000 znaků', () => {
  it('vzorek proužků přes vzor V má záznam nejvýš 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      expect(regions.width, 'vrstva jako u ostatních vzorů').toBe(LAYER_WIDTH);
      expect(regions.height, 'vrstva jako u ostatních vzorů').toBe(LAYER_HEIGHT);
      const pixels = stripesOverV(regions);
      expect(usedColors(pixels).length, `${name}: ve vzorku je všech 12 barev`).toBe(COLOR_COUNT);
      // Vzorek musí mít proužky, jinak by test měřil jen vzor V.
      const v = pixelsOf(stripePattern(regions), regions);
      const changed = pixels.filter((color, index) => color !== v[index]).length;
      const free = v.filter((color) => color !== null).length;
      expect(changed / free, `${name}: díl pixelů proužků`).toBeGreaterThan(0.4);
      expect(changed / free, `${name}: díl pixelů proužků`).toBeLessThan(0.6);

      expectRecordWithinLimit(name, regions, pixels);
    }
  });
});

describe('#102 AC5: obrázek s proužky se uloží a obnoví beze změny', () => {
  it('proužky namalované ve hře se po návratu do hry obnoví pixel po pixelu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    drawWith(game, 'brush', PINK, [at(10, 40), at(140, 160)]);
    drawWith(game, STRIPES, LIGHT_BLUE, [at(10, 100), at(140, 100), at(140, 20)]);
    drawWith(game, 'dots', 7, [at(20, 150), at(130, 150)]);
    drawWith(game, STRIPES, BLUE, [at(170, 30), at(290, 180)]);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
    // Přepsáno k #110 AC5: dřív „vybraná je poslední barva (modrá)“. Od #110
    // má každý nástroj svou barvu: po návratu je vybraný štětec v růžové
    // a nástroj si nechal svou modrou.
    expect(reopened.handleView(), 'štětec').toMatchObject({ tool: 'brush', color: PINK });
    choose(reopened, STRIPES);
    expect(reopened.handleView(), 'nástroj').toMatchObject({ tool: STRIPES, color: BLUE });
  });

  it('obrázek s proužky se obnoví i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(PINK);
    choose(game, STRIPES);
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

describe('#102 AC5: dříve uložené obrázky se otevřou beze změny', () => {
  it('pevné záznamy p1, p2, p3 a p3 s puntíky se přečtou pixel po pixelu a s vybranou barvou', () => {
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

  it('dítě po otevření hry vidí obrázek s puntíky uložený před proužkovým fixem i s barvou, nedávnými barvami a velikostí', () => {
    const regions = legacyP3DotsRegions();

    const game = openOn(storageWith(LEGACY_P3_DOTS_STORAGE), regions);

    expect(
      pixelDifferences(pixelsOf(game, regions), legacyP3DotsPixels(), regions.width),
      'obrázek',
    ).toEqual([]);
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_P3_DOTS_SELECTED_COLOR);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P3_DOTS_RECENT_COLORS);
    expect(game.lineSize(), 'velikost').toBe(LEGACY_P3_DOTS_LINE_SIZE);
  });

  it('výběr proužkového fixu ve starém obrázku a odchod z hry obrázek nezmění', () => {
    for (const { name, storage, regions, pixels } of [
      {
        name: 'p3 s puntíky',
        storage: storageWith(LEGACY_P3_DOTS_STORAGE),
        regions: legacyP3DotsRegions(),
        pixels: legacyP3DotsPixels(),
      },
      {
        name: 'p3',
        storage: storageWith(LEGACY_P3_STORAGE),
        regions: legacyP3Regions(),
        pixels: legacyP3Pixels(),
      },
    ]) {
      const game = openOn(storage, regions);
      game.tapColor(PINK);
      choose(game, STRIPES);
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

  it('starý obrázek s puntíky jde dál malovat proužky a po návratu je vidět staré i nové', () => {
    const regions = legacyP3DotsRegions();
    const storage = storageWith(LEGACY_P3_DOTS_STORAGE);
    const game = openOn(storage, regions);
    drawWith(game, STRIPES, PINK, [at(170, 150), at(290, 150)]);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(pixelDifferences(pixelsOf(reopened, regions), drawn, regions.width)).toEqual([]);
    const old = legacyP3DotsPixels();
    const kept = drawn.filter((color, index) => color === old[index] && color !== null).length;
    expect(kept, 'staré tahy zůstaly').toBeGreaterThan(0);
  });
});
