import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';
import {
  LEGACY_BEFORE_111_LINE_SIZE,
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
  LEGACY_P3_LINE_SIZE,
  LEGACY_P3_STORAGE,
  legacyP3Pixels,
  legacyP3Regions,
} from './legacyP3RecordFixture';
import {
  LEGACY_P4_LINE_SIZE,
  LEGACY_P4_STORAGE,
  LEGACY_P4_TOOL_COLORS,
  legacyP4Pixels,
  legacyP4Regions,
} from './legacyP4RecordFixture';
import { TOOL_NAMES } from './lineSizeHelpers';
import { firstButton, shownAs, tapPrevious, tapQuickEraser } from './quickToolsHelpers';
import { pick, seededRandom } from './randomHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import { COLOR_TOOLS, GREEN, PINK, giveColor, pickTool } from './toolColorsHelpers';

/**
 * Testy k #148 AC5 (předchozí nástroj se pamatuje podle profilu). Jedno
 * „otevření hry“ je `openColoring(…)` nad úložištěm hry profilu, „obnovení
 * stránky“ nové `openProfiles(storage)` nad stejným úložištěm zařízení,
 * odchod domečkem a schování stránky hlásí scéna jako `suspend()`
 * (`savedPictureHelpers.ts`). Nahrazují testy pamatování nedávných barev
 * z #99 AC5 (`recentColorsRecord.test.ts`).
 *
 * Testy neznají klíč ani tvar nového záznamu: záznam předchozího nástroje
 * je ten, který se v úložišti hry objeví nebo změní, když dítě jen
 * přepíná nástroje (barvy, tloušťka ani obrázek se tím nemění).
 *
 * Po otevření hry je vybraný štětec (#90). Testy proto pamatování ověřují
 * s předchozím nástrojem jiným než štětec; co má první tlačítko ukázat,
 * když si hra pamatuje štětec, zadání neříká (viz výstup testů #148).
 *
 * Starý záznam nedávných barev (#99) má klíč `recentColors.<omalovánka>`,
 * jak ho zapisovala dřívější verze (pevné záznamy `legacy*RecordFixture.ts`).
 */

/** Klíč, pod kterým dřívější verze ukládala nedávné barvy omalovánky domek. */
const OLD_RECENT_KEY = 'recentColors.house';

function copyOf(storage: RecordingStorage): RecordingStorage {
  const copy = new RecordingStorage();
  for (const [key, value] of storage.data) {
    copy.data.set(key, value);
  }
  return copy;
}

function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}

/**
 * Úložiště, kde si hra pamatuje fix jako předchozí nástroj (fix, pak
 * pastelka), a klíče, které zapsalo jen přepínání nástrojů.
 */
function storageWithPreviousMarker(): {
  storage: RecordingStorage;
  previousKeys: string[];
} {
  const baseline = new RecordingStorage();
  openOn(baseline, twoHalves()).suspend();
  const storage = new RecordingStorage();
  const game = openOn(storage, twoHalves());
  pickTool(game, 'marker');
  pickTool(game, 'crayon');
  game.suspend();
  expect(firstButton(game)?.tool, 'kontrola: předchozí je fix').toBe('marker');
  const previousKeys = storage
    .keys()
    .filter((key) => storage.data.get(key) !== baseline.data.get(key));
  return { storage, previousKeys };
}

describe('#148 AC5: předchozí nástroj se pamatuje podle profilu', () => {
  it('po návratu z menu je na prvním tlačítku stejný nástroj se stejnou barvou', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    giveColor(game, 'marker', GREEN);
    pickTool(game, 'spray');
    const before = firstButton(game);
    expect(before, 'kontrola').toEqual({ tool: 'marker', color: GREEN });
    game.suspend();

    const again = enterColoring(store, regions);

    expect(firstButton(again)).toEqual(before);
  });

  it('předchozí nástroj platí podle profilu, ne podle omalovánky: v jiné omalovánce je stejný', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const pictureA = openOn(storage, regions, { id: 'house', version: 1 });
    giveColor(pictureA, 'marker', GREEN);
    pickTool(pictureA, 'spray');
    const shown = firstButton(pictureA);
    expect(shown, 'kontrola').toEqual({ tool: 'marker', color: GREEN });
    pictureA.suspend();

    const pictureB = openOn(storage, regions, { id: 'cat', version: 1 });

    expect(firstButton(pictureB)?.tool, 'omalovánka B').toBe('marker');
    expect(tapPrevious(pictureB).kind, 'ťuknutí v omalovánce B').toBe('picked');
    expect(pictureB.selectedTool(), 'vybraný fix').toBe('marker');
  });

  it('po obnovení stránky je na prvním tlačítku stejný nástroj a ťuknutí ho vybere', () => {
    for (const tool of [...COLOR_TOOLS, 'rainbow'] as const) {
      if (tool === 'brush') {
        continue;
      }
      const device = new DeviceStorage();
      const regions = twoHalves();
      const game = enterColoring(openProfiles(device), regions);
      pickTool(game, tool);
      pickTool(game, tool === 'crayon' ? 'stamp' : 'crayon');
      const before = firstButton(game);
      game.suspend();

      const reloaded = enterColoring(openProfiles(device), regions);
      expect(firstButton(reloaded), `${TOOL_NAMES[tool]}: po obnovení`).toEqual(before);

      expect(tapPrevious(reloaded).kind, `${TOOL_NAMES[tool]}: ťuknutí`).toBe('picked');
      expect(reloaded.selectedTool(), `${TOOL_NAMES[tool]}: vybraný`).toBe(tool);
    }
  });

  it('předchozí nástroj zapamatovaný před gumou platí i po obnovení stránky', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(device), regions);
    pickTool(game, 'glitter');
    pickTool(game, 'dots');
    tapQuickEraser(game);
    const before = firstButton(game);
    expect(before?.tool, 'kontrola: na prvním tlačítku není guma').not.toBe('eraser');
    game.suspend();

    const reloaded = enterColoring(openProfiles(device), regions);

    expect(firstButton(reloaded)).toEqual(before);
  });

  it('v novém profilu je první tlačítko prázdné a ťuknutí ho jen zhoupne', () => {
    const game = enterColoring(openProfiles(new DeviceStorage()), twoHalves());
    expect(firstButton(game), 'prázdné místo').toBeNull();

    const result = tapPrevious(game);

    expect(result.kind).toBe('wobble');
    expect(game.selectedTool(), 'nástroj se nezměnil').toBe('brush');
    expect(firstButton(game), 'pořád prázdné').toBeNull();
  });

  it('jiný profil začíná s prázdným místem a jeho přepínání nezmění první tlačítko prvního', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    pickTool(firstGame, 'marker');
    pickTool(firstGame, 'crayon');
    const firstShown = firstButton(firstGame);
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(firstButton(secondGame), 'druhý profil začíná prázdný').toBeNull();
    pickTool(secondGame, 'spray');
    pickTool(secondGame, 'rainbow');
    const secondShown = firstButton(secondGame);
    secondGame.suspend();

    const reloaded = openProfiles(device);
    reloaded.selectProfile(first.id);
    expect(firstButton(enterColoring(reloaded, regions)), 'první profil').toEqual(firstShown);
    reloaded.selectProfile(second.id);
    expect(firstButton(enterColoring(reloaded, regions)), 'druhý profil').toEqual(secondShown);
  });

  it('smazaný a znovu založený profil začíná s prázdným místem, i po obnovení stránky', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    const game = enterColoring(store, regions);
    pickTool(game, 'marker');
    pickTool(game, 'crayon');
    game.suspend();

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);

    expect(firstButton(enterColoring(store, regions))).toBeNull();
    const reloaded = openProfiles(device);
    reloaded.selectProfile(again.id);
    expect(firstButton(enterColoring(reloaded, regions)), 'po obnovení').toBeNull();
  });
});

describe('#148 AC5: chybějící, poškozený nebo neznámý záznam dá prázdné místo', () => {
  it('přepínání nástrojů zapíše záznam předchozího nástroje', () => {
    expect(storageWithPreviousMarker().previousKeys.length).toBeGreaterThan(0);
  });

  it('smazaný záznam dá prázdné místo a barvy nástrojů i tloušťka zůstanou', () => {
    const { storage, previousKeys } = storageWithPreviousMarker();
    const reference = openOn(copyOf(storage), twoHalves());
    for (const key of previousKeys) {
      storage.data.delete(key);
    }

    const game = openOn(storage, twoHalves());

    expect(firstButton(game)).toBeNull();
    expect(game.lineSize(), 'tloušťka').toBe(reference.lineSize());
    for (const tool of COLOR_TOOLS) {
      expect(game.toolColor(tool), TOOL_NAMES[tool]).toBe(reference.toolColor(tool));
    }
  });

  it('nesmyslný nebo neznámý záznam dá prázdné místo, hra se nezastaví a jde přepínat dál', () => {
    const { storage, previousKeys } = storageWithPreviousMarker();
    const nonsense = [
      '',
      'nesmysl',
      'null',
      'undefined',
      '{}',
      'eraser',
      'pencil',
      'guma',
      '-1',
      '99',
      '1.5',
      '["marker"]',
      '\u0000\u0001',
      'x'.repeat(10_000),
    ];
    for (const text of nonsense) {
      const broken = copyOf(storage);
      for (const key of previousKeys) {
        broken.data.set(key, text);
      }
      const what = `záznam ${JSON.stringify(text.slice(0, 20))}`;
      expect(() => {
        const game = openOn(broken, twoHalves());
        expect(firstButton(game), what).toBeNull();
        expect(tapPrevious(game).kind, `${what}: prázdné místo se zhoupne`).toBe('wobble');
        pickTool(game, 'stamp');
        expect(firstButton(game), `${what}: přepínání po něm`).toEqual(shownAs(game, 'brush'));
      }, `${what}: hra se nezastaví`).not.toThrow();
    }
  });

  it('jakkoli poškozený záznam nikdy nedá na první tlačítko gumu ani neznámý nástroj', () => {
    const { storage, previousKeys } = storageWithPreviousMarker();
    const known: readonly ToolId[] = [...COLOR_TOOLS, 'rainbow'];
    const random = seededRandom(14801);
    const alphabet = '0123456789,[]|{}":-.abcdeimnorstuy ';
    for (const key of previousKeys) {
      const original = storage.data.get(key) ?? '';
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const characters = [...original];
        const changes = 1 + pick(random, 3);
        for (let change = 0; change < changes; change += 1) {
          const position = pick(random, characters.length + 1);
          characters.splice(position, 1, alphabet[pick(random, alphabet.length)] ?? '');
        }
        const text = characters.join('');
        const broken = copyOf(storage);
        broken.data.set(key, text);
        const what = `pokus ${attempt + 1}: ${JSON.stringify(text)}`;
        let shown: ReturnType<typeof firstButton> = null;
        expect(() => {
          shown = firstButton(openOn(broken, twoHalves()));
        }, `${what}: hra se nezastaví`).not.toThrow();
        if (shown !== null) {
          const { tool } = shown as { tool: ToolId };
          expect(known, `${what}: nástroj ${tool}`).toContain(tool);
        }
      }
    }
  });

  it('nečitelné úložiště dá prázdné místo a hra se nezastaví', () => {
    const { storage } = storageWithPreviousMarker();
    storage.failReads = true;

    let shown: ReturnType<typeof firstButton> = { tool: 'brush', color: null };
    expect(() => {
      shown = firstButton(openOn(storage, twoHalves()));
    }).not.toThrow();
    expect(shown).toBeNull();
  });

  it('zakázané úložiště dá prázdné místo a přepínání funguje aspoň do odchodu', () => {
    expect(() => {
      const game = enterColoring(openProfiles(forbiddenStorage()), twoHalves());
      expect(firstButton(game)).toBeNull();
      pickTool(game, 'marker');
      tapPrevious(game);
      expect(game.selectedTool()).toBe('brush');
      expect(firstButton(game)?.tool).toBe('marker');
      game.suspend();
    }).not.toThrow();
  });

  it('při plném úložišti jde přepínat dál bez chyby', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    storage.failWrites = true;

    expect(() => {
      pickTool(game, 'marker');
      tapPrevious(game);
      tapQuickEraser(game);
      tapPrevious(game);
    }).not.toThrow();
    expect(game.selectedTool()).not.toBe('eraser');
  });
});

/** Pevný stav starší verze a co z něj má dítě vidět. */
interface LegacyState {
  readonly name: string;
  readonly storage: ReadonlyArray<readonly [string, string]>;
  readonly regions: () => RegionMap;
  readonly pixels: () => Array<number | null>;
  readonly lineSize?: LineSize;
  readonly toolColors?: Readonly<Record<ToolId, number | null>>;
}

const LEGACY_STATES: readonly LegacyState[] = [
  {
    name: 'p2 z #93',
    storage: LEGACY_P2_STORAGE,
    regions: legacyP2Regions,
    pixels: legacyP2Pixels,
  },
  {
    name: 'p3 z #100',
    storage: LEGACY_P3_STORAGE,
    regions: legacyP3Regions,
    pixels: legacyP3Pixels,
    lineSize: LEGACY_P3_LINE_SIZE,
  },
  {
    name: 'p3 před #111',
    storage: LEGACY_BEFORE_111_STORAGE,
    regions: legacyBefore111Regions,
    pixels: legacyBefore111Pixels,
    lineSize: LEGACY_BEFORE_111_LINE_SIZE,
    toolColors: LEGACY_BEFORE_111_TOOL_COLORS,
  },
  {
    name: 'p4 z #115',
    storage: LEGACY_P4_STORAGE,
    regions: legacyP4Regions,
    pixels: legacyP4Pixels,
    lineSize: LEGACY_P4_LINE_SIZE,
    toolColors: LEGACY_P4_TOOL_COLORS,
  },
];

function expectSameAsLegacy(game: SavedColoring, legacy: LegacyState, what: string): void {
  expect(pixelsOf(game, legacy.regions()), `${what}: obrázek pixel po pixelu`).toEqual(
    legacy.pixels(),
  );
  if (legacy.lineSize !== undefined) {
    expect(game.lineSize(), `${what}: tloušťka`).toBe(legacy.lineSize);
  }
  if (legacy.toolColors !== undefined) {
    for (const tool of COLOR_TOOLS) {
      expect(game.toolColor(tool), `${what}: barva ${TOOL_NAMES[tool]}`).toBe(
        legacy.toolColors[tool],
      );
    }
  }
}

describe('#148 AC5: starý záznam nedávných barev se ignoruje a nesmaže', () => {
  it('pevné stavy starších verzí mají záznam nedávných barev', () => {
    for (const legacy of LEGACY_STATES) {
      expect(new Map(legacy.storage).has(OLD_RECENT_KEY), legacy.name).toBe(true);
    }
  });

  it('se starým záznamem nedávných barev je první tlačítko prázdné', () => {
    for (const legacy of LEGACY_STATES) {
      const game = openOn(storageWith(legacy.storage), legacy.regions());

      expect(firstButton(game), legacy.name).toBeNull();
      expect(tapPrevious(game).kind, `${legacy.name}: ťuknutí`).toBe('wobble');
    }
  });

  it('obrázek, barvy nástrojů a tloušťka starší verze zůstanou pixel po pixelu stejné', () => {
    for (const legacy of LEGACY_STATES) {
      const game = openOn(storageWith(legacy.storage), legacy.regions());

      expectSameAsLegacy(game, legacy, legacy.name);
      if (legacy.name === 'p2 z #93') {
        expect(game.palette().selected, `${legacy.name}: vybraná barva`).toBe(
          LEGACY_P2_SELECTED_COLOR,
        );
      }
    }
  });

  it('starý záznam nedávných barev zůstane v úložišti beze změny i po přepínání a odchodu', () => {
    for (const legacy of LEGACY_STATES) {
      const storage = storageWith(legacy.storage);
      const original = storage.data.get(OLD_RECENT_KEY);
      const game = openOn(storage, legacy.regions());

      pickTool(game, 'marker');
      tapPrevious(game);
      tapQuickEraser(game);
      giveColor(game, 'crayon', PINK);
      game.suspend();

      expect(storage.data.get(OLD_RECENT_KEY), legacy.name).toBe(original);
    }
  });

  it('po přepínání a obnovení se starý stav otevře se stejným obrázkem a předchozím nástrojem', () => {
    for (const legacy of LEGACY_STATES) {
      const storage = storageWith(legacy.storage);
      const game = openOn(storage, legacy.regions());
      pickTool(game, 'stripes');
      pickTool(game, 'spray');
      game.suspend();

      const again = openOn(storage, legacy.regions());

      expectSameAsLegacy(again, legacy, `${legacy.name} po obnovení`);
      expect(firstButton(again)?.tool, `${legacy.name}: první tlačítko`).toBe('stripes');
    }
  });

  it('záznam nedávných barev vedle nového záznamu předchozího nástroje nic nezmění', () => {
    const { storage } = storageWithPreviousMarker();
    const withOld = copyOf(storage);
    withOld.data.set(OLD_RECENT_KEY, '4,5');

    expect(firstButton(openOn(withOld, twoHalves()))).toEqual(
      firstButton(openOn(storage, twoHalves())),
    );
  });
});
