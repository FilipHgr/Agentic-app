import { vi } from 'vitest';

import { letterKeys } from '../../src/menu/logic/letterGrid';
import { ADD_PROFILE_HOLD_MS, createProfileScreens } from '../../src/menu/logic/profileScreens';
import type { ProfileFeedback, ProfileScreens } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { ProfileColor } from '../../src/shared/logic/profiles';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../shared/profileFixtures';

/**
 * Pomůcky pro testy výběru profilu a formuláře nového profilu (#72).
 * Jedno `openProfiles(storage)` je jedno načtení stránky; obrazovky profilů
 * dostanou profily zařízení a hlásí odezvu a výběr profilu.
 */

export interface TestProfileScreens {
  readonly storage: DeviceStorage;
  readonly store: ProfileStore;
  readonly screens: ProfileScreens;
  readonly feedback: ProfileFeedback[];
  /** Kolikrát dítě vybralo profil (stránka pak ukáže menu). */
  chosen(): number;
}

/** Obrazovky profilů nad úložištěm zařízení, otevřený výběr profilu. */
export function testProfileScreens(
  storage: DeviceStorage = new DeviceStorage(),
): TestProfileScreens {
  const store = openProfiles(storage);
  const feedback: ProfileFeedback[] = [];
  let chosen = 0;
  const screens = createProfileScreens({
    profiles: store,
    feedback: (event) => feedback.push(event),
    onProfileChosen: () => {
      chosen += 1;
    },
  });
  screens.open();
  return { storage, store, screens, feedback, chosen: () => chosen };
}

/**
 * Zařízení, kde už je výchozí profil (bez přezdívky, první barva) a za ním
 * profily s přezdívkami a barvami podle pořadí (bez zadané barvy další
 * barva palety).
 */
export function deviceWithProfiles(
  profiles: ReadonlyArray<{ readonly nickname: string; readonly color?: ProfileColor }>,
): DeviceStorage {
  const storage = new DeviceStorage();
  const store = openProfiles(storage);
  profiles.forEach((profile, index) => {
    store.createProfile({
      nickname: profile.nickname,
      color: profile.color ?? PROFILE_COLORS[(index + 1) % PROFILE_COLORS.length] ?? '#E8590C',
    });
  });
  return storage;
}

/** Rodič podrží „+“ 1 s a pustí. Potřebuje falešné hodiny Vitestu. */
export function holdAdd(screens: ProfileScreens, pointerId = 1): void {
  screens.addButton.press(pointerId);
  vi.advanceTimersByTime(ADD_PROFILE_HOLD_MS);
  screens.addButton.release(pointerId);
}

/** Je písmeno na právě ukázané vrstvě mřížky? */
function isOnLayer(screens: ProfileScreens, letter: string): boolean {
  return letterKeys(screens.letterLayer()).some(
    (key) => key.kind === 'letter' && key.letter === letter,
  );
}

/** Rodič naťuká přezdívku po písmenech; na diakritiku přepne vrstvu přepínačem. */
export function typeNickname(screens: ProfileScreens, text: string): void {
  for (const letter of text) {
    if (!isOnLayer(screens, letter)) {
      screens.tapLayerSwitch();
    }
    screens.tapLetter(letter);
  }
}

/** Celý formulář: podržet „+“, naťukat přezdívku, →, případně barva, ✓. */
export function addProfile(screens: ProfileScreens, nickname: string, color?: ProfileColor): void {
  holdAdd(screens);
  typeNickname(screens, nickname);
  screens.tapNext();
  if (color !== undefined) {
    screens.tapColor(color);
  }
  screens.tapSave();
}

/** Přezdívky na výběru profilu v pořadí koleček (bez přezdívky `null`). */
export function pickerNicknames(screens: ProfileScreens): Array<string | null> {
  return screens.pickerItems().map((item) => item.nickname);
}

/** Jak dlouho rodič drží kolečko profilu, aby otevřel úpravu (#73, 1 s). */
export const EDIT_PROFILE_HOLD_MS = 1000;

/**
 * Rodič drží kolečko profilu `id` na výběru `ms` milisekund a pustí (#73).
 * Potřebuje falešné hodiny Vitestu.
 */
export function holdProfile(
  screens: ProfileScreens,
  id: string,
  ms = EDIT_PROFILE_HOLD_MS,
  pointerId = 1,
): void {
  const button = screens.profileButton(id);
  button.press(pointerId);
  vi.advanceTimersByTime(ms);
  button.release(pointerId);
}

/** Smaže z formuláře úpravy všechna písmena přezdívky (#73). */
export function clearNickname(screens: ProfileScreens): void {
  // Pevný počet pokusů, aby test bez hotové úpravy neuvízl ve smyčce.
  for (let attempt = 0; attempt < 20 && screens.nickname() !== ''; attempt += 1) {
    screens.tapBackspace();
  }
}
