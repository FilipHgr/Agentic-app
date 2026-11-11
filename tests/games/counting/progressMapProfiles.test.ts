import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import { START_MAP } from '../../../src/games/counting/logic/progressMap';
import type { MapMove, MapProgress } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { COUNTING_META } from '../../../src/games/counting/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
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
 * Testy k #87 AC3 a AC5 (mapa postupu v Počítání): postup na mapě a počet
 * dokončených map se pamatují podle profilu. Podle #133 má mapa 3 kroky
 * (AC1) a každý profil má vlastní místo v pořadí 5 map (AC2); očekávané
 * kroky jsou přepočítané na 3 kroky se stejnou ochranou. Jedno „načtení stránky“ je
 * `openProfiles(storage)`, vstup do Počítání je sezení nad úložištěm
 * aktivního profilu (`store.gameStorage(COUNTING_META.id)`), jako v
 * `profiles.test.ts` (#71). Odchod domečkem je `leave()`, zavření hry je
 * konec sezení bez `leave()`.
 */

/** Dítě ťukne v menu na Počítání; průvodce při prvním spuštění rodič projde. */
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

/** Dítě zaplní `rows` řad hvězdiček a odejde domečkem. */
function playRows(store: ProfileStore, rows: number): void {
  const test = enterCounting(store);
  solveProblems(test, rows * STARS_PER_SET);
  test.session.leave();
}

/** Dítě zaplní jednu řadu a vrátí, co mapa po oslavě ukáže; pak odejde domečkem. */
function nextShownMap(store: ProfileStore): MapMove {
  const test = enterCounting(store);
  solveProblems(test, STARS_PER_SET - 1);
  test.session.tapAnswer(correctAnswerOf(test.session));
  for (let waited = 0; waited < 20_000 && test.session.shownMap() === null; waited += 10) {
    test.timers.advance(10);
  }
  const shown = test.session.shownMap();
  test.session.leave();
  if (shown === null) {
    throw new Error('mapa se po oslavě neukázala');
  }
  return shown;
}

/** Kde stojí značka, když dítě vstoupí do Počítání. */
function mapOnEntry(store: ProfileStore): MapProgress {
  const test = enterCounting(store);
  const progress = test.session.mapProgress();
  test.session.leave();
  return progress;
}

describe('#87 AC3: postup na mapě se pamatuje podle profilu', () => {
  it('po návratu domečkem do menu a novém vstupu je značka na stejném kroku', () => {
    const store = openProfiles(new DeviceStorage());
    playRows(store, 2);
    expect(mapOnEntry(store)).toEqual({ step: 2, completedMaps: 0 });
  });

  it('po zavření hry bez odchodu domečkem je značka na stejném kroku', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const closed = enterCounting(store);
    solveProblems(closed, 2 * STARS_PER_SET);
    // Hra se zavřela: žádné `leave()`.

    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 2, completedMaps: 0 });
  });

  it('po obnovení stránky je značka na stejném kroku', () => {
    const storage = new DeviceStorage();
    playRows(openProfiles(storage), 1);
    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 1, completedMaps: 0 });
  });

  it('jiný profil má vlastní mapu a jeho postup nezmění mapu prvního profilu', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    playRows(store, 2);
    store.selectProfile(second.id);
    expect(mapOnEntry(store), 'druhý profil začíná na startu').toEqual(START_MAP);
    playRows(store, 5);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(mapOnEntry(reloaded)).toEqual({ step: 2, completedMaps: 0 });
    reloaded.selectProfile(second.id);
    expect(mapOnEntry(reloaded)).toEqual({ step: 2, completedMaps: 1 });
  });

  it('nový profil začíná na startu s 0 mapami, i když jiný profil už mapu dokončil', () => {
    const store = openProfiles(new DeviceStorage());
    playRows(store, 9);
    const fresh = store.createProfile({ nickname: 'GAMA', color: PROFILE_COLORS[2] });
    store.selectProfile(fresh.id);
    expect(mapOnEntry(store)).toEqual(START_MAP);
  });

  it('smazaný a znovu založený profil se stejnou přezdívkou a barvou začíná na startu', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    playRows(store, 4);
    expect(mapOnEntry(store)).toEqual({ step: 1, completedMaps: 1 });

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);

    expect(mapOnEntry(store)).toEqual(START_MAP);
    const reloaded = openProfiles(storage);
    reloaded.selectProfile(again.id);
    expect(mapOnEntry(reloaded)).toEqual(START_MAP);
  });
});

describe('#87 AC5: počet dokončených map se pamatuje podle profilu', () => {
  it('dokončená mapa zůstane po obnovení stránky a další řada začne novou mapu', () => {
    const storage = new DeviceStorage();
    playRows(openProfiles(storage), 3);
    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 3, completedMaps: 1 });

    playRows(openProfiles(storage), 1);
    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 1, completedMaps: 1 });
  });

  it('počet map po několika hraních a obnoveních stránky nikdy neklesne', () => {
    const storage = new DeviceStorage();
    let completedBefore = 0;
    for (let play = 1; play <= 6; play += 1) {
      playRows(openProfiles(storage), 3);
      const { completedMaps } = mapOnEntry(openProfiles(storage));
      expect(completedMaps, `hraní ${play}`).toBeGreaterThanOrEqual(completedBefore);
      completedBefore = completedMaps;
    }
    // 18 řad po 3 krocích: 6 hotových map, značka v cíli šesté.
    expect(mapOnEntry(openProfiles(storage))).toEqual({ step: 3, completedMaps: 6 });
  });
});

describe('#133 AC2: každý profil má vlastní místo v pořadí map a vlastní postup', () => {
  it('profil se 2 hotovými mapami hraje hrad, nový profil vedle něj začíná ostrovem', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    playRows(store, 6);

    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);
    expect(nextShownMap(store), 'druhý profil').toMatchObject({ from: 0, to: 1, theme: 'island' });

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(nextShownMap(reloaded), 'první profil').toMatchObject({
      from: 0,
      to: 1,
      theme: 'castle',
    });
  });

  it('postup jednoho profilu v pořadí map nezmění pořadí druhého', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'GAMA', color: PROFILE_COLORS[2] });

    playRows(store, 3);
    store.selectProfile(second.id);
    playRows(store, 9);
    expect(mapOnEntry(store), 'druhý profil po 3 mapách').toEqual({ step: 3, completedMaps: 3 });

    store.selectProfile(first.id);
    expect(mapOnEntry(store), 'první profil po 1 mapě').toEqual({ step: 3, completedMaps: 1 });
    expect(nextShownMap(store), 'první profil pokračuje lesem').toMatchObject({
      from: 0,
      theme: 'forest',
    });
  });
});
