import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { choose } from './drawingToolHelpers';
import {
  COLOR_COUNT,
  GRAY,
  LIGHT_BLUE,
  NEW_COLORS,
  PINK,
  RECORD_LIMIT,
  SKIN,
  crayonPattern,
  isKnownColor,
  pixelDifferences,
  stripePattern,
  usedColors,
  verticalStrokes,
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
  LEGACY_P1_RECORD,
  LEGACY_SELECTED_COLOR,
  legacyPixels,
  legacyRegions,
} from './legacyRecordFixture';
import { seededRandom, pick } from './recentColorsHelpers';
import { RAINBOW } from './rainbowHelpers';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #100 AC3 (staré obrázky), AC4 (uložení a limit 50 000 znaků)
 * a AC5 první část (záznam s neznámou barvou).
 *
 * AC3: obrázek uložený verzí s 8 barvami se otevře beze změny pixel po
 * pixelu a se stejnou vybranou barvou. Ověřuje se na dvou pevných
 * záznamech: p1 z #92 (`legacyRecordFixture.ts`) a celé úložiště hry po
 * verzi s p2 a nedávnými barvami z #99 (`legacyP2RecordFixture.ts`).
 *
 * AC4: vzor V z #96, který teď střídá všech 12 barev, a vzory hotových
 * nástrojů (pastelka z #93, duha z #97 a razítkový fix z #98, svislé tahy
 * přes celou plochu) se vejdou do 50 000 znaků a přečtou se beze ztráty.
 * Vývojář smí kódování zlepšit (nový formát), staré záznamy se ale musí
 * číst dál. Když limit nejde splnit, úkol se odloží a vlastník se to dozví;
 * limit se nemění.
 *
 * AC5: záznam s neznámou barvou (mimo 12 barev) se ukáže jako prázdná
 * omalovánka s první barvou a hra se nezastaví. Kódování nových záznamů
 * testy neznají, proto se u nich hlídá jen to, že ani poškozený záznam
 * nikdy neukáže barvu mimo paletu. U starého formátu p2 (pevný, už se
 * nemění) se neznámá vybraná barva zapíše přímo s platným kontrolním
 * součtem podle popisu záznamu v `savedPicture.ts`.
 *
 * Navržené rozhraní: žádné nové (`encodePicture`, `decodePicture`,
 * `openColoring`). Kódování může dostat novou verzi (např. `p3`)
 * s hodnotou pixelu pro 12 barev a prázdno; `p1` a `p2` se čtou podle
 * svého původního pravidla (8 barev a prázdno), i když `PALETTE` má 12 barev.
 */

/** Úložiště hry se starým stavem z verze s p2 a nedávnými barvami. */
function storageWithLegacyP2(): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of LEGACY_P2_STORAGE) {
    storage.data.set(key, value);
  }
  return storage;
}

/** Úložiště se starým záznamem p1 pod klíčem, který tam hra sama zapíše. */
function storageWithLegacyP1(): RecordingStorage {
  const storage = new RecordingStorage();
  const game = openOn(storage, legacyRegions());
  game.tapColor(4);
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

/** Kontrolní součet FNV-1a záznamu p2 (popis záznamu v `savedPicture.ts`). */
function legacyChecksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Starý záznam p2 s jinou vybranou barvou a platným kontrolním součtem. */
function legacyP2WithSelected(selected: string): string {
  const fields = LEGACY_P2_RECORD.split('|');
  fields[5] = selected;
  const body = fields.slice(0, -1).join('|');
  return `${body}|${legacyChecksum(body)}`;
}

/** Hra namaluje každou novou barvou jeden tah a vybere světle modrou. */
function paintNewColors(game: SavedColoring): void {
  NEW_COLORS.forEach((color, order) => {
    game.tapColor(color);
    const y = 20 + order * 45;
    paint(game, [at(10, y), at(140, y + 20)]);
  });
  game.tapColor(3);
  paint(game, [at(170, 20), at(290, 180)]);
  game.tapColor(LIGHT_BLUE);
}

describe('#100 AC3: obrázek uložený verzí s 8 barvami se otevře beze změny', () => {
  it('pevný starý záznam p2 se přečte pixel po pixelu a s vybranou barvou', () => {
    const regions = legacyP2Regions();

    const decoded = decodePicture(LEGACY_P2_RECORD, PICTURE, regions);

    expect(decoded, 'starý záznam jde přečíst').not.toBeNull();
    expect(decoded?.selectedColor, 'vybraná barva').toBe(LEGACY_P2_SELECTED_COLOR);
    expect(
      pixelDifferences(
        decoded === null ? [] : pixelsOf(decoded.colors, regions),
        legacyP2Pixels(),
        regions.width,
      ),
    ).toEqual([]);
  });

  it('pevný starý záznam p1 se přečte pixel po pixelu a s vybranou barvou', () => {
    const regions = legacyRegions();

    const decoded = decodePicture(LEGACY_P1_RECORD, PICTURE, regions);

    expect(decoded, 'starý záznam jde přečíst').not.toBeNull();
    expect(decoded?.selectedColor, 'vybraná barva').toBe(LEGACY_SELECTED_COLOR);
    expect(
      pixelDifferences(
        decoded === null ? [] : pixelsOf(decoded.colors, regions),
        legacyPixels(),
        regions.width,
      ),
    ).toEqual([]);
  });

  it('dítě po otevření hry vidí obrázek staré verze s vybranou barvou i nedávnými barvami', () => {
    const regions = legacyP2Regions();

    const game = openOn(storageWithLegacyP2(), regions);

    expect(
      pixelDifferences(pixelsOf(game, regions), legacyP2Pixels(), regions.width),
      'starý obrázek',
    ).toEqual([]);
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_P2_SELECTED_COLOR);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P2_RECENT_COLORS);
  });

  it('dítě po otevření hry vidí obrázek ze záznamu p1 s vybranou barvou', () => {
    const regions = legacyRegions();

    const game = openOn(storageWithLegacyP1(), regions);

    expect(
      pixelDifferences(pixelsOf(game, regions), legacyPixels(), regions.width),
      'starý obrázek',
    ).toEqual([]);
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_SELECTED_COLOR);
  });

  it('do starého obrázku jde malovat novou barvou a po návratu je starý obrázek i nový tah', () => {
    for (const { name, storage, regions, pixels } of [
      {
        name: 'p2',
        storage: storageWithLegacyP2(),
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
      paint(game, [at(30, 75), at(50, 75)]);
      const after = pixelsOf(game, regions);
      const changed = after.filter((color, index) => color !== pixels[index]);
      expect(changed.length, `${name}: tah něco namaloval`).toBeGreaterThan(0);
      expect(usedColors(changed), `${name}: tah je růžový`).toEqual([PINK]);
      game.suspend();

      const reopened = openOn(storage, regions);
      expect(
        pixelDifferences(pixelsOf(reopened, regions), after, regions.width),
        `${name}: uloží se celý obrázek`,
      ).toEqual([]);
      expect(reopened.palette().selected, `${name}: vybraná růžová`).toBe(PINK);
    }
  });

  it('starý stav s nedávnými barvami se po výběru nové barvy posune podle pravidla z #99', () => {
    const regions = legacyP2Regions();
    const storage = storageWithLegacyP2();
    const game = openOn(storage, regions);

    game.tapColor(GRAY);

    expect(game.recentColors()).toEqual([LEGACY_P2_SELECTED_COLOR, LEGACY_P2_RECENT_COLORS[0]]);
    game.suspend();
    expect(openOn(storage, regions).recentColors()).toEqual([
      LEGACY_P2_SELECTED_COLOR,
      LEGACY_P2_RECENT_COLORS[0],
    ]);
  });
});

describe('#100 AC4: obrázek s novými barvami se uloží a obnoví beze změny', () => {
  it('obrázek namalovaný novými barvami se po návratu do hry obnoví pixel po pixelu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    paintNewColors(game);
    expect(usedColors(pixelsOf(game, regions))).toEqual([3, ...NEW_COLORS]);
    game.suspend();

    const reopened = openOn(storage, regions);

    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
    expect(reopened.palette().selected).toBe(LIGHT_BLUE);
  });

  it('obrázek s novými barvami se obnoví i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    paintNewColors(game);
    game.suspend();

    const again = enterColoring(openProfiles(storage), regions);

    expect(
      pixelDifferences(pixelsOf(again, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
    expect(again.palette().selected).toBe(LIGHT_BLUE);
  });

  it('každá z 12 barev jako vybraná barva se uloží a přečte beze změny', () => {
    const regions = twoHalves();
    const colors = { colorAt: (x: number) => (x < 150 ? SKIN : null) };
    for (let selected = 0; selected < COLOR_COUNT; selected += 1) {
      const record = encodePicture({ picture: PICTURE, regions, colors, selectedColor: selected });
      const decoded = decodePicture(record, PICTURE, regions);
      expect(decoded?.selectedColor, `vybraná barva ${selected}`).toBe(selected);
    }
  });

  it('Zpět po tahu novou barvou vrátí obrázek a vrácený stav se uloží', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    game.tapColor(GRAY);
    paint(game, [at(20, 100), at(140, 100)]);
    game.tapColor(PINK);
    paint(game, [at(20, 60), at(140, 140)]);

    game.tapUndo();
    game.suspend();

    const reopened = openOn(storage, regions);
    expect(usedColors(pixelsOf(reopened, regions))).toEqual([GRAY]);
    expect(
      pixelDifferences(pixelsOf(reopened, regions), pixelsOf(game, regions), regions.width),
    ).toEqual([]);
  });
});

describe('#100 AC4: vzory s 12 barvami se vejdou do 50 000 znaků', () => {
  it('vzor V, který střídá všech 12 barev, se vejde do 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pattern = stripePattern(regions);
      const pixels = pixelsOf(pattern, regions);
      expect(usedColors(pixels).length, `${name}: ve vzoru je všech 12 barev`).toBe(COLOR_COUNT);
      for (const selectedColor of [0, LIGHT_BLUE]) {
        const what = `${name}, vybraná ${selectedColor}`;
        const record = encodePicture({ picture: PICTURE, regions, colors: pattern, selectedColor });
        expect(record.length, `${what}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

        const decoded = decodePicture(record, PICTURE, regions);
        expect(decoded, `${what}: záznam jde přečíst`).not.toBeNull();
        expect(decoded?.selectedColor, `${what}: vybraná barva`).toBe(selectedColor);
        expect(
          pixelDifferences(
            decoded === null ? [] : pixelsOf(decoded.colors, regions),
            pixels,
            regions.width,
          ),
          `${what}: stejný obrázek pixel po pixelu`,
        ).toEqual([]);
      }
    }
  });

  it('vzor V s 12 barvami nakreslený pastelkou se vejde do 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pixels = pixelsOf(crayonPattern(regions), regions);
      expect(usedColors(pixels).length, `${name}: v obrázku je všech 12 barev`).toBe(COLOR_COUNT);
      // Pastelka má v obrázku nechat zrno, jinak by test měřil jen plnou barvu.
      const empty = pixels.filter((color) => color === null).length;
      expect(empty / pixels.length, `${name}: v obrázku jsou mezery zrna`).toBeGreaterThan(0.1);

      expectRecordWithinLimit(name, regions, pixels);
    }
  });

  it('svislé tahy duhou přes celou plochu se i s 12 barvami vejdou do 50 000 znaků', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pixels = pixelsOf(verticalStrokes(regions, 'rainbow'), regions);
      const used = usedColors(pixels);
      expect(used.length, `${name}: obrázek není prázdný`).toBeGreaterThan(0);
      for (const color of used) {
        expect(RAINBOW, `${name}: duha má jen svých 6 barev`).toContain(color);
      }

      expectRecordWithinLimit(name, regions, pixels);
    }
  });

  it('svislé tahy razítkovým fixem přes všech 12 barev se vejdou do 50 000 znaků', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pixels = pixelsOf(verticalStrokes(regions, 'stamp'), regions);
      const used = usedColors(pixels);
      expect(used.length, `${name}: hvězdičky ve všech 12 barvách`).toBe(COLOR_COUNT);

      expectRecordWithinLimit(name, regions, pixels);
    }
  });
});

/** Obrázek s pixely `pixels` se vejde do limitu a přečte se beze ztráty. */
function expectRecordWithinLimit(
  name: string,
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
): void {
  const colors = {
    colorAt: (x: number, y: number) => pixels[y * regions.width + x] ?? null,
  };
  const record = encodePicture({ picture: PICTURE, regions, colors, selectedColor: LIGHT_BLUE });
  expect(record.length, `${name}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

  const decoded = decodePicture(record, PICTURE, regions);
  expect(decoded, `${name}: záznam jde přečíst`).not.toBeNull();
  expect(
    pixelDifferences(
      decoded === null ? [] : pixelsOf(decoded.colors, regions),
      pixels,
      regions.width,
    ),
    `${name}: stejný obrázek pixel po pixelu`,
  ).toEqual([]);
}

describe('#100 AC5: záznam s neznámou barvou se ukáže jako prázdná omalovánka', () => {
  it('starý záznam s vybranou barvou mimo 12 barev dá prázdnou omalovánku a první barvu', () => {
    const regions = legacyP2Regions();
    // Kontrola pomůcky: beze změny barvy je záznam platný.
    expect(
      decodePicture(legacyP2WithSelected('5'), PICTURE, regions),
      'platný záznam',
    ).not.toBeNull();

    for (const selected of ['8', '11', String(COLOR_COUNT), '13', '99', '255', '-1']) {
      const storage = storageWithLegacyP2();
      storage.data.set('picture.house', legacyP2WithSelected(selected));
      let painted = -1;
      let chosen = -1;
      expect(() => {
        const game = openOn(storage, regions);
        painted = paintedPixels(game, regions);
        chosen = game.palette().selected;
      }, `barva ${selected}: hra se nezastaví`).not.toThrow();
      expect(painted, `barva ${selected}: prázdná omalovánka`).toBe(0);
      expect(chosen, `barva ${selected}: první barva`).toBe(0);
    }
  });

  it('nedávné barvy mimo 12 barev se neukážou, nové barvy ano', () => {
    const regions = legacyP2Regions();
    for (const [record, expected] of [
      ['12,13', [null, null]],
      ['99,8', [PINK, null]],
      ['9,11', [SKIN, LIGHT_BLUE]],
    ] as const) {
      const storage = storageWithLegacyP2();
      storage.data.set('recentColors.house', record);
      let recent: readonly (number | null)[] = [];
      expect(() => {
        recent = openOn(storage, regions).recentColors();
      }, `záznam ${record}: hra se nezastaví`).not.toThrow();
      expect(recent, `záznam ${record}`).toEqual(expected);
    }
  });

  it('poškozený záznam obrázku s 12 barvami nikdy neukáže barvu mimo paletu a hru nezastaví', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const painter = openOn(storage, regions);
    paintNewColors(painter);
    choose(painter, 'crayon');
    painter.tapColor(GRAY);
    paint(painter, [at(160, 10), at(290, 190)]);
    painter.suspend();
    const pictureKeys = storage
      .keys()
      .filter((key) => decodePicture(storage.data.get(key) ?? '', PICTURE, regions) !== null);
    expect(pictureKeys.length, 'hra uložila obrázek').toBe(1);
    const key = pictureKeys[0] ?? '';
    const original = storage.data.get(key) ?? '';

    const random = seededRandom(100);
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const characters = [...original];
      const position = pick(random, characters.length);
      const code = (characters[position] ?? 'a').charCodeAt(0);
      characters[position] = String.fromCharCode(code ^ (1 + pick(random, 0x7fff)));
      const broken = new RecordingStorage();
      for (const [storedKey, value] of storage.data) {
        broken.data.set(storedKey, value);
      }
      broken.data.set(key, characters.join(''));

      const what = `pokus ${attempt + 1}, znak ${position}`;
      let pixels: Array<number | null> = [];
      let selected = -1;
      expect(() => {
        const game = openOn(broken, regions);
        pixels = pixelsOf(game, regions);
        selected = game.palette().selected;
      }, `${what}: hra se nezastaví`).not.toThrow();
      expect(isKnownColor(selected), `${what}: vybraná barva ${selected}`).toBe(true);
      const unknown = usedColors(pixels).filter((color) => !isKnownColor(color));
      expect(unknown, `${what}: žádná barva mimo paletu`).toEqual([]);
    }
  });
});
