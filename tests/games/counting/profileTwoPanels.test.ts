import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { COUNTING_META } from '../../../src/games/counting/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, profileDataKeys } from '../../shared/profileFixtures';

import { seededRandom } from './seededRandom';
import {
  FakePage,
  FakeRecognizerLoader,
  FakeSounds,
  FakeTimers,
  FakeVoice,
  solveProblems,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';

/**
 * Testy k #75 AC3 a AC5 z pohledu Počítání: hvězdičky a nastavení, které
 * dítě získá v jednom panelu, se neztratí, když rodič v druhém panelu smaže
 * jiný profil, a spuštění hry z menu nic nesmaže.
 *
 * Dva panely jsou dvě volání `openProfiles` nad jedním úložištěm zařízení,
 * další `openProfiles(storage)` je nové načtení stránky. Vstup do Počítání
 * je sezení hry nad úložištěm aktivního profilu.
 */

const FIRST_SETTINGS: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };
const PARENT_SETTINGS: GameSettings = { maxNumber: 20, operations: 'minus', answerInput: 'keypad' };

interface PanelSession extends TestSession {
  readonly page: FakePage;
}

/** Dítě ťukne v menu na Počítání: sezení hry nad úložištěm aktivního profilu. */
function enterCounting(store: ProfileStore): PanelSession {
  const timers = new FakeTimers();
  const page = new FakePage();
  const recognizer = new FakeRecognizerLoader();
  let changes = 0;
  const session = createCountingSession({
    storage: store.gameStorage(COUNTING_META.id),
    random: seededRandom(7),
    sounds: new FakeSounds(),
    voice: new FakeVoice(),
    timers,
    page,
    loadRecognizer: recognizer.load,
    onChange: () => {
      changes += 1;
    },
  });
  return { session, timers, recognizer, page, changes: () => changes };
}

/** Dítě profilu `profileId` dokončí průvodce a vyřeší `stars` příkladů. */
function playAs(store: ProfileStore, profileId: string, stars: number): void {
  store.selectProfile(profileId);
  const test = enterCounting(store);
  test.session.finishGuide(FIRST_SETTINGS);
  solveProblems(test, stars);
  test.session.leave();
}

/** Co dítě profilu `profileId` po vstupu do Počítání vidí. */
function whatChildSees(
  store: ProfileStore,
  profileId: string,
): { stars: number; settings: GameSettings; guide: boolean } {
  store.selectProfile(profileId);
  const test = enterCounting(store);
  const seen = {
    stars: test.session.starCount(),
    settings: test.session.settings(),
    guide: test.session.guideOpen(),
  };
  test.session.leave();
  return seen;
}

describe('#75 AC3: hvězdičky z jednoho panelu přežijí smazání v druhém', () => {
  it('dítě v profilu A z panelu 1 má po novém načtení své hvězdičky, i když panel 2 smazal jiný profil', () => {
    const storage = new DeviceStorage();
    const setup = openProfiles(storage);
    const other = setup.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[2] });
    const panel1 = openProfiles(storage);
    const panel2 = openProfiles(storage);

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    playAs(panel1, a.id, 4);
    expect(panel2.deleteProfile(other.id)).toBe(true);

    const reloaded = openProfiles(storage);
    expect(reloaded.profiles().map((profile) => profile.id)).toContain(a.id);
    expect(reloaded.profiles().map((profile) => profile.id)).not.toContain(other.id);
    expect(whatChildSees(reloaded, a.id)).toEqual({
      stars: 4,
      settings: FIRST_SETTINGS,
      guide: false,
    });
  });

  it('nastavení, které rodič změnil v profilu A, zůstane po smazání jiného profilu v druhém panelu', () => {
    const storage = new DeviceStorage();
    const setup = openProfiles(storage);
    const other = setup.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[2] });
    const panel1 = openProfiles(storage);
    const panel2 = openProfiles(storage);

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    playAs(panel1, a.id, 2);
    const test = enterCounting(panel1);
    test.page.holdGear();
    test.session.confirmSettings(PARENT_SETTINGS);
    test.session.leave();
    panel2.deleteProfile(other.id);

    expect(whatChildSees(openProfiles(storage), a.id)).toEqual({
      stars: 2,
      settings: PARENT_SETTINGS,
      guide: false,
    });
  });

  it('smazaný profil přijde o hvězdičky a dítě v něm po novém načtení nezačne s nimi', () => {
    const storage = new DeviceStorage();
    const setup = openProfiles(storage);
    const other = setup.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[2] });
    playAs(setup, other.id, 3);
    const panel1 = openProfiles(storage);
    const panel2 = openProfiles(storage);

    panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    panel2.deleteProfile(other.id);

    expect(profileDataKeys(storage, other.id)).toEqual([]);
  });
});

describe('#75 AC5: spuštění hry z menu nesmaže hvězdičky ani nastavení', () => {
  it('po zahrání v jednom profilu má druhý profil po novém načtení své hvězdičky a nastavení', () => {
    const storage = new DeviceStorage();
    const setup = openProfiles(storage);
    const first = setup.activeProfile();
    const second = setup.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    playAs(setup, first.id, 3);
    playAs(setup, second.id, 5);

    const page = openProfiles(storage);
    playAs(page, first.id, 1);

    const reloaded = openProfiles(storage);
    expect(whatChildSees(reloaded, first.id).stars).toBe(4);
    expect(whatChildSees(reloaded, second.id)).toEqual({
      stars: 5,
      settings: FIRST_SETTINGS,
      guide: false,
    });
  });

  it('spuštění hry nesmaže data profilu, který v načteném seznamu panelu ještě není', () => {
    const storage = new DeviceStorage();
    openProfiles(storage);
    const panel1 = openProfiles(storage);
    const panel2 = openProfiles(storage);

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    playAs(panel1, a.id, 6);
    // Panel 2 o profilu A neví a dítě v něm spustí hru za výchozí profil.
    playAs(panel2, panel2.activeProfile().id, 1);

    expect(whatChildSees(openProfiles(storage), a.id)).toMatchObject({ stars: 6, guide: false });
  });
});
