import { describe, expect, it } from 'vitest';

import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';
import {
  ACTIVE_PROFILE_KEY,
  PROFILE_LIST_KEY,
  openProfiles,
} from '../../src/shared/storage/profileStorage';
import {
  CORRUPT_PROFILE_LISTS,
  DeviceStorage,
  LEGACY_PROGRESS_KEY,
  LEGACY_SETTINGS_KEY,
  forbiddenStorage,
} from './profileFixtures';

/**
 * Testy k #71 AC1 a AC3: profily dětí v úložišti zařízení. Každé volání
 * `openProfiles(storage)` je jedno načtení stránky. Co dítě uvidí ve hře
 * (přenos dnešních dat, ukládání k aktivnímu profilu), testuje
 * `tests/games/counting/profiles.test.ts`, kolečko profilu v menu
 * `tests/menu/profileBadge.test.ts`.
 *
 * Navržené rozhraní:
 * - `src/shared/logic/profiles.ts` (čistý TypeScript): `PROFILE_COLORS`
 *   (paleta 8 barev, první = výchozí profil), typy `ProfileColor`
 *   a `Profile { id, nickname?, color }`,
 * - `src/shared/storage/profileStorage.ts`: `PROFILE_LIST_KEY`,
 *   `ACTIVE_PROFILE_KEY`, `openProfiles(storage)` vrátí `ProfileStore`
 *   s `profiles()`, `activeProfile()`, `createProfile({ nickname?, color })`,
 *   `selectProfile(id)` a `gameStorage(gameId)`.
 */

const DEFAULT_COLOR = PROFILE_COLORS[0];

/** Profil může mít jen vnitřní označení, přezdívku a barvu (AC1). */
const ALLOWED_PROFILE_FIELDS = ['color', 'id', 'nickname'];

function expectDefaultProfile(profile: Profile): void {
  expect(typeof profile.id).toBe('string');
  expect(profile.id).not.toBe('');
  expect(profile.nickname).toBeUndefined();
  expect(profile.color).toBe(DEFAULT_COLOR);
}

describe('#71 AC1: v zařízení je vždy aspoň jeden profil', () => {
  it('na novém zařízení vznikne sám právě jeden výchozí profil v první barvě bez přezdívky', () => {
    const store = openProfiles(new DeviceStorage());

    expect(store.profiles()).toHaveLength(1);
    const [profile] = store.profiles();
    expectDefaultProfile(store.activeProfile());
    expect(store.activeProfile()).toEqual(profile);
  });

  it('profil nemá nic kromě vnitřního označení, přezdívky a barvy', () => {
    const store = openProfiles(new DeviceStorage());
    const created = store.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[2] });

    for (const profile of [store.activeProfile(), created]) {
      for (const field of Object.keys(profile)) {
        expect(ALLOWED_PROFILE_FIELDS, field).toContain(field);
      }
    }
    expect(created.nickname).toBe('ANA');
    expect(created.color).toBe(PROFILE_COLORS[2]);
  });

  it('při dalším spuštění nevznikne další profil a výchozí profil má stejné označení', () => {
    const storage = new DeviceStorage();
    const first = openProfiles(storage).activeProfile();

    for (let reload = 0; reload < 3; reload += 1) {
      const store = openProfiles(storage);
      expect(store.profiles()).toHaveLength(1);
      expect(store.activeProfile()).toEqual(first);
    }
  });

  it('po obnovení stránky je aktivní stejný profil jako předtím', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    store.selectProfile(second.id);
    expect(openProfiles(storage).activeProfile()).toEqual(second);
    expect(openProfiles(storage).profiles()).toEqual([first, second]);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(openProfiles(storage).activeProfile()).toEqual(first);
  });

  it('založení profilu aktivní profil nezmění', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    expect(store.activeProfile()).toEqual(first);
    expect(openProfiles(storage).activeProfile()).toEqual(first);
  });

  it('profily mají různá vnitřní označení', () => {
    const store = openProfiles(new DeviceStorage());
    const second = store.createProfile({ color: PROFILE_COLORS[1] });
    const third = store.createProfile({ color: PROFILE_COLORS[1] });

    const ids = store.profiles().map((profile) => profile.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain(second.id);
    expect(ids).toContain(third.id);
  });

  it('uložený aktivní profil, který v seznamu není, dá bez chyby aktivní první profil', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);

    for (const missing of ['neexistuje', '', '{', first.id + '-smazany']) {
      storage.data.set(ACTIVE_PROFILE_KEY, missing);
      expect(() => openProfiles(storage), missing).not.toThrow();
      expect(openProfiles(storage).activeProfile(), missing).toEqual(first);
    }
  });

  it('výběr neznámého profilu aktivní profil nezmění', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();

    expect(() => store.selectProfile('neexistuje')).not.toThrow();
    expect(store.activeProfile()).toEqual(first);
    expect(openProfiles(storage).activeProfile()).toEqual(first);
  });

  it('když prohlížeč úložiště zakáže, hra běží bez chyby s výchozím profilem v paměti', () => {
    for (const storage of [forbiddenStorage(), undefined]) {
      expect(() => openProfiles(storage)).not.toThrow();
      const store = openProfiles(storage);
      expect(store.profiles()).toHaveLength(1);
      expectDefaultProfile(store.activeProfile());
    }
  });
});

describe('#71 AC3: poškozený seznam profilů', () => {
  it('s poškozeným seznamem bez starých klíčů hra běží bez chyby s dočasným výchozím profilem', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt });

      expect(() => openProfiles(storage), corrupt).not.toThrow();
      const store = openProfiles(storage);
      expect(store.profiles(), corrupt).toHaveLength(1);
      expectDefaultProfile(store.activeProfile());
    }
  });

  it('poškozený seznam se nepřepíše a uložená data profilů se nesmažou', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    storage.data.set(PROFILE_LIST_KEY, '{');
    const before = storage.snapshot();

    for (let reload = 0; reload < 3; reload += 1) {
      openProfiles(storage);
    }
    expect(storage.snapshot()).toEqual(before);
  });

  it('s poškozeným seznamem a starými klíči přenos neproběhne a nic uloženého se nezmění', () => {
    const storage = new DeviceStorage({
      [PROFILE_LIST_KEY]: 'nesmysl',
      [LEGACY_SETTINGS_KEY]: '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}',
      [LEGACY_PROGRESS_KEY]: '{"earned":7}',
    });
    const before = storage.snapshot();

    for (let reload = 0; reload < 3; reload += 1) {
      expect(() => openProfiles(storage)).not.toThrow();
    }
    expect(storage.snapshot()).toEqual(before);
  });

  it('po opravě seznamu se načtou původní profily a aktivní profil', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[3] });
    store.selectProfile(second.id);
    const original = openProfiles(storage).profiles();
    const savedList = storage.data.get(PROFILE_LIST_KEY);
    expect(savedList).toBeDefined();

    storage.data.set(PROFILE_LIST_KEY, '{');
    openProfiles(storage);
    storage.data.set(PROFILE_LIST_KEY, savedList ?? '');

    const repaired = openProfiles(storage);
    expect(repaired.profiles()).toEqual(original);
    expect(repaired.activeProfile()).toEqual(second);
  });
});

describe('#71 kontrola: neplatné záznamy profilů a označení hry', () => {
  const validProfile = { id: 'p1', color: PROFILE_COLORS[0] };

  it('přezdívka delší než 12 písmen nebo s řídicím znakem dá poškozený seznam bez chyby', () => {
    for (const nickname of ['ABCDEFGHIJKLM', 'EMA\u0000', 'E\nMA', 'ema', '']) {
      const list = JSON.stringify([validProfile, { id: 'p2', nickname, color: PROFILE_COLORS[1] }]);
      const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: list });
      const before = storage.snapshot();

      expect(() => openProfiles(storage), JSON.stringify(nickname)).not.toThrow();
      const store = openProfiles(storage);
      expect(store.profiles(), JSON.stringify(nickname)).toHaveLength(1);
      expectDefaultProfile(store.activeProfile());
      expect(storage.snapshot()).toEqual(before);
    }
  });

  it('přezdívka z 12 velkých písmen s diakritikou se načte', () => {
    const list = JSON.stringify([{ id: 'p1', nickname: 'ŽŮŘÁČĚWWWWWW', color: PROFILE_COLORS[1] }]);
    const store = openProfiles(new DeviceStorage({ [PROFILE_LIST_KEY]: list }));

    expect(store.activeProfile()).toEqual({
      id: 'p1',
      nickname: 'ŽŮŘÁČĚWWWWWW',
      color: PROFILE_COLORS[1],
    });
  });

  it('hra s neplatným označením dostane úložiště jen v paměti bez chyby', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const before = storage.snapshot();

    for (const gameId of ['', 'Počítání', 'a.b', '../counting', 'counting\n']) {
      const gameStorage = store.gameStorage(gameId);
      expect(() => gameStorage.setItem('klic', 'hodnota'), JSON.stringify(gameId)).not.toThrow();
      expect(gameStorage.getItem('klic'), JSON.stringify(gameId)).toBe('hodnota');
    }
    expect(storage.snapshot()).toEqual(before);
  });

  it('když nejde přečíst data profilu, přenos se nezapíše a příště se dokončí', () => {
    const storage = new DeviceStorage({
      [LEGACY_SETTINGS_KEY]: '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}',
      [LEGACY_PROGRESS_KEY]: '{"earned":7}',
    });
    const readItem = storage.getItem.bind(storage);
    let profileReadsFail = true;
    storage.getItem = (key) => {
      if (profileReadsFail && key.startsWith('agentic-app.profile.')) {
        throw new Error('záznam nejde číst');
      }
      return readItem(key);
    };
    const before = storage.snapshot();

    expect(() => openProfiles(storage)).not.toThrow();
    expect(openProfiles(storage).profiles()).toHaveLength(1);
    expect(storage.snapshot()).toEqual(before);

    profileReadsFail = false;
    const store = openProfiles(storage);
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(true);
    expect(store.gameStorage('counting').getItem(LEGACY_PROGRESS_KEY)).toBe('{"earned":7}');
    expect(storage.data.get(LEGACY_PROGRESS_KEY)).toBe('{"earned":7}');
  });
});
