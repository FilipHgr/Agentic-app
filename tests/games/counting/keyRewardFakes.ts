import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import { STAR_FLIGHT_MS, CELEBRATION_MS } from '../../../src/games/counting/logic/countingSession';
import { serializeMapProgress } from '../../../src/shared/logic/progressMap';
import type { MapProgress } from '../../../src/shared/logic/progressMap';
import { serializeSettings } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/shared/logic/stars';
import {
  MAP_PROGRESS_AREA,
  MAP_PROGRESS_KEY,
  openMapProgress,
} from '../../../src/shared/storage/mapProgressStorage';
import type { MapProgressStore } from '../../../src/shared/logic/progressMap';
import type { KeyRewards } from '../../../src/shared/logic/keyRewards';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../../src/shared/storage/keyRewardsStorage';
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
import { SETTINGS_KEY } from './storageFakes';

/**
 * Pomůcky pro testy klíčů za dokončené mapy v Počítání (#139). Stránka
 * (`openProfiles` nad úložištěm zařízení) dá hře úložiště Počítání
 * aktivního profilu a klíče aktivního profilu
 * (`openKeyRewards(gameStorage(KEY_REWARDS_AREA))`), jak to dělá
 * spouštění her. Sezení Počítání dostane klíče volitelnou volbou
 * `keyRewards`. Nic se nekreslí ani nehraje.
 */

export const COUNTING = 'counting';

/** Jedno načtení stránky nad úložištěm zařízení `storage`. */
export function openPage(storage: DeviceStorage): ProfileStore {
  return openProfiles(storage);
}

/**
 * Mapa postupu aktivního profilu, jak ji stránka předá hře (#193): ve
 * společné oblasti profilu a s převodem dřívější mapy Počítání.
 */
export function mapOf(page: ProfileStore): MapProgressStore {
  return openMapProgress(page.gameStorage(MAP_PROGRESS_AREA), page.gameStorage(COUNTING));
}

/** Klíče aktivního profilu, jak je stránka předá hře. */
export function keysOf(page: ProfileStore): KeyRewards {
  return openKeyRewards(page.gameStorage(KEY_REWARDS_AREA));
}

/** Společné úložiště mapy postupu aktivního profilu (#193), kam mapu ukládají všechny hry. */
export function mapStorageOf(page: ProfileStore): KeyValueStorage {
  return page.gameStorage(MAP_PROGRESS_AREA);
}

/**
 * Úložiště Počítání aktivního profilu s uloženým nastavením (průvodce se
 * neukáže); volitelně s mapou, kterou Počítání uložilo dřív (do #193 ve
 * svém úložišti). Stránka ji při prvním otevření převede do společné mapy
 * profilu (`mapOf`).
 */
export function countingStorageOf(page: ProfileStore, map?: MapProgress): KeyValueStorage {
  const storage = page.gameStorage(COUNTING);
  if (storage.getItem(SETTINGS_KEY) === null) {
    storage.setItem(SETTINGS_KEY, serializeSettings(KEYPAD_SETTINGS));
  }
  if (map !== undefined) {
    storage.setItem(MAP_PROGRESS_KEY, serializeMapProgress(map));
  }
  return storage;
}

export interface KeyedCounting extends TestSession {
  readonly sounds: FakeSounds;
  readonly page: FakePage;
}

/**
 * Jeden vstup do Počítání s úložištěm hry a klíči od stránky (bez klíčů
 * `undefined`). Bez mapy od stránky leží mapa v úložišti hry `storage`.
 */
export function enterCountingWithKeys(
  storage: KeyValueStorage | undefined,
  keyRewards: KeyRewards | undefined,
  seed?: number,
  mapProgress: MapProgressStore = openMapProgress(storage),
): KeyedCounting {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  const sounds = new FakeSounds();
  const page = new FakePage();
  let changes = 0;
  const session = createCountingSession({
    storage,
    random: seededRandom(seed),
    sounds,
    voice: new FakeVoice(),
    timers,
    page,
    loadRecognizer: recognizer.load,
    keyRewards,
    mapProgress,
    onChange: () => {
      changes += 1;
    },
  });
  return { session, timers, recognizer, sounds, page, changes: () => changes };
}

/** Vstup do Počítání aktivního profilu stránky `page` (volitelně s mapou uloženou dřív). */
export function enterCountingOn(page: ProfileStore, map?: MapProgress): KeyedCounting {
  return enterCountingWithKeys(countingStorageOf(page, map), keysOf(page), undefined, mapOf(page));
}

/** Dítě vyřeší 9 příkladů a ťukne správně na 10.: řada je plná, nic dalšího neproběhlo. */
export function fillRow(test: TestSession): void {
  solveProblems(test, STARS_PER_SET - 1);
  test.session.tapAnswer(correctAnswerOf(test.session));
}

/** Plná řada a všechno, co po ní přijde (oslava, mapa, nový příklad). */
export function completeRow(test: TestSession): void {
  fillRow(test);
  test.timers.runAll();
}

/** Posouvá čas po 1 ms, dokud se po plné řadě neukáže mapa. */
export function waitForMap(test: TestSession): void {
  const limit = STAR_FLIGHT_MS + CELEBRATION_MS + 1000;
  for (let elapsed = 0; elapsed <= limit; elapsed += 1) {
    if (test.session.shownMap() !== null) {
      return;
    }
    test.timers.advance(1);
  }
  throw new Error('mapa se po oslavě neukázala');
}
