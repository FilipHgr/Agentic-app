import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../src/games/counting/logic/countingSession';
import type { GameSettings } from '../../src/games/counting/logic/settings';
import { COUNTING_META } from '../../src/games/counting/meta';
import { createProfileScreens, startScreenFor } from '../../src/menu/logic/profileScreens';
import type { ProfileScreens } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage, LEGACY_PROGRESS_KEY, LEGACY_SETTINGS_KEY } from '../shared/profileFixtures';

import { seededRandom } from '../games/counting/seededRandom';
import {
  FakePage,
  FakeRecognizerLoader,
  FakeSounds,
  FakeTimers,
  FakeVoice,
  solveProblems,
} from '../games/counting/sessionFakes';
import type { TestSession } from '../games/counting/sessionFakes';

/**
 * Testy k #72 AC1 z pohledu Počítání: po výběru profilu na obrazovce P
 * ukáže Počítání hvězdičky vybraného profilu a ukládá je jen jemu.
 *
 * Jedno „načtení stránky“ je `openProfiles(storage)`; výběr profilu je
 * `createProfileScreens` z menu (`src/menu/logic/profileScreens.ts`),
 * vstup do Počítání sezení hry nad `store.gameStorage(COUNTING_META.id)`.
 */

const TODAY_SETTINGS = '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}';
const KEYPAD_SETTINGS: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };

interface Page {
  readonly store: ProfileStore;
  readonly screens: ProfileScreens;
}

/** Načtení stránky: profily zařízení a otevřený výběr profilu. */
function loadPage(storage: DeviceStorage): Page {
  const store = openProfiles(storage);
  const screens = createProfileScreens({
    profiles: store,
    feedback: () => undefined,
    onProfileChosen: () => undefined,
  });
  screens.open();
  return { store, screens };
}

/** Dítě ťukne na kolečko s přezdívkou (bez přezdívky `null`). */
function tapChild(page: Page, nickname: string | null): void {
  const item = page.screens.pickerItems().find((candidate) => candidate.nickname === nickname);
  if (item === undefined) {
    throw new Error(`profil ${String(nickname)} na výběru není`);
  }
  page.screens.tapProfile(item.id);
}

function enterCounting(store: ProfileStore): TestSession {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  let changes = 0;
  const session = createCountingSession({
    storage: store.gameStorage(COUNTING_META.id),
    random: seededRandom(),
    sounds: new FakeSounds(),
    voice: new FakeVoice(),
    timers,
    page: new FakePage(),
    loadRecognizer: recognizer.load,
    onChange: () => {
      changes += 1;
    },
  });
  return { session, timers, recognizer, changes: () => changes };
}

function starsIn(store: ProfileStore): number {
  const test = enterCounting(store);
  const stars = test.session.starCount();
  test.session.leave();
  return stars;
}

/** Zařízení s dnešními 7 hvězdičkami (výchozí profil) a druhým profilem EMA. */
function siblingsDevice(): DeviceStorage {
  const storage = new DeviceStorage({
    [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
    [LEGACY_PROGRESS_KEY]: '{"earned":7}',
  });
  openProfiles(storage).createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
  return storage;
}

describe('#72 AC1: po výběru profilu ukáže Počítání hvězdičky vybraného profilu', () => {
  it('se dvěma profily se při startu ukáže výběr profilu', () => {
    expect(startScreenFor(loadPage(siblingsDevice()).store.profiles())).toBe('profilePicker');
  });

  it('po výběru nového profilu začne Počítání bez hvězdiček', () => {
    const page = loadPage(siblingsDevice());

    tapChild(page, 'EMA');

    expect(starsIn(page.store)).toBe(0);
  });

  it('po výběru výchozího profilu ukáže Počítání jeho 7 hvězdiček', () => {
    const page = loadPage(siblingsDevice());

    tapChild(page, null);

    expect(starsIn(page.store)).toBe(7);
  });

  it('hvězdičky vyhrané po výběru profilu patří jen jemu, i po dalším načtení stránky', () => {
    const storage = siblingsDevice();
    const first = loadPage(storage);
    tapChild(first, 'EMA');
    const playing = enterCounting(first.store);
    playing.session.finishGuide(KEYPAD_SETTINGS);
    solveProblems(playing, 2);
    playing.session.leave();

    const again = loadPage(storage);
    tapChild(again, null);
    expect(starsIn(again.store)).toBe(7);
    // Po výběru je výběr profilu zavřený; znovu ho otevře ťuknutí na profil v menu.
    again.screens.open();
    tapChild(again, 'EMA');
    expect(starsIn(again.store)).toBe(2);
  });
});
