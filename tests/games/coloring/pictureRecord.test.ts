import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { drawing } from './outlineFixtures';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #92 AC4 (špatný záznam) a AC6 (limit velikosti). Záznam se
 * poškodí přímo v úložišti hry: test nezná jeho tvar ani klíč, jen přepíše
 * to, co tam hra sama zapsala. Limit se měří na vrstvě barev 1024 × 768
 * (velikost z poznámek pro vývojáře v #88) s pevným vzorem z AC6.
 */

const BLUE = 4;

/** Limit z AC6; schválně ne konstanta z kódu, aby ho nešlo potichu zvýšit. */
const RECORD_LIMIT = 50_000;

const LAYER_WIDTH = 1024;
const LAYER_HEIGHT = 768;

/** Úložiště s uloženým modrým obrázkem omalovánky `twoHalves()`. */
function storageWithPicture(): RecordingStorage {
  const storage = new RecordingStorage();
  const game = openOn(storage, twoHalves());
  game.tapColor(BLUE);
  paint(game, [at(20, 100), at(140, 100)]);
  paint(game, [at(170, 30), at(290, 170)]);
  game.suspend();
  return storage;
}

/**
 * Otevřená omalovánka je prázdná a vybraná je první barva. Od #110 je
 * „vybraná barva“ barva štětce, který je po otevření vybraný; když zůstal
 * platný samostatný záznam barev nástrojů, má štětec uloženou barvu
 * (`brushColor`, doporučení story-revieweru k #110 AC6).
 */
function expectBlankStart(
  storage: RecordingStorage,
  regions: RegionMap,
  what: string,
  brushColor = 0,
): void {
  let painted = -1;
  let selected = -1;
  expect(() => {
    const game = openOn(storage, regions);
    painted = paintedPixels(game, regions);
    selected = game.palette().selected;
  }, `${what}: hra se nezastaví`).not.toThrow();
  expect(painted, `${what}: prázdná omalovánka`).toBe(0);
  expect(selected, `${what}: barva štětce`).toBe(brushColor);
}

describe('#92 AC4: špatný záznam hru nezastaví, ukáže se prázdná omalovánka a první barva', () => {
  it('bez záznamu (první otevření) je omalovánka prázdná s první barvou', () => {
    expectBlankStart(new RecordingStorage(), twoHalves(), 'chybějící záznam');
  });

  it('nečitelný záznam dá prázdnou omalovánku', () => {
    const unreadable = [
      '',
      'nesmysl',
      'null',
      '{}',
      '[]',
      '42',
      '"text"',
      '{"version":1}',
      '\u0000￿\ud800',
      'A'.repeat(60_000),
    ];
    for (const text of unreadable) {
      const storage = storageWithPicture();
      storage.rewriteAll(() => text);
      expectBlankStart(storage, twoHalves(), `záznam ${JSON.stringify(text.slice(0, 20))}`);
    }
  });

  it('useknutý záznam dá prázdnou omalovánku', () => {
    for (const share of [0.1, 0.5, 0.9]) {
      const storage = storageWithPicture();
      storage.rewriteAll((value) => value.slice(0, Math.floor(value.length * share)));
      expectBlankStart(storage, twoHalves(), `zbylo ${share * 100} % záznamu`);
    }
  });

  it('záznam se změněným znakem uprostřed dá prázdnou omalovánku', () => {
    const storage = storageWithPicture();
    storage.rewriteAll((value) => {
      const middle = Math.floor(value.length / 2);
      const replacement = value[middle] === 'x' ? 'y' : 'x';
      return `${value.slice(0, middle)}${replacement}${value.slice(middle + 1)}`;
    });
    expectBlankStart(storage, twoHalves(), 'poškozený znak');
  });

  // Přepsáno k #110 AC6: dřív i „první barva“. Záznam barev nástrojů zůstal
  // v pořádku, štětec proto podle doporučení k #110 AC6 začne svou uloženou
  // modrou, obrázek je dál prázdný.
  it('záznam jiné verze omalovánky dá prázdnou omalovánku, štětec si nechá uloženou barvu', () => {
    const storage = storageWithPicture();
    const regions = twoHalves();
    const game = openOn(storage, regions, { id: PICTURE.id, version: PICTURE.version + 1 });
    expect(paintedPixels(game, regions)).toBe(0);
    expect(game.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });

  // Přepsáno k #110 AC6 stejně jako záznam jiné verze.
  it('záznam obrázku jiné velikosti dá prázdnou omalovánku, štětec si nechá uloženou barvu', () => {
    const storage = storageWithPicture();
    expectBlankStart(storage, drawing(200, 100).verticalLine(100).regions(), 'jiná velikost', BLUE);
  });

  it('úložiště, které nejde číst, dá prázdnou omalovánku', () => {
    const storage = storageWithPicture();
    storage.failReads = true;
    expectBlankStart(storage, twoHalves(), 'zakázané čtení');
  });

  it('po špatném záznamu jde malovat a nový obrázek se uloží místo něj', () => {
    const storage = storageWithPicture();
    storage.rewriteAll(() => 'nesmysl');
    const regions = twoHalves();
    const game = openOn(storage, regions);
    paint(game, [at(60, 20), at(60, 180)]);

    const reopened = openOn(storage, regions);
    expect(reopened.colorAt(60, 100)).toBe(0);
    expect(pixelsOf(reopened, regions)).toEqual(pixelsOf(game, regions));
  });
});

/**
 * Obrysy pro nejhorší případ: prázdný obrys (jediná oblast), mřížka
 * s rámečkem (mnoho oblastí, pruhy přerušené čarami) a omalovánce podobný
 * obrys se šikmými čarami a malými okny.
 */
function worstCaseOutlines(): Array<{ name: string; regions: RegionMap }> {
  const grid = drawing(LAYER_WIDTH, LAYER_HEIGHT).frame(0, 0, LAYER_WIDTH - 1, LAYER_HEIGHT - 1, 4);
  for (let x = 97; x < LAYER_WIDTH; x += 131) {
    grid.verticalLine(x, 3);
  }
  for (let y = 61; y < LAYER_HEIGHT; y += 113) {
    grid.horizontalLine(y, 3);
  }

  const house = drawing(LAYER_WIDTH, LAYER_HEIGHT).frame(200, 330, 760, 700, 5);
  for (let step = 0; step <= 280; step += 1) {
    // Střecha ze dvou šikmých čar tloušťky 4 px.
    house.fill(200 + step, 330 - step, 203 + step, 333 - step);
    house.fill(757 - step, 330 - step, 760 - step, 333 - step);
  }
  for (let window = 0; window < 4; window += 1) {
    house.frame(250 + window * 130, 420, 330 + window * 130, 500, 3);
  }
  house.frame(840, 120, 960, 240, 4).frame(880, 400, 900, 760, 3);

  return [
    { name: 'prázdný obrys', regions: drawing(LAYER_WIDTH, LAYER_HEIGHT).regions() },
    { name: 'mřížka', regions: grid.regions() },
    { name: 'domeček', regions: house.regions() },
  ];
}

/**
 * Pevný vzor z AC6: každý pixel mimo obrys má barvu svislého pruhu šířky W,
 * pruhy jdou zleva bez mezer a barvy se střídají dokola přes celou paletu.
 * Obrys je prázdný. Pruh pixelu se určí podle jeho středu.
 */
function stripePattern(regions: RegionMap): { colorAt(x: number, y: number): number | null } {
  const stripeWidth = brushWidthFor(regions.width);
  return {
    colorAt(x, y) {
      const region = regionAt(regions, x, y);
      if (region === null || region === OUTLINE_REGION) {
        return null;
      }
      return Math.floor((Math.floor(x) + 0.5) / stripeWidth) % PALETTE.length;
    },
  };
}

describe('#92 AC6: uložený záznam jedné omalovánky má nejvýš 50 000 znaků', () => {
  it('vzor svislých pruhů šířky W přes všechny barvy palety se vejde do 50 000 znaků a přečte se beze ztráty', () => {
    for (const { name, regions } of worstCaseOutlines()) {
      const pattern = stripePattern(regions);
      for (const selectedColor of [0, PALETTE.length - 1]) {
        const record = encodePicture({ picture: PICTURE, regions, colors: pattern, selectedColor });
        expect(record.length, `${name}: délka záznamu`).toBeLessThanOrEqual(RECORD_LIMIT);

        const decoded = decodePicture(record, PICTURE, regions);
        expect(decoded, `${name}: záznam jde přečíst`).not.toBeNull();
        expect(decoded?.selectedColor, `${name}: vybraná barva`).toBe(selectedColor);
        expect(
          decoded === null ? [] : pixelsOf(decoded.colors, regions),
          `${name}: stejný obrázek pixel po pixelu`,
        ).toEqual(pixelsOf(pattern, regions));
      }
    }
  });

  it('obrázek vybarvený celý jednou barvou i prázdný obrázek se vejdou do limitu', () => {
    const regions = drawing(LAYER_WIDTH, LAYER_HEIGHT).regions();
    const full = { colorAt: () => BLUE };
    const empty = { colorAt: () => null };
    for (const [name, colors] of [
      ['celý modrý', full],
      ['prázdný', empty],
    ] as const) {
      const record = encodePicture({ picture: PICTURE, regions, colors, selectedColor: 0 });
      expect(record.length, name).toBeLessThanOrEqual(RECORD_LIMIT);
      const decoded = decodePicture(record, PICTURE, regions);
      expect(decoded === null ? [] : pixelsOf(decoded.colors, regions), name).toEqual(
        pixelsOf(colors, regions),
      );
    }
  });

  it('záznam, který hra uloží po tahu, je stejný záznam s limitem 50 000 znaků', () => {
    const regions = worstCaseOutlines()[2]?.regions as RegionMap;
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    for (let color = 0; color < PALETTE.length; color += 1) {
      game.tapColor(color);
      const y = 40 + color * 90;
      paint(game, [at(10, y), at(1010, y + 30), at(30, y + 60)]);
    }
    game.suspend();

    const records = [...storage.data.values()];
    expect(records.length, 'hra něco uložila').toBeGreaterThan(0);
    for (const record of records) {
      expect(record.length).toBeLessThanOrEqual(RECORD_LIMIT);
    }
    const decoded = records
      .map((record) => decodePicture(record, PICTURE, regions))
      .find((picture): picture is NonNullable<typeof picture> => picture !== null);
    expect(decoded, 'uložený záznam přečte decodePicture').toBeDefined();
    expect(decoded === undefined ? [] : pixelsOf(decoded.colors, regions)).toEqual(
      pixelsOf(game, regions),
    );
    expect(decoded?.selectedColor).toBe(PALETTE.length - 1);
  });
});
