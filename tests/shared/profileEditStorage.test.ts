import { describe, expect, it } from 'vitest';

import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';
import {
  ACTIVE_PROFILE_KEY,
  PROFILE_LIST_KEY,
  openProfiles,
} from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import {
  CORRUPT_PROFILE_LISTS,
  DeviceStorage,
  LEGACY_PROGRESS_KEY,
  LEGACY_SETTINGS_KEY,
  forbiddenStorage,
  profileDataKeys,
  profileDataPrefix,
} from './profileFixtures';

/**
 * Testy k #73 (úprava a smazání profilu) v úložišti profilů: AC1 (uložení
 * úpravy, hvězdičky a nastavení zůstanou), AC2 (smazání se všemi daty,
 * ostatní profily beze změny, nový aktivní profil), AC3 (smazání se
 * nepovede napůl, úklid zbytků, poškozený seznam, staré klíče)
 * a AC4 (úložiště nejde). Obrazovky profilů testuje
 * `tests/menu/editProfile.test.ts`.
 *
 * Jedno volání `openProfiles(storage)` je jedno načtení stránky.
 *
 * Navržené rozhraní (`src/shared/storage/profileStorage.ts`):
 * - `ProfileStore.updateProfile(id, { nickname?, color })`: nová přezdívka
 *   (bez `nickname` profil bez přezdívky) a barva; vnitřní označení a data
 *   her se nezmění; neznámé označení nic nezmění. Co se nepodaří uložit,
 *   platí do zavření stránky.
 * - `ProfileStore.deleteProfile(id): boolean`: `true`, když je profil
 *   smazaný (nový seznam je uložený). Poslední profil, neznámé označení,
 *   dočasný profil (poškozený nebo nečitelný seznam) a nepovedené uložení
 *   seznamu vrátí `false` a nic nezmění. Po smazání je aktivní první
 *   zbývající profil a smažou se klíče `agentic-app.profile.<id>.…`.
 * - Úklid po nepovedeném mazání: data profilů, které v uloženém seznamu
 *   nejsou, se smažou. Úložiště proto umí navíc `removeItem(key)`,
 *   `key(index)` a `length` jako `localStorage` (typ např.
 *   `KeyValueStorage & { removeItem; key; length }`, aby ostatní podvrhy
 *   `KeyValueStorage` ve hrách zůstaly beze změny).
 *
 * #75 nahrazuje úklid při načtení stránky: `openProfiles` už nic nemaže
 * (#75 AC5) a zbytky se uklidí až po úspěšném smazání jiného profilu
 * (#75 AC6). Testy úklidu níž jsou tomu přizpůsobené, dva panely testuje
 * `tests/shared/profileTwoPanels.test.ts`.
 *
 * Seznam `[]` by při dalším spuštění znovu přenesl stará data (#71), proto
 * se poslední profil smazat nedá (#73 otázka 2) a seznam nikdy nezůstane
 * prázdný.
 */

const GAME = 'counting';
const STARS_KEY = 'agentic-app.progress';
const SETTINGS_KEY = 'agentic-app.settings';
const OTHER_PAGE_KEY = 'agentic-app.language';

const TODAY_SETTINGS = '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}';
const TODAY_PROGRESS = '{"earned":7}';

/** Uloží hvězdičky a nastavení hry profilu `profile`, aktivní profil vrátí zpět. */
function saveGameData(store: ProfileStore, profile: Profile, stars: string): void {
  const active = store.activeProfile().id;
  store.selectProfile(profile.id);
  store.gameStorage(GAME).setItem(STARS_KEY, stars);
  store.gameStorage(GAME).setItem(SETTINGS_KEY, `{"for":"${profile.id}"}`);
  store.gameStorage('other-game').setItem('level', stars);
  store.selectProfile(active);
}

/** Hvězdičky profilu `profileId` po dalším načtení stránky. */
function starsAfterReload(storage: DeviceStorage, profileId: string): string | null {
  const store = openProfiles(storage);
  store.selectProfile(profileId);
  return store.gameStorage(GAME).getItem(STARS_KEY);
}

interface ThreeProfiles {
  readonly storage: DeviceStorage;
  readonly store: ProfileStore;
  readonly first: Profile;
  readonly ema: Profile;
  readonly tom: Profile;
}

/** Zařízení s výchozím profilem, EMA a TOM; každý má hvězdičky a nastavení. */
function deviceWithThreeProfiles(initial: Record<string, string> = {}): ThreeProfiles {
  const storage = new DeviceStorage(initial);
  const store = openProfiles(storage);
  const first = store.activeProfile();
  const ema = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
  const tom = store.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[2] });
  saveGameData(store, first, '{"earned":1}');
  saveGameData(store, ema, '{"earned":2}');
  saveGameData(store, tom, '{"earned":3}');
  return { storage, store, first, ema, tom };
}

/** Záznamy úložiště kromě dat profilu `profileId`, seznamu a aktivního profilu. */
function everythingExcept(storage: DeviceStorage, profileId: string): Record<string, string> {
  const prefix = profileDataPrefix(profileId);
  return Object.fromEntries(
    [...storage.data.entries()].filter(
      ([key]) => !key.startsWith(prefix) && key !== PROFILE_LIST_KEY && key !== ACTIVE_PROFILE_KEY,
    ),
  );
}

describe('#73 AC1: úprava profilu se uloží a hvězdičky zůstanou', () => {
  it('nová přezdívka a barva platí i po dalším načtení stránky', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();

    store.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    const reloaded = openProfiles(storage).profiles();
    expect(reloaded[1]).toEqual({ id: ema.id, nickname: 'EMIL', color: PROFILE_COLORS[5] });
    expect(store.profiles()[1]).toEqual(reloaded[1]);
  });

  it('po úpravě má profil stejné hvězdičky a nastavení všech her', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();
    const dataBefore = profileDataKeys(storage, ema.id).map((key) => storage.data.get(key));

    store.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    expect(profileDataKeys(storage, ema.id).map((key) => storage.data.get(key))).toEqual(
      dataBefore,
    );
    expect(starsAfterReload(storage, ema.id)).toBe('{"earned":2}');
  });

  it('úprava nezmění ostatní profily, jejich pořadí ani aktivní profil', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();
    store.selectProfile(tom.id);

    store.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    const reloaded = openProfiles(storage);
    expect(reloaded.profiles().map((profile) => profile.id)).toEqual([first.id, ema.id, tom.id]);
    expect(reloaded.profiles()[0]).toEqual(first);
    expect(reloaded.profiles()[2]).toEqual(tom);
    expect(reloaded.activeProfile().id).toBe(tom.id);
  });

  it('úprava aktivního profilu se hned ukáže jako aktivní profil', () => {
    const { store, first } = deviceWithThreeProfiles();

    store.updateProfile(first.id, { nickname: 'ŽOFKA', color: PROFILE_COLORS[7] });

    expect(store.activeProfile()).toEqual({
      id: first.id,
      nickname: 'ŽOFKA',
      color: PROFILE_COLORS[7],
    });
  });

  it('profil bez přezdívky z přenosu dat jde uložit dál bez přezdívky, jen s novou barvou', () => {
    const { storage, store, first } = deviceWithThreeProfiles();

    store.updateProfile(first.id, { color: PROFILE_COLORS[3] });

    expect(openProfiles(storage).profiles()[0]).toEqual({
      id: first.id,
      color: PROFILE_COLORS[3],
    });
  });

  it('úprava neznámého profilu nic nezmění a dítě nevidí chybu', () => {
    const { storage, store } = deviceWithThreeProfiles();
    const before = storage.snapshot();

    expect(() =>
      store.updateProfile('neexistuje', { nickname: 'EMIL', color: PROFILE_COLORS[5] }),
    ).not.toThrow();

    expect(storage.snapshot()).toEqual(before);
  });
});

describe('#73 AC2: smazání profilu se všemi daty', () => {
  it('po smazání profil zmizí ze seznamu i po dalším načtení stránky', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();

    expect(store.deleteProfile(ema.id)).toBe(true);

    expect(store.profiles().map((profile) => profile.id)).toEqual([first.id, tom.id]);
    expect(
      openProfiles(storage)
        .profiles()
        .map((profile) => profile.id),
    ).toEqual([first.id, tom.id]);
  });

  it('se smazaným profilem zmizí jeho hvězdičky a nastavení všech her', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();
    expect(profileDataKeys(storage, ema.id).length).toBeGreaterThan(0);

    store.deleteProfile(ema.id);

    expect(profileDataKeys(storage, ema.id)).toEqual([]);
  });

  it('ostatní dva profily a jejich data zůstanou beze změny (tři profily)', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();
    const othersBefore = everythingExcept(storage, ema.id);

    store.deleteProfile(ema.id);

    expect(everythingExcept(storage, ema.id)).toEqual(othersBefore);
    const reloaded = openProfiles(storage).profiles();
    expect(reloaded).toEqual([first, tom]);
    expect(starsAfterReload(storage, first.id)).toBe('{"earned":1}');
    expect(starsAfterReload(storage, tom.id)).toBe('{"earned":3}');
  });

  it('profil se stejnou předponou označení se nesmaže s ním', () => {
    // Data profilu „p1“ nesmějí zmizet se smazáním profilu „p“.
    const storage = new DeviceStorage({
      [PROFILE_LIST_KEY]: JSON.stringify([
        { id: 'p', nickname: 'EMA', color: PROFILE_COLORS[1] },
        { id: 'p1', nickname: 'TOM', color: PROFILE_COLORS[2] },
      ]),
      'agentic-app.profile.p.counting.agentic-app.progress': '{"earned":2}',
      'agentic-app.profile.p1.counting.agentic-app.progress': '{"earned":3}',
    });
    const store = openProfiles(storage);

    store.deleteProfile('p');

    expect(storage.data.get('agentic-app.profile.p1.counting.agentic-app.progress')).toBe(
      '{"earned":3}',
    );
    expect(profileDataKeys(storage, 'p')).toEqual([]);
  });

  it('po smazání neaktivního profilu je aktivní první zbývající profil', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();
    store.selectProfile(tom.id);

    store.deleteProfile(ema.id);

    expect(store.activeProfile().id).toBe(first.id);
    expect(openProfiles(storage).activeProfile().id).toBe(first.id);
  });

  it('po smazání aktivního profilu je aktivní první zbývající profil', () => {
    const { storage, store, first, ema } = deviceWithThreeProfiles();
    store.selectProfile(first.id);

    store.deleteProfile(first.id);

    expect(store.activeProfile().id).toBe(ema.id);
    expect(openProfiles(storage).activeProfile().id).toBe(ema.id);
  });

  it('po smazání ukládá hra hvězdičky novému aktivnímu profilu, ne smazanému', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();
    store.selectProfile(ema.id);
    store.deleteProfile(ema.id);

    store.gameStorage(GAME).setItem(STARS_KEY, '{"earned":9}');

    expect(profileDataKeys(storage, ema.id)).toEqual([]);
    expect(starsAfterReload(storage, store.activeProfile().id)).toBe('{"earned":9}');
  });

  it('poslední profil nejde smazat a seznam nikdy nezůstane prázdný', () => {
    const storage = new DeviceStorage({ [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS });
    const store = openProfiles(storage);
    const only = store.activeProfile();
    const before = storage.snapshot();

    expect(store.deleteProfile(only.id)).toBe(false);

    expect(store.profiles()).toEqual([only]);
    expect(storage.snapshot()).toEqual(before);
    expect(storage.data.get(PROFILE_LIST_KEY)).not.toBe('[]');
  });

  it('po smazání všech profilů kromě jednoho nejde smazat ani ten zbývající', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();

    expect(store.deleteProfile(first.id)).toBe(true);
    expect(store.deleteProfile(ema.id)).toBe(true);
    expect(store.deleteProfile(tom.id)).toBe(false);

    expect(openProfiles(storage).profiles()).toEqual([tom]);
  });

  it('smazání neznámého profilu nic nezmění a dítě nevidí chybu', () => {
    const { storage, store } = deviceWithThreeProfiles();
    const before = storage.snapshot();

    expect(() => store.deleteProfile('neexistuje')).not.toThrow();
    expect(store.deleteProfile('neexistuje')).toBe(false);

    expect(storage.snapshot()).toEqual(before);
  });

  it('smazání téhož profilu podruhé nic dalšího nesmaže', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();
    store.deleteProfile(ema.id);
    const afterFirst = storage.snapshot();

    expect(store.deleteProfile(ema.id)).toBe(false);

    expect(storage.snapshot()).toEqual(afterFirst);
    expect(store.profiles()).toHaveLength(2);
  });
});

describe('#73 AC3: smazání se nepovede napůl', () => {
  it('když se nový seznam nepodaří uložit, profil ani jeho data nezmizí a dítě nevidí chybu', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();
    const before = storage.snapshot();
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;

    expect(() => store.deleteProfile(ema.id)).not.toThrow();

    expect(store.profiles().map((profile) => profile.id)).toEqual([first.id, ema.id, tom.id]);
    expect(storage.snapshot()).toEqual(before);
    storage.failWrite = () => false;
    expect(openProfiles(storage).profiles()).toHaveLength(3);
    expect(starsAfterReload(storage, ema.id)).toBe('{"earned":2}');
  });

  it('když se nový seznam nepodaří uložit, smazání vrátí, že se nepovedlo', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;

    expect(store.deleteProfile(ema.id)).toBe(false);
  });

  it('když se data her nepodaří smazat, profil je i tak smazaný a dítě nevidí chybu', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles();
    storage.failRemove = () => true;

    expect(() => store.deleteProfile(ema.id)).not.toThrow();

    expect(store.profiles().map((profile) => profile.id)).toEqual([first.id, tom.id]);
    expect(
      openProfiles(storage)
        .profiles()
        .map((profile) => profile.id),
    ).toEqual([first.id, tom.id]);
  });

  it('data, která se nepodařilo smazat, při dalším spuštění zůstanou a smažou se po smazání jiného profilu', () => {
    // #75 AC5 a AC6: načtení stránky nic nemaže, úklid přijde s dalším smazáním.
    const { storage, store, ema, tom } = deviceWithThreeProfiles();
    storage.failRemove = () => true;
    store.deleteProfile(ema.id);
    expect(profileDataKeys(storage, ema.id).length).toBeGreaterThan(0);

    storage.failRemove = () => false;
    const reloaded = openProfiles(storage);
    expect(profileDataKeys(storage, ema.id).length).toBeGreaterThan(0);

    expect(reloaded.deleteProfile(tom.id)).toBe(true);
    expect(profileDataKeys(storage, ema.id)).toEqual([]);
  });

  it('úklid po smazání jiného profilu nesáhne na data zbývajících profilů', () => {
    const { storage, store, first, ema, tom } = deviceWithThreeProfiles({
      [OTHER_PAGE_KEY]: 'cs',
    });
    storage.failRemove = () => true;
    store.deleteProfile(ema.id);
    const firstBefore = profileDataKeys(storage, first.id).map((key) => storage.data.get(key));

    storage.failRemove = () => false;
    openProfiles(storage).deleteProfile(tom.id);

    expect(profileDataKeys(storage, first.id).map((key) => storage.data.get(key))).toEqual(
      firstBefore,
    );
    expect(openProfiles(storage).profiles()).toEqual([first]);
    expect(storage.data.get(OTHER_PAGE_KEY)).toBe('cs');
  });

  it('úklid, který se zase nepovede, nevyhodí chybu a zkusí to při dalším smazání znovu', () => {
    const { storage, store, ema, tom } = deviceWithThreeProfiles();
    storage.failRemove = () => true;
    store.deleteProfile(ema.id);
    const extra = store.createProfile({ nickname: 'CYRIL', color: PROFILE_COLORS[4] });

    expect(() => openProfiles(storage).deleteProfile(tom.id)).not.toThrow();
    expect(profileDataKeys(storage, ema.id).length).toBeGreaterThan(0);
    storage.failRemove = () => false;
    openProfiles(storage).deleteProfile(extra.id);

    expect(profileDataKeys(storage, ema.id)).toEqual([]);
  });

  it('úklid nesmaže jiné záznamy stránky (jazyk, seznam, aktivní profil)', () => {
    const { storage, ema, tom } = deviceWithThreeProfiles({ [OTHER_PAGE_KEY]: 'cs' });
    storage.failRemove = () => true;
    openProfiles(storage).deleteProfile(ema.id);
    storage.failRemove = () => false;

    openProfiles(storage).deleteProfile(tom.id);

    expect(storage.data.get(OTHER_PAGE_KEY)).toBe('cs');
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(true);
    expect(storage.data.has(ACTIVE_PROFILE_KEY)).toBe(true);
  });
});

describe('#73 AC3: poškozený seznam profilů', () => {
  it('s poškozeným seznamem úklid neproběhne a žádná data se nezmění', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const { storage } = deviceWithThreeProfiles();
      storage.data.set(PROFILE_LIST_KEY, corrupt);
      const before = storage.snapshot();

      for (let reload = 0; reload < 3; reload += 1) {
        expect(() => openProfiles(storage), corrupt).not.toThrow();
      }

      expect(storage.snapshot(), corrupt).toEqual(before);
    }
  });

  it('s poškozeným seznamem nejde nic smazat a seznam se nepřepíše', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt });
      const store = openProfiles(storage);
      const added = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
      const profilesBefore = store.profiles();
      const before = storage.snapshot();

      for (const profile of profilesBefore) {
        expect(() => store.deleteProfile(profile.id), corrupt).not.toThrow();
        expect(store.deleteProfile(profile.id), corrupt).toBe(false);
      }

      expect(store.profiles(), corrupt).toEqual(profilesBefore);
      expect(
        store.profiles().map((profile) => profile.id),
        corrupt,
      ).toContain(added.id);
      expect(storage.snapshot(), corrupt).toEqual(before);
    }
  });

  it('s poškozeným seznamem platí úprava jen do zavření stránky a seznam se nepřepíše', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt });
      const store = openProfiles(storage);
      const only = store.activeProfile();

      expect(
        () => store.updateProfile(only.id, { nickname: 'EMA', color: PROFILE_COLORS[2] }),
        corrupt,
      ).not.toThrow();

      expect(store.activeProfile(), corrupt).toMatchObject({
        nickname: 'EMA',
        color: PROFILE_COLORS[2],
      });
      expect(storage.data.get(PROFILE_LIST_KEY), corrupt).toBe(corrupt);
    }
  });
});

describe('#73 AC3: staré klíče z doby před profily se nikdy nezmění', () => {
  function deviceWithLegacyData(): ThreeProfiles {
    return deviceWithThreeProfiles({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
  }

  it('po smazání profilu, do kterého se přenesla dnešní data, zůstanou staré klíče', () => {
    const { storage, store, first } = deviceWithLegacyData();

    store.deleteProfile(first.id);

    expect(storage.data.get(LEGACY_SETTINGS_KEY)).toBe(TODAY_SETTINGS);
    expect(storage.data.get(LEGACY_PROGRESS_KEY)).toBe(TODAY_PROGRESS);
  });

  it('po úklidu při dalším smazání zůstanou staré klíče', () => {
    const { storage, store, first, tom } = deviceWithLegacyData();
    storage.failRemove = () => true;
    store.deleteProfile(first.id);
    storage.failRemove = () => false;

    openProfiles(storage).deleteProfile(tom.id);

    expect(storage.data.get(LEGACY_SETTINGS_KEY)).toBe(TODAY_SETTINGS);
    expect(storage.data.get(LEGACY_PROGRESS_KEY)).toBe(TODAY_PROGRESS);
  });

  it('po smazání výchozího profilu se dnešní data nepřenesou znovu a nevznikne nový profil', () => {
    const { storage, store, first, ema, tom } = deviceWithLegacyData();

    store.deleteProfile(first.id);

    for (let reload = 0; reload < 3; reload += 1) {
      const reloaded = openProfiles(storage);
      expect(reloaded.profiles().map((profile) => profile.id)).toEqual([ema.id, tom.id]);
    }
    expect(profileDataKeys(storage, first.id)).toEqual([]);
  });

  it('staré klíče úprava profilu nezmění', () => {
    const { storage, store, first } = deviceWithLegacyData();

    store.updateProfile(first.id, { nickname: 'EMA', color: PROFILE_COLORS[4] });

    expect(storage.data.get(LEGACY_SETTINGS_KEY)).toBe(TODAY_SETTINGS);
    expect(storage.data.get(LEGACY_PROGRESS_KEY)).toBe(TODAY_PROGRESS);
  });
});

describe('#73 AC4: když úložiště nejde', () => {
  it('když úložiště nejde zapsat, upravený profil platí do zavření stránky a dítě nevidí chybu', () => {
    const { storage, store, ema } = deviceWithThreeProfiles();
    storage.failWrite = () => true;

    expect(() =>
      store.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] }),
    ).not.toThrow();

    expect(store.profiles()[1]).toEqual({ id: ema.id, nickname: 'EMIL', color: PROFILE_COLORS[5] });
    storage.failWrite = () => false;
    expect(openProfiles(storage).profiles()[1]).toEqual(ema);
  });

  it('se zakázaným úložištěm jde profil upravit bez chyby a smazání nic nerozbije', () => {
    for (const storage of [forbiddenStorage(), undefined]) {
      const store = openProfiles(storage);
      const only = store.activeProfile();
      const added = store.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[1] });

      expect(() =>
        store.updateProfile(only.id, { nickname: 'EMA', color: PROFILE_COLORS[2] }),
      ).not.toThrow();
      expect(() => store.deleteProfile(added.id)).not.toThrow();

      expect(store.activeProfile()).toMatchObject({ nickname: 'EMA', color: PROFILE_COLORS[2] });
      expect(store.profiles().length).toBeGreaterThanOrEqual(1);
    }
  });
});
