import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';
import {
  LEGACY_P2_RECENT_COLORS,
  LEGACY_P2_SELECTED_COLOR,
  LEGACY_P2_STORAGE,
  legacyP2Pixels,
  legacyP2Regions,
} from './legacyP2RecordFixture';
import {
  LEGACY_P3_DOTS_LINE_SIZE,
  LEGACY_P3_DOTS_RECENT_COLORS,
  LEGACY_P3_DOTS_SELECTED_COLOR,
  LEGACY_P3_DOTS_STORAGE,
  legacyP3DotsPixels,
  legacyP3DotsRegions,
} from './legacyP3DotsRecordFixture';
import {
  LEGACY_P3_GLITTER_LINE_SIZE,
  LEGACY_P3_GLITTER_RECENT_COLORS,
  LEGACY_P3_GLITTER_SELECTED_COLOR,
  LEGACY_P3_GLITTER_STORAGE,
  legacyP3GlitterPixels,
  legacyP3GlitterRegions,
} from './legacyP3GlitterRecordFixture';
import {
  LEGACY_P3_LINE_SIZE,
  LEGACY_P3_RECENT_COLORS,
  LEGACY_P3_SELECTED_COLOR,
  LEGACY_P3_STORAGE,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
import {
  LEGACY_P3_STRIPES_LINE_SIZE,
  LEGACY_P3_STRIPES_RECENT_COLORS,
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
import { pick, seededRandom } from './recentColorsHelpers';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  keepOnlyRecordsBefore110,
  keysAddedBy110,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import {
  BLACK,
  BLUE,
  BROWN,
  COLOR_TOOLS,
  DEFAULT_TOOL_COLORS,
  GRAY,
  GREEN,
  PINK,
  RED,
  SKIN,
  YELLOW,
  allToolsIn,
  giveColor,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';
import type { ColorTool } from './toolColorsHelpers';

/**
 * Testy k #110 AC5 (pamatování a výchozí barvy) a AC6 (staré uložené stavy
 * a špatný záznam), s doporučeními story-revieweru z komentáře k issue:
 * - nedávné barvy zůstanou po návratu stejné, i když se jedna shoduje
 *   s barvou štětce,
 * - poškozený záznam obrázku a platný záznam barev nástrojů: platí uložené
 *   barvy nástrojů (obrázek je prázdný),
 * - po ztrátě záznamu barev nástrojů dostanou všechny nástroje naposledy
 *   vybranou barvu (ta se ukládá jako vybraná barva v záznamu obrázku).
 *
 * Jedno „otevření hry“ je `openOn(…)` nad úložištěm hry profilu, „obnovení
 * stránky“ nové `openProfiles(storage)` nad stejným úložištěm zařízení
 * (`savedPictureHelpers.ts`). Testy neznají klíč ani tvar záznamu barev
 * nástrojů: je to záznam, který stará verze nezapisovala
 * (`keysAddedBy110`). Stará verze je pevné úložiště z `legacy*Fixture.ts`
 * (nikdy se nepřegenerovává).
 *
 * Navržené rozhraní: viz `toolColors.test.ts`. Záznam barev nástrojů je
 * samostatný záznam v úložišti hry profilu vedle obrázku podle omalovánky
 * (jako nedávné barvy, #99), zapíše se hned po výběru barvy a s každým
 * uložením obrázku. Tvar záznamu obrázku se nemění, jako vybraná barva se
 * do něj ukládá naposledy vybraná barva (kterémukoli nástroji).
 */

/** Zápis klíče Omalovánek selže (plné úložiště), ostatní klíče projdou. */
function failColoringWrites(storage: DeviceStorage): void {
  storage.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
}

function copyOf(storage: RecordingStorage): RecordingStorage {
  const copy = new RecordingStorage();
  for (const [key, value] of storage.data) {
    copy.data.set(key, value);
  }
  return copy;
}

/** Klíče záznamu obrázku (záznamy, které jde přečíst jako obrázek). */
function pictureKeys(storage: RecordingStorage, regions: RegionMap): string[] {
  return storage
    .keys()
    .filter((key) => decodePicture(storage.data.get(key) ?? '', PICTURE, regions) !== null);
}

/** Barvy nástrojů, které se v testech nastaví (všechny jiné než výchozí). */
const CHOSEN: Readonly<Record<ColorTool, number>> = {
  brush: YELLOW,
  marker: GRAY,
  crayon: PINK,
  stamp: BLACK,
  dots: SKIN,
  stripes: BROWN,
  glitter: GREEN,
  spray: RED,
};

/** Každému nástroji dá barvu z `CHOSEN`, naposledy sprej (červenou). */
function recolorAll(game: SavedColoring): void {
  for (const tool of COLOR_TOOLS) {
    giveColor(game, tool, CHOSEN[tool]);
  }
}

/**
 * Úložiště s rozmalovaným obrázkem a barvami nástrojů: štětec žlutý, fix
 * šedý (naposledy vybraná barva), ostatní výchozí. Vrátí i klíče záznamu
 * barev nástrojů a pixely obrázku.
 */
function storageWithToolColors(regions: RegionMap): {
  storage: RecordingStorage;
  toolKeys: string[];
  picture: Array<number | null>;
} {
  const storage = new RecordingStorage();
  const game = openOn(storage, regions);
  giveColor(game, 'brush', YELLOW);
  pickTool(game, 'brush');
  game.tapHandle();
  paint(game, [at(20, 100), at(140, 100)]);
  giveColor(game, 'marker', GRAY);
  paint(game, [at(170, 100), at(290, 100)]);
  game.suspend();
  expect(toolColorsOf(game), 'připravené barvy').toEqual({
    ...DEFAULT_TOOL_COLORS,
    brush: YELLOW,
    marker: GRAY,
  });
  return { storage, toolKeys: keysAddedBy110(storage), picture: pixelsOf(game, regions) };
}

describe('#110 AC5: barvy nástrojů se pamatují podle profilu a omalovánky', () => {
  it('po návratu domečkem mají všechny nástroje své barvy a vybraný je štětec se svou barvou', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    recolorAll(game);
    expect(game.selectedTool(), 'odchod se sprejem').toBe('spray');
    game.suspend();

    const again = enterColoring(store, regions);

    expect(toolColorsOf(again)).toEqual(CHOSEN);
    expect(again.selectedTool(), 'vybraný štětec (#90 AC1)').toBe('brush');
    expect(again.handleView()).toMatchObject({ tool: 'brush', color: CHOSEN.brush });
  });

  it('výběr barvy se uloží hned, bez tahu a bez odchodu ze hry', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    giveColor(game, 'crayon', BROWN);
    giveColor(game, 'glitter', PINK);

    const again = openOn(storage, regions);

    expect(toolColorsOf(again)).toEqual({ ...DEFAULT_TOOL_COLORS, crayon: BROWN, glitter: PINK });
  });

  it('nedávná barva daná nástroji v pruhu se uloží hned', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    giveColor(game, 'brush', YELLOW);
    pickTool(game, 'stamp');
    game.tapHandle();
    game.tapRecentColor(0);
    expect(toolColorsOf(game).stamp, 'razítkový fix dostal červenou').toBe(RED);

    const again = openOn(storage, regions);

    expect(toolColorsOf(again)).toEqual({ ...DEFAULT_TOOL_COLORS, brush: YELLOW, stamp: RED });
  });

  it('po schování stránky a obnovení stránky mají nástroje své barvy', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(device), regions);
    recolorAll(game);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();

    const reloaded = enterColoring(openProfiles(device), regions);

    expect(toolColorsOf(reloaded)).toEqual(CHOSEN);
    expect(reloaded.handleView()).toMatchObject({ tool: 'brush', color: CHOSEN.brush });
  });

  it('malování výchozími barvami bez výběru barvy se po návratu nepřebarví', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    pickTool(game, 'marker');
    game.tapHandle();
    paint(game, [at(20, 100), at(140, 100)]);
    pickTool(game, 'spray');
    game.tapHandle();
    paint(game, [at(170, 100), at(290, 100)]);
    game.suspend();

    const again = openOn(storage, regions);

    expect(toolColorsOf(again)).toEqual(DEFAULT_TOOL_COLORS);
    expect(pixelsOf(again, regions), 'obrázek').toEqual(pixelsOf(game, regions));
  });

  it('nový profil bez uloženého obrázku začíná výchozími barvami z tabulky', () => {
    const game = enterColoring(openProfiles(new DeviceStorage()), twoHalves());

    expect(toolColorsOf(game)).toEqual(DEFAULT_TOOL_COLORS);
    expect(game.handleView()).toMatchObject({ tool: 'brush', color: RED });
  });

  it('jiný profil má své barvy a jeho výběr nezmění barvy prvního profilu', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    recolorAll(firstGame);
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(toolColorsOf(secondGame), 'druhý profil začíná výchozími').toEqual(DEFAULT_TOOL_COLORS);
    giveColor(secondGame, 'marker', BLACK);
    secondGame.suspend();

    const reloaded = openProfiles(device);
    reloaded.selectProfile(first.id);
    expect(toolColorsOf(enterColoring(reloaded, regions)), 'první profil').toEqual(CHOSEN);
    reloaded.selectProfile(second.id);
    expect(toolColorsOf(enterColoring(reloaded, regions)), 'druhý profil').toEqual({
      ...DEFAULT_TOOL_COLORS,
      marker: BLACK,
    });
  });

  it('smazaný a znovu založený profil začíná výchozími barvami, i po obnovení stránky', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    const game = enterColoring(store, regions);
    recolorAll(game);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);

    expect(toolColorsOf(enterColoring(store, regions))).toEqual(DEFAULT_TOOL_COLORS);
    const reloaded = openProfiles(device);
    reloaded.selectProfile(again.id);
    expect(toolColorsOf(enterColoring(reloaded, regions)), 'po obnovení').toEqual(
      DEFAULT_TOOL_COLORS,
    );
  });

  it('jiná omalovánka má své barvy nástrojů a nemění barvy první', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    recolorAll(game);
    game.suspend();

    const other = openOn(storage, regions, { id: 'garden', version: 1 });
    expect(toolColorsOf(other), 'jiná omalovánka začíná výchozími').toEqual(DEFAULT_TOOL_COLORS);
    giveColor(other, 'brush', BLUE);
    other.suspend();

    expect(toolColorsOf(openOn(storage, regions)), 'první omalovánka').toEqual(CHOSEN);
  });

  it('nedávné barvy zůstanou po návratu stejné, i když se jedna shoduje s barvou štětce', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    giveColor(game, 'marker', RED);
    giveColor(game, 'marker', GREEN);
    expect(game.recentColors(), 'nedávné [červená, modrá]').toEqual([RED, BLUE]);
    game.suspend();

    const again = openOn(storage, regions);

    expect(again.handleView(), 'štětec je červený').toMatchObject({ tool: 'brush', color: RED });
    expect(again.recentColors(), 'pořád [červená, modrá]').toEqual([RED, BLUE]);
  });

  it('při plném úložišti jde vybírat barvy dál bez chyby a platí aspoň do odchodu', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    storage.failWrites = true;

    expect(() => {
      recolorAll(game);
      paint(game, [at(20, 100), at(140, 100)]);
      game.suspend();
    }).not.toThrow();
    expect(toolColorsOf(game)).toEqual(CHOSEN);
  });

  it('po nepodařeném uložení platí barvy z paměti při dalším otevření, po obnovení stránky už ne', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    failColoringWrites(device);
    const game = enterColoring(store, regions);
    expect(() => {
      recolorAll(game);
      game.suspend();
    }).not.toThrow();

    const again = enterColoring(store, regions);
    expect(toolColorsOf(again), 'do zavření stránky z paměti').toEqual(CHOSEN);

    const reloaded = enterColoring(openProfiles(device), regions);
    expect(toolColorsOf(reloaded), 'po obnovení stránky výchozí').toEqual(DEFAULT_TOOL_COLORS);
  });

  it('zakázané úložiště dá výchozí barvy a barvy nástrojů fungují bez chyby', () => {
    expect(() => {
      const game = enterColoring(openProfiles(forbiddenStorage()), twoHalves());
      expect(toolColorsOf(game)).toEqual(DEFAULT_TOOL_COLORS);
      recolorAll(game);
      expect(toolColorsOf(game)).toEqual(CHOSEN);
      game.suspend();
    }).not.toThrow();
  });
});

describe('#110 AC6: obrázky uložené před tímto úkolem', () => {
  /** Úložiště se starým záznamem p1 pod klíčem obrázku, nic dalšího. */
  function storageWithLegacyP1(): RecordingStorage {
    const storage = new RecordingStorage();
    const game = openOn(storage, legacyRegions());
    game.tapColor(BLUE);
    game.suspend();
    const keys = pictureKeys(storage, legacyRegions());
    storage.data.clear();
    for (const key of keys) {
      storage.data.set(key, LEGACY_P1_RECORD);
    }
    return storage;
  }

  function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
    const storage = new RecordingStorage();
    for (const [key, value] of entries) {
      storage.data.set(key, value);
    }
    return storage;
  }

  const legacyStates = (): ReadonlyArray<{
    name: string;
    storage: RecordingStorage;
    regions: RegionMap;
    pixels: Array<number | null>;
    selected: number;
    recent: readonly (number | null)[];
    size: string;
  }> => [
    {
      name: 'p1',
      storage: storageWithLegacyP1(),
      regions: legacyRegions(),
      pixels: legacyPixels(),
      selected: LEGACY_SELECTED_COLOR,
      recent: [null, null],
      size: 'medium',
    },
    {
      name: 'p2',
      storage: storageWith(LEGACY_P2_STORAGE),
      regions: legacyP2Regions(),
      pixels: legacyP2Pixels(),
      selected: LEGACY_P2_SELECTED_COLOR,
      recent: LEGACY_P2_RECENT_COLORS,
      size: 'medium',
    },
    {
      name: 'p3',
      storage: storageWith(LEGACY_P3_STORAGE),
      regions: legacyP3Regions(),
      pixels: legacyP3Pixels(),
      selected: LEGACY_P3_SELECTED_COLOR,
      recent: LEGACY_P3_RECENT_COLORS,
      size: LEGACY_P3_LINE_SIZE,
    },
    {
      name: 'p3 s puntíky',
      storage: storageWith(LEGACY_P3_DOTS_STORAGE),
      regions: legacyP3DotsRegions(),
      pixels: legacyP3DotsPixels(),
      selected: LEGACY_P3_DOTS_SELECTED_COLOR,
      recent: LEGACY_P3_DOTS_RECENT_COLORS,
      size: LEGACY_P3_DOTS_LINE_SIZE,
    },
    {
      name: 'p3 s proužky',
      storage: storageWith(LEGACY_P3_STRIPES_STORAGE),
      regions: legacyP3StripesRegions(),
      pixels: legacyP3StripesPixels(),
      selected: LEGACY_P3_STRIPES_SELECTED_COLOR,
      recent: LEGACY_P3_STRIPES_RECENT_COLORS,
      size: LEGACY_P3_STRIPES_LINE_SIZE,
    },
    {
      name: 'p3 s třpytkami',
      storage: storageWith(LEGACY_P3_GLITTER_STORAGE),
      regions: legacyP3GlitterRegions(),
      pixels: legacyP3GlitterPixels(),
      selected: LEGACY_P3_GLITTER_SELECTED_COLOR,
      recent: LEGACY_P3_GLITTER_RECENT_COLORS,
      size: LEGACY_P3_GLITTER_LINE_SIZE,
    },
  ];

  it('starý obrázek dá všem 8 malovacím nástrojům svou uloženou vybranou barvu', () => {
    for (const { name, storage, regions, selected } of legacyStates()) {
      const game = openOn(storage, regions);

      expect(toolColorsOf(game), name).toEqual(allToolsIn(selected));
      expect(game.handleView(), `${name}: štětec`).toMatchObject({
        tool: 'brush',
        color: selected,
      });
    }
  });

  it('obrázek pixel po pixelu, nedávné barvy i velikost čáry zůstanou stejné', () => {
    for (const { name, storage, regions, pixels, recent, size } of legacyStates()) {
      const game = openOn(storage, regions);

      expect(pixelsOf(game, regions), `${name}: obrázek`).toEqual(pixels);
      expect(game.recentColors(), `${name}: nedávné barvy`).toEqual(recent);
      expect(game.lineSize(), `${name}: velikost čáry`).toBe(size);
    }
  });

  it('po výběru barvy jednomu nástroji si ostatní nechají barvu starého obrázku, i po návratu', () => {
    for (const { name, storage, regions, pixels, selected } of legacyStates()) {
      const game = openOn(storage, regions);
      const color = selected === GRAY ? BLACK : GRAY;
      giveColor(game, 'crayon', color);
      game.suspend();

      const again = openOn(storage, regions);

      expect(toolColorsOf(again), name).toEqual({ ...allToolsIn(selected), crayon: color });
      expect(pixelsOf(again, regions), `${name}: obrázek beze změny`).toEqual(pixels);
    }
  });
});

describe('#110 AC6: chybějící nebo špatný záznam barev nástrojů', () => {
  it('výběr barvy zapíše vedle obrázku nový záznam a záznam obrázku zůstane jediný', () => {
    const regions = twoHalves();
    const { storage, toolKeys } = storageWithToolColors(regions);

    expect(toolKeys.length, 'nový záznam barev nástrojů').toBeGreaterThan(0);
    expect(pictureKeys(storage, regions).length, 'jeden záznam obrázku').toBe(1);
  });

  it('tvar záznamu obrázku se nemění: je to záznam s naposledy vybranou barvou a vejde se do 50 000 znaků', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    giveColor(game, 'brush', YELLOW);
    paint(game, [at(20, 100), at(140, 100)]);
    giveColor(game, 'dots', GRAY);
    paint(game, [at(170, 100), at(290, 100)]);
    game.suspend();

    const expected = encodePicture({
      picture: PICTURE,
      regions,
      colors: game,
      selectedColor: GRAY,
    });
    const records = pictureKeys(storage, regions).map((key) => storage.data.get(key) ?? '');
    expect(records, 'záznam obrázku').toEqual([expected]);
    expect(expected.length, 'limit z #92 AC6').toBeLessThanOrEqual(50_000);
  });

  it('chybějící záznam barev nástrojů dá všem nástrojům naposledy vybranou barvu, obrázek zůstane', () => {
    const regions = twoHalves();
    const { storage, toolKeys, picture } = storageWithToolColors(regions);
    for (const key of toolKeys) {
      storage.data.delete(key);
    }

    const game = openOn(storage, regions);

    expect(toolColorsOf(game), 'všechny nástroje šedé jako fix').toEqual(allToolsIn(GRAY));
    expect(pixelsOf(game, regions), 'obrázek').toEqual(picture);
  });

  it('nesmyslný záznam barev nástrojů se bere jako starý stav a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage, toolKeys, picture } = storageWithToolColors(regions);
    expect(toolKeys.length, 'záznam barev nástrojů se zapsal').toBeGreaterThan(0);
    const nonsense = [
      '',
      'nesmysl',
      'null',
      'undefined',
      '{}',
      '[]',
      '{"brush":"red"}',
      '-1',
      '99',
      '1.5',
      '[99,99,99,99,99,99,99,99]',
      '0,0,0',
      '0,1,2,3,4,5,6,7,8,9,10,11',
      '\u0000\u0001',
      'x'.repeat(10_000),
    ];
    for (const text of nonsense) {
      const broken = copyOf(storage);
      for (const key of toolKeys) {
        broken.data.set(key, text);
      }
      const what = `záznam ${JSON.stringify(text.slice(0, 20))}`;
      expect(() => {
        const game = openOn(broken, regions);
        expect(toolColorsOf(game), what).toEqual(allToolsIn(GRAY));
        expect(pixelsOf(game, regions), `${what}: obrázek`).toEqual(picture);
        giveColor(game, 'stamp', PINK);
        expect(toolColorsOf(game), `${what}: výběr po něm`).toEqual({
          ...allToolsIn(GRAY),
          stamp: PINK,
        });
      }, `${what}: hra se nezastaví`).not.toThrow();
    }
  });

  it('jakkoli poškozený záznam barev nástrojů nikdy nedá barvu mimo paletu a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage, toolKeys } = storageWithToolColors(regions);
    expect(toolKeys.length, 'záznam barev nástrojů se zapsal').toBeGreaterThan(0);
    const originals = toolKeys.map((key) => storage.data.get(key) ?? '');
    const random = seededRandom(11001);
    const alphabet = '0123456789,;:[]|{}"-.abc ';
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const broken = copyOf(storage);
      const texts = originals.map((original) => {
        const characters = [...original];
        const changes = 1 + pick(random, 3);
        for (let change = 0; change < changes; change += 1) {
          const position = pick(random, characters.length + 1);
          characters.splice(position, 1, alphabet[pick(random, alphabet.length)] ?? '');
        }
        return characters.join('');
      });
      toolKeys.forEach((key, index) => broken.data.set(key, texts[index] ?? ''));
      const what = `pokus ${attempt + 1}: ${JSON.stringify(texts)}`;
      let colors: Record<ColorTool, number | null> = { ...DEFAULT_TOOL_COLORS };
      expect(() => {
        colors = toolColorsOf(openOn(broken, regions));
      }, `${what}: hra se nezastaví`).not.toThrow();
      for (const tool of COLOR_TOOLS) {
        const color = colors[tool];
        expect(
          color !== null && Number.isInteger(color) && color >= 0 && color < 12,
          `${what}: ${tool} má barvu ${String(color)}`,
        ).toBe(true);
      }
    }
  });

  it('nečitelné úložiště dá výchozí barvy a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage } = storageWithToolColors(regions);
    storage.failReads = true;

    let colors: Record<ColorTool, number | null> = allToolsIn(-1);
    expect(() => {
      colors = toolColorsOf(openOn(storage, regions));
    }).not.toThrow();
    expect(colors).toEqual(DEFAULT_TOOL_COLORS);
  });

  it('bez uloženého obrázku a se špatným záznamem barev nástrojů platí výchozí barvy', () => {
    const regions = twoHalves();
    const { storage, toolKeys } = storageWithToolColors(regions);
    for (const key of pictureKeys(storage, regions)) {
      storage.data.delete(key);
    }
    for (const text of ['nesmysl', '']) {
      const broken = copyOf(storage);
      for (const key of toolKeys) {
        broken.data.set(key, text);
      }
      const game = openOn(broken, regions);
      expect(toolColorsOf(game), JSON.stringify(text)).toEqual(DEFAULT_TOOL_COLORS);
      expect(paintedPixels(game, regions), `${JSON.stringify(text)}: prázdný obrázek`).toBe(0);
    }
  });

  it('poškozený záznam obrázku a platný záznam barev nástrojů: prázdný obrázek s uloženými barvami', () => {
    const regions = twoHalves();
    const { storage } = storageWithToolColors(regions);
    for (const key of pictureKeys(storage, regions)) {
      const record = storage.data.get(key) ?? '';
      const middle = Math.floor(record.length / 2);
      const replacement = record[middle] === 'x' ? 'y' : 'x';
      storage.data.set(key, `${record.slice(0, middle)}${replacement}${record.slice(middle + 1)}`);
    }

    const game = openOn(storage, regions);

    expect(paintedPixels(game, regions), 'prázdný obrázek').toBe(0);
    expect(toolColorsOf(game)).toEqual({ ...DEFAULT_TOOL_COLORS, brush: YELLOW, marker: GRAY });
  });

  it('po ztrátě záznamu barev nástrojů dostanou všechny nástroje naposledy vybranou barvu, i z pruhu', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    giveColor(game, 'brush', YELLOW);
    giveColor(game, 'glitter', PINK);
    pickTool(game, 'marker');
    game.tapHandle();
    game.tapRecentColor(0);
    expect(toolColorsOf(game).marker, 'fix dostal z pruhu').toBe(DEFAULT_TOOL_COLORS.glitter);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();
    keepOnlyRecordsBefore110(storage);

    const again = openOn(storage, regions);

    expect(toolColorsOf(again)).toEqual(allToolsIn(DEFAULT_TOOL_COLORS.glitter));
  });
});
