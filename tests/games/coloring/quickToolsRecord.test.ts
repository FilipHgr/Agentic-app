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
import { firstButton, shownAs, tapFirstButton, tapQuickEraser } from './quickToolsHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import { COLOR_TOOLS, GREEN, PINK, giveColor, pickTool } from './toolColorsHelpers';

/**
 * Testy k #163 AC5 (po otevření hry štětec, pro přepínání se nic neukládá),
 * které nahrazují testy pamatování předchozího nástroje z #148 AC5. Jedno
 * „otevření hry“ je `openColoring(…)` nad úložištěm hry profilu, „obnovení
 * stránky“ nové `openProfiles(storage)` nad stejným úložištěm zařízení,
 * odchod domečkem a schování stránky hlásí scéna jako `suspend()`
 * (`savedPictureHelpers.ts`).
 *
 * Starý záznam předchozího nástroje z #148 má klíč `quickTools` v úložišti
 * hry profilu (text „a,b“ s id nástrojů), starý záznam nedávných barev (#99)
 * klíč `recentColors.<omalovánka>`, jak je zapisovaly dřívější verze (pevné
 * záznamy `legacy*RecordFixture.ts`). Oba se nečtou ani nemažou.
 */

/** Klíč, pod kterým dřívější verze ukládala nedávné barvy omalovánky domek. */
const OLD_RECENT_KEY = 'recentColors.house';

/** Klíč, pod kterým verze z #148 ukládala předchozí nástroj. */
const OLD_QUICK_TOOLS_KEY = 'quickTools';

/** Záznamy, které mohla verze z #148 zapsat (i poškozené). */
const OLD_QUICK_TOOLS_RECORDS = ['marker', 'marker,crayon', 'rainbow,spray', 'eraser', 'nesmysl'];

function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}

/** Dítě přepíná nástroje v panelu i v pruhu, barvy ani obrázek nemění. */
function switchTools(game: SavedColoring): void {
  pickTool(game, 'marker');
  pickTool(game, 'rainbow');
  tapQuickEraser(game);
  tapFirstButton(game);
  pickTool(game, 'spray');
  tapQuickEraser(game);
  if (game.panelOpen()) {
    game.tapHandle();
  }
}

/** Po otevření je vybraný štětec a na prvním tlačítku štětec (#163 AC5). */
function expectBrushOnOpening(game: SavedColoring, what: string): void {
  expect(game.selectedTool(), `${what}: vybraný štětec`).toBe('brush');
  expect(firstButton(game), `${what}: na prvním tlačítku štětec`).toEqual(shownAs(game, 'brush'));
}

describe('#163 AC5: po otevření hry je na prvním tlačítku štětec', () => {
  it('v novém profilu je vybraný štětec a na prvním tlačítku štětec ve své barvě', () => {
    const game = enterColoring(openProfiles(new DeviceStorage()), twoHalves());

    expectBrushOnOpening(game, 'nový profil');
    expect(firstButton(game).color, 'kolečko jako v úchytu').toBe(game.handleView().color);
  });

  it('ťuknutí na štětec na prvním tlačítku po otevření ho jen zhoupne', () => {
    const game = enterColoring(openProfiles(new DeviceStorage()), twoHalves());

    expect(tapFirstButton(game).kind).toBe('wobble');
    expect(game.selectedTool(), 'nástroj se nezměnil').toBe('brush');
  });

  it('po gumě hned po otevření vrátí první tlačítko štětec', () => {
    const game = enterColoring(openProfiles(new DeviceStorage()), twoHalves());
    tapQuickEraser(game);

    expect(firstButton(game), 's gumou').toEqual(shownAs(game, 'brush'));
    expect(tapFirstButton(game).kind, 'ťuknutí').toBe('picked');
    expect(game.selectedTool(), 'vybraný štětec').toBe('brush');
  });

  it('po návratu z menu je na prvním tlačítku štětec, ať dítě předtím vybralo cokoli', () => {
    for (const last of [...COLOR_TOOLS, 'rainbow', 'eraser'] as const) {
      const store = openProfiles(new DeviceStorage());
      const regions = twoHalves();
      const game = enterColoring(store, regions);
      giveColor(game, 'marker', GREEN);
      pickTool(game, last);
      game.suspend();

      expectBrushOnOpening(enterColoring(store, regions), TOOL_NAMES[last]);
    }
  });

  it('po obnovení stránky je na prvním tlačítku štětec a nástroj z minula jde vybrat v panelu', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(device), regions);
    giveColor(game, 'crayon', PINK);
    tapQuickEraser(game);
    game.suspend();

    const reloaded = enterColoring(openProfiles(device), regions);
    expectBrushOnOpening(reloaded, 'po obnovení');
    pickTool(reloaded, 'crayon');

    expect(firstButton(reloaded), 'pastelka si nechala barvu').toEqual({
      tool: 'crayon',
      color: PINK,
    });
  });

  it('v jiné omalovánce i v jiném profilu začíná první tlačítko štětcem', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const first = enterColoring(store, regions);
    switchTools(first);
    first.suspend();
    const otherPicture = openOn(new RecordingStorage(), regions, { id: 'cat', version: 1 });
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);

    expectBrushOnOpening(otherPicture, 'jiná omalovánka');
    expectBrushOnOpening(enterColoring(store, regions), 'jiný profil');
  });
});

describe('#163 AC5: pro přepínání se nic neukládá', () => {
  it('přepínání nástrojů v panelu i v pruhu nic do úložiště nezapíše', () => {
    const baseline = new RecordingStorage();
    openOn(baseline, twoHalves()).suspend();
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());

    switchTools(game);
    game.suspend();

    expect(Object.fromEntries(storage.data)).toEqual(Object.fromEntries(baseline.data));
  });

  it('starý záznam předchozího nástroje se nečte: první tlačítko je po otevření štětec', () => {
    for (const record of OLD_QUICK_TOOLS_RECORDS) {
      const game = openOn(storageWith([[OLD_QUICK_TOOLS_KEY, record]]), twoHalves());

      expectBrushOnOpening(game, `záznam ${JSON.stringify(record)}`);
    }
  });

  it('starý záznam předchozího nástroje zůstane v úložišti beze změny i po přepínání a odchodu', () => {
    for (const record of OLD_QUICK_TOOLS_RECORDS) {
      const storage = storageWith([[OLD_QUICK_TOOLS_KEY, record]]);
      const game = openOn(storage, twoHalves());

      switchTools(game);
      game.suspend();

      expect(storage.data.get(OLD_QUICK_TOOLS_KEY), JSON.stringify(record)).toBe(record);
    }
  });

  it('bez starého záznamu se záznam předchozího nástroje nezaloží', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());

    switchTools(game);
    game.suspend();

    expect(storage.data.has(OLD_QUICK_TOOLS_KEY)).toBe(false);
  });

  it('nečitelné úložiště: hra se nezastaví a na prvním tlačítku je štětec', () => {
    const storage = new RecordingStorage();
    storage.failReads = true;

    expect(() => {
      expectBrushOnOpening(openOn(storage, twoHalves()), 'nečitelné úložiště');
    }).not.toThrow();
  });

  it('zakázané úložiště: přepínání funguje aspoň do odchodu', () => {
    expect(() => {
      const game = enterColoring(openProfiles(forbiddenStorage()), twoHalves());
      expectBrushOnOpening(game, 'zakázané úložiště');
      pickTool(game, 'marker');
      tapQuickEraser(game);
      tapFirstButton(game);
      expect(game.selectedTool()).toBe('marker');
      expect(firstButton(game).tool).toBe('marker');
      game.suspend();
    }).not.toThrow();
  });

  it('při plném úložišti jde přepínat dál bez chyby', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    storage.failWrites = true;

    expect(() => {
      pickTool(game, 'marker');
      tapQuickEraser(game);
      tapFirstButton(game);
    }).not.toThrow();
    expect(game.selectedTool()).toBe('marker');
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

  // Upraveno k #163 AC5: na prvním tlačítku je po otevření vždy štětec.
  it('se starým záznamem nedávných barev je po otevření na prvním tlačítku štětec', () => {
    for (const legacy of LEGACY_STATES) {
      const game = openOn(storageWith(legacy.storage), legacy.regions());

      expectBrushOnOpening(game, legacy.name);
      expect(tapFirstButton(game).kind, `${legacy.name}: ťuknutí`).toBe('wobble');
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

      switchTools(game);
      giveColor(game, 'crayon', PINK);
      game.suspend();

      expect(storage.data.get(OLD_RECENT_KEY), legacy.name).toBe(original);
    }
  });

  // Upraveno k #163 AC5: po obnovení je na prvním tlačítku štětec.
  it('po přepínání a obnovení se starý stav otevře se stejným obrázkem a štětcem na prvním tlačítku', () => {
    for (const legacy of LEGACY_STATES) {
      const storage = storageWith(legacy.storage);
      const game = openOn(storage, legacy.regions());
      switchTools(game);
      game.suspend();

      const again = openOn(storage, legacy.regions());

      expectSameAsLegacy(again, legacy, `${legacy.name} po obnovení`);
      expectBrushOnOpening(again, legacy.name);
    }
  });
});
