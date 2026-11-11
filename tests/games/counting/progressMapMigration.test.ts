import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_MS,
  STAR_FLIGHT_MS,
  createCountingSession,
} from '../../../src/games/counting/logic/countingSession';
import { MAP_STEPS, mapThemeFor } from '../../../src/games/counting/logic/progressMap';
import type { MapMove, MapProgress } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MAP_PROGRESS_KEY, loadMapProgress } from '../../../src/games/counting/storage/mapStorage';
import { COUNTING_META } from '../../../src/games/counting/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';

import { seededRandom } from './seededRandom';
import {
  FakePage,
  FakeRecognizerLoader,
  FakeSounds,
  FakeTimers,
  FakeVoice,
  KEYPAD_SETTINGS,
  correctAnswerOf,
  solveProblems,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';

/**
 * Testy k #133 AC4: záznam mapy uložený před změnou na 3 kroky (tvar z #87,
 * `{ step: 0–8, completedMaps }`) se převede u každého profilu zvlášť při
 * jeho prvním otevření Počítání po aktualizaci, a jen jednou. Jedno
 * „načtení stránky“ je `openProfiles(storage)`, vstup do Počítání je sezení
 * nad úložištěm hry aktivního profilu (jako v `progressMapProfiles.test.ts`).
 *
 * Navržené rozhraní: `loadMapProgress(storage)` v
 * `src/games/counting/storage/mapStorage.ts` přečte záznam z #87, převede
 * ho (0 → 0, 1–2 → 1, 3–7 → 2, 8 → 3, počet map zůstane) a hned ho uloží
 * v novém tvaru, který se od záznamu z #87 pozná (navrženo pole
 * `format: 2` v `serializeMapProgress`). Nový záznam se už nepřevádí.
 * Když uložit nejde, hra jede s převedeným postupem v paměti.
 */

/** Záznam mapy, jak ho uložila hra z #87 (kroky 0 až 8). */
function legacyRecord(step: number, completedMaps: number): string {
  return JSON.stringify({ step, completedMaps });
}

/** Dítě ťukne v menu na Počítání aktivního profilu; průvodce projde rodič. */
function enterCounting(store: ProfileStore): TestSession {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  const session = createCountingSession({
    storage: store.gameStorage(COUNTING_META.id),
    random: seededRandom(),
    sounds: new FakeSounds(),
    voice: new FakeVoice(),
    timers,
    page: new FakePage(),
    loadRecognizer: recognizer.load,
    onChange: () => undefined,
  });
  if (session.guideOpen()) {
    session.finishGuide(KEYPAD_SETTINGS);
  }
  return { session, timers, recognizer, changes: () => 0 };
}

/** Kde stojí značka, když dítě vstoupí do Počítání (a hned odejde domečkem). */
function mapOnEntry(store: ProfileStore): MapProgress {
  const test = enterCounting(store);
  const progress = test.session.mapProgress();
  test.session.leave();
  return progress;
}

/** Dítě zaplní jednu řadu a vrátí, co mapa po oslavě ukáže. */
function fillRowAndWatchMap(test: TestSession): MapMove {
  solveProblems(test, STARS_PER_SET - 1);
  test.session.tapAnswer(correctAnswerOf(test.session));
  const limit = STAR_FLIGHT_MS + CELEBRATION_MS + 1000;
  for (let waited = 0; waited <= limit && test.session.shownMap() === null; waited += 10) {
    test.timers.advance(10);
  }
  const shown = test.session.shownMap();
  if (shown === null) {
    throw new Error('mapa se po oslavě neukázala');
  }
  return shown;
}

/** Zařízení s jedním profilem, který má uloženou mapu z #87. */
function deviceWithLegacyMap(step: number, completedMaps: number): DeviceStorage {
  const storage = new DeviceStorage();
  const store = openProfiles(storage);
  store.gameStorage(COUNTING_META.id).setItem(MAP_PROGRESS_KEY, legacyRecord(step, completedMaps));
  return storage;
}

/** Záznam mapy aktivního profilu, jak leží v zařízení. */
function savedRecord(store: ProfileStore): string | null {
  return store.gameStorage(COUNTING_META.id).getItem(MAP_PROGRESS_KEY);
}

const CONVERSIONS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 1],
  [2, 1],
  [3, 2],
  [5, 2],
  [7, 2],
  [8, 3],
];

describe('#133 AC4: starý postup z 8 kroků se při prvním otevření Počítání převede na 3 kroky', () => {
  it('starý krok 0 zůstane 0, 1–2 dá 1. zastávku, 3–7 2. zastávku a 8 cíl', () => {
    for (const [oldStep, newStep] of CONVERSIONS) {
      const store = openProfiles(deviceWithLegacyMap(oldStep, 2));
      expect(mapOnEntry(store), `starý krok ${oldStep}`).toEqual({
        step: newStep,
        completedMaps: 2,
      });
    }
  });

  it('počet dokončených map při převodu zůstane', () => {
    for (const completedMaps of [0, 1, 4, 13]) {
      const store = openProfiles(deviceWithLegacyMap(5, completedMaps));
      expect(mapOnEntry(store).completedMaps, `${completedMaps} map`).toBe(completedMaps);
    }
  });

  it('profil ve starém cíli stojí po převodu v cíli a další řada ukáže další mapu na 1. zastávce', () => {
    const store = openProfiles(deviceWithLegacyMap(8, 2));
    const test = enterCounting(store);
    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 2 });

    expect(fillRowAndWatchMap(test)).toMatchObject({
      from: 0,
      to: 1,
      reachedGoal: false,
      theme: mapThemeFor(2),
    });
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 2 });
  });

  it('po převodu jde dítě dál: ze 2. zastávky ho další řada dovede do cíle', () => {
    const store = openProfiles(deviceWithLegacyMap(6, 0));
    const test = enterCounting(store);
    expect(fillRowAndWatchMap(test)).toMatchObject({ from: 2, to: 3, reachedGoal: true });
    expect(test.session.mapProgress()).toEqual({ step: 3, completedMaps: 1 });
  });

  it('převod se uloží už při prvním otevření, i když dítě nic nevyřeší a odejde', () => {
    const legacy = legacyRecord(5, 1);
    const storage = deviceWithLegacyMap(5, 1);
    const store = openProfiles(storage);
    mapOnEntry(store);

    expect(savedRecord(store), 'záznam už není ve starém tvaru').not.toBe(legacy);
    expect(loadMapProgress(store.gameStorage(COUNTING_META.id))).toEqual({
      step: 2,
      completedMaps: 1,
    });
  });

  it('převod se uloží i při zavření hry hned po otevření (bez odchodu domečkem)', () => {
    const storage = deviceWithLegacyMap(4, 3);
    enterCounting(openProfiles(storage));
    // Hra se zavřela: žádné `leave()`.

    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 2, completedMaps: 3 });
  });
});

describe('#133 AC4: převedený záznam se už nikdy nepřevádí znovu', () => {
  it('při dalším otevření zůstane krok 2 z 3 krokem 2', () => {
    const storage = deviceWithLegacyMap(5, 1);
    const store = openProfiles(storage);
    expect(mapOnEntry(store), 'první otevření').toEqual({ step: 2, completedMaps: 1 });
    expect(mapOnEntry(store), 'druhé otevření').toEqual({ step: 2, completedMaps: 1 });
    expect(mapOnEntry(openProfiles(storage)), 'po obnovení stránky').toEqual({
      step: 2,
      completedMaps: 1,
    });
  });

  it('převedený cíl zůstane cílem i po mnoha otevřeních a obnoveních stránky', () => {
    const storage = deviceWithLegacyMap(8, 0);
    for (let open = 1; open <= 4; open += 1) {
      expect(mapOnEntry(openProfiles(storage)), `otevření ${open}`).toEqual({
        step: 3,
        completedMaps: 0,
      });
    }
  });

  it('krok, na který dítě po převodu došlo, se při dalším otevření nezmění', () => {
    const storage = deviceWithLegacyMap(2, 0);
    const store = openProfiles(storage);
    const test = enterCounting(store);
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 0 });
    fillRowAndWatchMap(test);
    test.session.leave();

    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 2, completedMaps: 0 });
  });

  it('nový profil po aktualizaci nemá co převádět a začíná na startu první mapy', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    expect(mapOnEntry(store)).toEqual({ step: 0, completedMaps: 0 });
    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 0, completedMaps: 0 });
  });
});

describe('#133 AC4: každý profil se převede zvlášť při svém prvním otevření Počítání', () => {
  /** Zařízení se dvěma profily, oba mají uloženou mapu z #87. */
  function twoProfilesWithLegacyMaps(): {
    storage: DeviceStorage;
    firstId: string;
    secondId: string;
  } {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    store.gameStorage(COUNTING_META.id).setItem(MAP_PROGRESS_KEY, legacyRecord(5, 1));
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);
    store.gameStorage(COUNTING_META.id).setItem(MAP_PROGRESS_KEY, legacyRecord(2, 4));
    store.selectProfile(first.id);
    return { storage, firstId: first.id, secondId: second.id };
  }

  it('otevření Počítání v jednom profilu nepřevede záznam druhého profilu', () => {
    const { storage, firstId, secondId } = twoProfilesWithLegacyMaps();
    const store = openProfiles(storage);
    store.selectProfile(firstId);
    expect(mapOnEntry(store)).toEqual({ step: 2, completedMaps: 1 });

    store.selectProfile(secondId);
    expect(savedRecord(store), 'druhý profil Počítání neotevřel').toBe(legacyRecord(2, 4));
  });

  it('profil, který Počítání neotevřel, se převede až při svém prvním otevření', () => {
    const { storage, firstId, secondId } = twoProfilesWithLegacyMaps();
    const store = openProfiles(storage);
    store.selectProfile(firstId);
    mapOnEntry(store);
    mapOnEntry(store);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(secondId);
    expect(mapOnEntry(reloaded), 'první otevření druhého profilu').toEqual({
      step: 1,
      completedMaps: 4,
    });
    expect(mapOnEntry(reloaded), 'druhé otevření druhého profilu').toEqual({
      step: 1,
      completedMaps: 4,
    });
  });

  it('převod druhého profilu nezmění už převedený postup prvního profilu', () => {
    const { storage, firstId, secondId } = twoProfilesWithLegacyMaps();
    const store = openProfiles(storage);
    store.selectProfile(firstId);
    mapOnEntry(store);
    store.selectProfile(secondId);
    mapOnEntry(store);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(firstId);
    expect(mapOnEntry(reloaded)).toEqual({ step: 2, completedMaps: 1 });
    reloaded.selectProfile(secondId);
    expect(mapOnEntry(reloaded)).toEqual({ step: 1, completedMaps: 4 });
  });

  it('každý profil po převodu pokračuje na své mapě v pořadí', () => {
    const { storage, firstId, secondId } = twoProfilesWithLegacyMaps();
    const store = openProfiles(storage);
    store.selectProfile(firstId);
    const first = enterCounting(store);
    expect(fillRowAndWatchMap(first), 'první profil, 1 hotová mapa').toMatchObject({
      from: 2,
      to: 3,
      theme: 'forest',
    });
    first.session.leave();

    store.selectProfile(secondId);
    const second = enterCounting(store);
    expect(fillRowAndWatchMap(second), 'druhý profil, 4 hotové mapy').toMatchObject({
      from: 1,
      to: 2,
      theme: 'space',
    });
    second.session.leave();
  });
});

describe('#133 AC4: převod funguje i když úložiště nejde zapsat', () => {
  /** Úložiště hry, které vrací starý záznam, ale zápis selže (plné). */
  function fullStorageWith(saved: string): KeyValueStorage {
    return {
      getItem: (key) => (key === MAP_PROGRESS_KEY ? saved : null),
      setItem: () => {
        throw new Error('úložiště plné');
      },
    };
  }

  it('starý záznam v plném úložišti se převede v paměti a hra nevidí chybu', () => {
    const storage = fullStorageWith(legacyRecord(7, 2));
    expect(() => loadMapProgress(storage)).not.toThrow();
    expect(loadMapProgress(storage)).toEqual({ step: 2, completedMaps: 2 });
  });
});
