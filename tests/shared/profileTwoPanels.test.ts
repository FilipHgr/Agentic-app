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
  profileDataKeys,
  profileDataPrefix,
} from './profileFixtures';

/**
 * Testy k #75: profil založený v jiném panelu se neztratí ani
 * s hvězdičkami. Dva panely Safari jsou dvě volání `openProfiles` nad
 * jedním úložištěm zařízení (oba otevřené dřív, než v nich rodič něco
 * změní). Další `openProfiles(storage)` je nové načtení stránky.
 *
 * AC3 se hrou (hvězdičky z Počítání) testuje
 * `tests/games/counting/profileTwoPanels.test.ts`, „+“ nad limitem
 * `tests/menu/profileTwoPanels.test.ts`. Úklid z #73 při načtení stránky
 * tím končí (AC5); upravené testy #73 jsou
 * v `tests/shared/profileEditStorage.test.ts`.
 *
 * Rozhraní `ProfileStore` se nemění. Mění se jen chování: každá změna
 * profilů (založení, úprava, smazání) vychází z právě uloženého seznamu,
 * ne ze seznamu, který panel načetl při otevření.
 */

const GAME = 'counting';
const STARS_KEY = 'agentic-app.progress';
const SETTINGS_KEY = 'agentic-app.settings';
const OTHER_PAGE_KEY = 'agentic-app.language';

/** Uloží hvězdičky a nastavení hry profilu `profile`, aktivní profil vrátí zpět. */
function saveGameData(store: ProfileStore, profile: Profile, stars: string): void {
  const active = store.activeProfile().id;
  store.selectProfile(profile.id);
  store.gameStorage(GAME).setItem(STARS_KEY, stars);
  store.gameStorage(GAME).setItem(SETTINGS_KEY, `{"for":"${profile.id}"}`);
  store.selectProfile(active);
}

/** Hvězdičky a nastavení profilu `profileId` v otevřeném panelu. */
function gameDataOf(store: ProfileStore, profileId: string): (string | null)[] {
  store.selectProfile(profileId);
  const game = store.gameStorage(GAME);
  return [game.getItem(STARS_KEY), game.getItem(SETTINGS_KEY)];
}

/** Označení profilů po novém načtení stránky. */
function idsAfterReload(storage: DeviceStorage): string[] {
  return ids(openProfiles(storage).profiles());
}

function ids(profiles: readonly Profile[]): string[] {
  return profiles.map((profile) => profile.id);
}

interface TwoPanels {
  readonly storage: DeviceStorage;
  /** Panel, ve kterém rodič změní profily jako první. */
  readonly panel1: ProfileStore;
  /** Panel otevřený dřív, než se v panelu 1 něco změnilo. */
  readonly panel2: ProfileStore;
  readonly first: Profile;
  readonly ema: Profile;
  readonly tom: Profile;
}

/**
 * Zařízení s výchozím profilem, EMA a TOM (každý s hvězdičkami
 * a nastavením) a dva panely otevřené nad ním.
 */
function twoPanels(initial: Record<string, string> = {}): TwoPanels {
  const storage = new DeviceStorage(initial);
  const setup = openProfiles(storage);
  const first = setup.activeProfile();
  const ema = setup.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
  const tom = setup.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[2] });
  saveGameData(setup, first, '{"earned":1}');
  saveGameData(setup, ema, '{"earned":2}');
  saveGameData(setup, tom, '{"earned":3}');
  return { storage, panel1: openProfiles(storage), panel2: openProfiles(storage), first, ema, tom };
}

describe('#75 AC1: profily založené ve dvou panelech zůstanou oba', () => {
  it('po novém načtení jsou původní profily, A a B v pořadí založení', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    const b = panel2.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    const reloaded = openProfiles(storage).profiles();
    expect(ids(reloaded)).toEqual([first.id, ema.id, tom.id, a.id, b.id]);
    expect(reloaded[3]).toEqual(a);
    expect(reloaded[4]).toEqual(b);
  });

  it('A a B se stejnou přezdívkou zůstanou jako dva profily', () => {
    const { storage, panel1, panel2 } = twoPanels();

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    const b = panel2.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[4] });

    const reloaded = openProfiles(storage).profiles();
    expect(a.id).not.toBe(b.id);
    expect(reloaded.filter((profile) => profile.nickname === 'ANA')).toEqual([a, b]);
  });

  it('hvězdičky původních profilů zůstanou po založení ve dvou panelech', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();

    panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    panel2.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    const reloaded = openProfiles(storage);
    expect(gameDataOf(reloaded, first.id)[0]).toBe('{"earned":1}');
    expect(gameDataOf(reloaded, ema.id)[0]).toBe('{"earned":2}');
    expect(gameDataOf(reloaded, tom.id)[0]).toBe('{"earned":3}');
  });

  it('po vlastní změně vidí panel 2 i profil založený v panelu 1', () => {
    const { panel1, panel2, first, ema, tom } = twoPanels();

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    const b = panel2.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    expect(ids(panel2.profiles())).toEqual([first.id, ema.id, tom.id, a.id, b.id]);
  });
});

describe('#75 AC2: úprava v druhém panelu nesmaže profil z prvního', () => {
  it('po novém načtení zůstane A i nová přezdívka a barva jiného profilu', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    panel2.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    const reloaded = openProfiles(storage).profiles();
    expect(ids(reloaded)).toEqual([first.id, ema.id, tom.id, a.id]);
    expect(reloaded[1]).toEqual({ id: ema.id, nickname: 'EMIL', color: PROFILE_COLORS[5] });
    expect(reloaded[3]).toEqual(a);
  });

  it('úprava jen barvy v panelu 2 zachová A z panelu 1', () => {
    const { storage, panel1, panel2, tom } = twoPanels();

    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    panel2.updateProfile(tom.id, { nickname: 'TOM', color: PROFILE_COLORS[6] });

    const reloaded = openProfiles(storage).profiles();
    expect(reloaded).toContainEqual(a);
    expect(reloaded).toContainEqual({ id: tom.id, nickname: 'TOM', color: PROFILE_COLORS[6] });
  });

  it('když oba panely upraví stejný profil, platí poslední úprava', () => {
    const { storage, panel1, panel2, ema } = twoPanels();

    panel1.updateProfile(ema.id, { nickname: 'EMKA', color: PROFILE_COLORS[3] });
    panel2.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    const reloaded = openProfiles(storage).profiles();
    expect(reloaded.filter((profile) => profile.id === ema.id)).toEqual([
      { id: ema.id, nickname: 'EMIL', color: PROFILE_COLORS[5] },
    ]);
  });

  it('úprava v panelu 1 přežije, když panel 2 potom upraví jiný profil', () => {
    const { storage, panel1, panel2, ema, tom } = twoPanels();

    panel1.updateProfile(ema.id, { nickname: 'EMKA', color: PROFILE_COLORS[3] });
    panel2.updateProfile(tom.id, { nickname: 'TOMÁŠ', color: PROFILE_COLORS[4] });

    const reloaded = openProfiles(storage).profiles();
    expect(reloaded).toContainEqual({ id: ema.id, nickname: 'EMKA', color: PROFILE_COLORS[3] });
    expect(reloaded).toContainEqual({ id: tom.id, nickname: 'TOMÁŠ', color: PROFILE_COLORS[4] });
  });

  it('úprava v panelu 2 nezmění hvězdičky ani nastavení profilu A', () => {
    const { storage, panel1, panel2, ema } = twoPanels();
    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    saveGameData(panel1, a, '{"earned":4}');

    panel2.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    expect(gameDataOf(openProfiles(storage), a.id)).toEqual(['{"earned":4}', `{"for":"${a.id}"}`]);
  });
});

describe('#75 AC3: smazání v druhém panelu nesmaže profil z prvního', () => {
  it('po novém načtení zůstane A s hvězdičkami a nastavením a smazaný profil zmizí', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();
    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    saveGameData(panel1, a, '{"earned":5}');

    expect(panel2.deleteProfile(ema.id)).toBe(true);

    const reloaded = openProfiles(storage);
    expect(ids(reloaded.profiles())).toEqual([first.id, tom.id, a.id]);
    expect(gameDataOf(reloaded, a.id)).toEqual(['{"earned":5}', `{"for":"${a.id}"}`]);
    expect(profileDataKeys(storage, ema.id)).toEqual([]);
  });

  it('ostatní profily po smazání v panelu 2 hvězdičky neztratí', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();
    panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });

    panel2.deleteProfile(ema.id);

    const reloaded = openProfiles(storage);
    expect(gameDataOf(reloaded, first.id)[0]).toBe('{"earned":1}');
    expect(gameDataOf(reloaded, tom.id)[0]).toBe('{"earned":3}');
  });

  it('úprava profilu A v panelu 1 zůstane po smazání jiného profilu v panelu 2', () => {
    const { storage, panel1, panel2, tom } = twoPanels();
    const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    panel1.updateProfile(a.id, { nickname: 'ANIČKA', color: PROFILE_COLORS[6] });

    panel2.deleteProfile(tom.id);

    expect(openProfiles(storage).profiles()).toContainEqual({
      id: a.id,
      nickname: 'ANIČKA',
      color: PROFILE_COLORS[6],
    });
  });
});

describe('#75 AC4: profil smazaný v jednom panelu se v druhém neobnoví', () => {
  it('po smazání v panelu 1 a založení v panelu 2 smazaný profil není a nový zůstane', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();

    expect(panel1.deleteProfile(ema.id)).toBe(true);
    const b = panel2.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    expect(idsAfterReload(storage)).toEqual([first.id, tom.id, b.id]);
    expect(profileDataKeys(storage, ema.id)).toEqual([]);
  });

  it('úprava profilu smazaného v jiném panelu neuloží jeho přezdívku ani barvu', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();

    panel1.deleteProfile(ema.id);
    expect(() =>
      panel2.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] }),
    ).not.toThrow();

    expect(idsAfterReload(storage)).toEqual([first.id, tom.id]);
    for (const value of storage.data.values()) {
      expect(value).not.toContain('EMIL');
    }
    expect(profileDataKeys(storage, ema.id)).toEqual([]);
  });

  it('úprava smazaného profilu nezmění zbývající profily', () => {
    const { storage, panel1, panel2, first, tom } = twoPanels();
    panel1.deleteProfile(tom.id);
    const listAfterDelete = openProfiles(storage).profiles();

    panel2.updateProfile(tom.id, { nickname: 'TOMÁŠ', color: PROFILE_COLORS[6] });

    expect(openProfiles(storage).profiles()).toEqual(listAfterDelete);
    expect(gameDataOf(openProfiles(storage), first.id)[0]).toBe('{"earned":1}');
  });

  it('když oba panely smažou stejný profil, druhé smazání nic dalšího nesmaže a hra nespadne', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels({ [OTHER_PAGE_KEY]: 'cs' });
    panel1.deleteProfile(ema.id);
    const listAfterFirst = storage.data.get(PROFILE_LIST_KEY);
    const firstData = profileDataKeys(storage, first.id).map((key) => storage.data.get(key));
    const tomData = profileDataKeys(storage, tom.id).map((key) => storage.data.get(key));

    expect(() => panel2.deleteProfile(ema.id)).not.toThrow();

    expect(storage.data.get(PROFILE_LIST_KEY)).toBe(listAfterFirst);
    expect(idsAfterReload(storage)).toEqual([first.id, tom.id]);
    expect(profileDataKeys(storage, first.id).map((key) => storage.data.get(key))).toEqual(
      firstData,
    );
    expect(profileDataKeys(storage, tom.id).map((key) => storage.data.get(key))).toEqual(tomData);
    expect(storage.data.get(OTHER_PAGE_KEY)).toBe('cs');
  });
});

describe('#75 AC5: načtení stránky ani spuštění hry nesmaže data profilů', () => {
  it('opakované načtení stránky nezmění nic v úložišti, ani zbytky profilu mimo seznam', () => {
    const { storage, panel1, ema } = twoPanels();
    storage.failRemove = () => true;
    panel1.deleteProfile(ema.id);
    storage.failRemove = () => false;
    const before = storage.snapshot();

    for (let reload = 0; reload < 3; reload += 1) {
      openProfiles(storage);
    }

    expect(storage.snapshot()).toEqual(before);
    expect(profileDataKeys(storage, ema.id).length).toBeGreaterThan(0);
  });

  it('při načtení zůstanou data profilu, který druhý panel právě zakládá', () => {
    // Panel 2 zapsal data hry nového profilu dřív, než se seznam stihl uložit.
    const { storage, first } = twoPanels();
    const newProfileStars = 'agentic-app.profile.pnovy.counting.agentic-app.progress';
    storage.data.set(newProfileStars, '{"earned":6}');

    openProfiles(storage);

    expect(storage.data.get(newProfileStars)).toBe('{"earned":6}');
    expect(gameDataOf(openProfiles(storage), first.id)[0]).toBe('{"earned":1}');
  });

  it('spuštění hry za kterýkoli profil nesmaže data žádného profilu', () => {
    const { storage, panel1, first, ema, tom } = twoPanels();
    storage.failRemove = () => true;
    panel1.deleteProfile(ema.id);
    storage.failRemove = () => false;
    const before = storage.snapshot();

    const page = openProfiles(storage);
    for (const profile of [first, tom]) {
      page.selectProfile(profile.id);
      page.gameStorage(GAME).getItem(STARS_KEY);
      page.gameStorage('other-game').getItem('level');
    }

    for (const [key, value] of Object.entries(before)) {
      if (key !== ACTIVE_PROFILE_KEY) {
        expect(storage.data.get(key), key).toBe(value);
      }
    }
  });
});

describe('#75 AC6: zbytky smazaného profilu se uklidí jen po dalším smazání', () => {
  /** Zařízení, kde po nepovedeném smazání EMY zůstala její data. */
  function deviceWithLeftovers(initial: Record<string, string> = {}): TwoPanels {
    const panels = twoPanels(initial);
    panels.storage.failRemove = () => true;
    panels.panel1.deleteProfile(panels.ema.id);
    panels.storage.failRemove = () => false;
    expect(profileDataKeys(panels.storage, panels.ema.id).length).toBeGreaterThan(0);
    return panels;
  }

  it('po úspěšném smazání jiného profilu zmizí i zbytky dřív smazaného profilu', () => {
    const { storage, ema, tom } = deviceWithLeftovers();

    expect(openProfiles(storage).deleteProfile(tom.id)).toBe(true);

    expect(profileDataKeys(storage, ema.id)).toEqual([]);
    expect(profileDataKeys(storage, tom.id)).toEqual([]);
  });

  it('úklid po smazání nesáhne na data ani seznam zbývajících profilů', () => {
    const { storage, first, tom } = deviceWithLeftovers();
    const firstData = profileDataKeys(storage, first.id).map((key) => storage.data.get(key));

    openProfiles(storage).deleteProfile(tom.id);

    expect(profileDataKeys(storage, first.id).map((key) => storage.data.get(key))).toEqual(
      firstData,
    );
    expect(idsAfterReload(storage)).toEqual([first.id]);
  });

  it('profil založený mezitím v druhém panelu o data nepřijde, když první panel smaže jiný profil', () => {
    const { storage, panel1, panel2, first, tom } = deviceWithLeftovers();
    const a = panel2.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    saveGameData(panel2, a, '{"earned":8}');

    expect(panel1.deleteProfile(tom.id)).toBe(true);

    const reloaded = openProfiles(storage);
    expect(ids(reloaded.profiles())).toEqual([first.id, a.id]);
    expect(gameDataOf(reloaded, a.id)).toEqual(['{"earned":8}', `{"for":"${a.id}"}`]);
  });

  it('smazání, které se nepovede, zbytky neuklidí', () => {
    const { storage, tom } = deviceWithLeftovers();
    const leftovers = storage.snapshot();
    const page = openProfiles(storage);

    storage.failWrite = (key) => key === PROFILE_LIST_KEY;
    expect(page.deleteProfile(tom.id)).toBe(false);
    storage.failWrite = () => false;
    expect(page.deleteProfile('neexistuje')).toBe(false);

    expect(storage.snapshot()).toEqual(leftovers);
  });

  it('úklid, který se nepovede, nevyhodí chybu a zkusí se při dalším smazání znovu', () => {
    const { storage, first, ema, tom } = deviceWithLeftovers();
    const c = openProfiles(storage).createProfile({ nickname: 'CYRIL', color: PROFILE_COLORS[4] });
    const emaId = ema.id;

    storage.failRemove = (key) => key.startsWith(profileDataPrefix(emaId));
    expect(() => openProfiles(storage).deleteProfile(tom.id)).not.toThrow();
    expect(profileDataKeys(storage, emaId).length).toBeGreaterThan(0);

    storage.failRemove = () => false;
    openProfiles(storage).deleteProfile(c.id);

    expect(profileDataKeys(storage, emaId)).toEqual([]);
    expect(idsAfterReload(storage)).toEqual([first.id]);
  });

  it('úklid nesmaže staré klíče z doby před profily ani jiné záznamy stránky', () => {
    const { storage, tom } = deviceWithLeftovers({
      [LEGACY_SETTINGS_KEY]: '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}',
      [LEGACY_PROGRESS_KEY]: '{"earned":7}',
      [OTHER_PAGE_KEY]: 'cs',
    });

    openProfiles(storage).deleteProfile(tom.id);

    expect(storage.data.get(LEGACY_SETTINGS_KEY)).toBe(
      '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}',
    );
    expect(storage.data.get(LEGACY_PROGRESS_KEY)).toBe('{"earned":7}');
    expect(storage.data.get(OTHER_PAGE_KEY)).toBe('cs');
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(true);
  });
});

describe('#75 AC7: okrajové případy', () => {
  it('když oba panely dohromady překročí 6 profilů, zůstanou všechny i s daty', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();
    const fromPanel1 = [
      panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] }),
      panel1.createProfile({ nickname: 'BEA', color: PROFILE_COLORS[4] }),
    ];
    const fromPanel2 = [
      panel2.createProfile({ nickname: 'CYRIL', color: PROFILE_COLORS[5] }),
      panel2.createProfile({ nickname: 'DAN', color: PROFILE_COLORS[6] }),
    ];
    const created = [...fromPanel1, ...fromPanel2];
    created.forEach((profile, index) =>
      saveGameData(index < 2 ? panel1 : panel2, profile, `{"earned":${index + 4}}`),
    );

    const reloaded = openProfiles(storage);
    expect(ids(reloaded.profiles())).toEqual([first.id, ema.id, tom.id, ...ids(created)]);
    created.forEach((profile, index) => {
      expect(gameDataOf(reloaded, profile.id)[0]).toBe(`{"earned":${index + 4}}`);
    });
    expect(gameDataOf(reloaded, ema.id)[0]).toBe('{"earned":2}');
  });

  describe('když uložený seznam mezitím nejde přečíst nebo je poškozený', () => {
    /** Panel otevřený nad platným seznamem, pak se seznam pokazí. */
    function panelWithSpoiledList(spoil: (storage: DeviceStorage) => void): TwoPanels {
      const panels = twoPanels();
      spoil(panels.storage);
      return panels;
    }

    const spoilers: ReadonlyArray<readonly [string, (storage: DeviceStorage) => void]> = [
      ...CORRUPT_PROFILE_LISTS.map(
        (corrupt) =>
          [
            `poškozený seznam ${corrupt}`,
            (storage: DeviceStorage) => storage.data.set(PROFILE_LIST_KEY, corrupt),
          ] as const,
      ),
      [
        'nečitelné úložiště',
        (storage: DeviceStorage) => {
          storage.failReads = true;
        },
      ],
    ];

    it('založený profil platí jen do zavření stránky a seznam se nepřepíše', () => {
      for (const [name, spoil] of spoilers) {
        const { storage, panel1 } = panelWithSpoiledList(spoil);
        const listBefore = storage.data.get(PROFILE_LIST_KEY);

        let created: Profile | undefined;
        expect(() => {
          created = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
        }, name).not.toThrow();

        expect(ids(panel1.profiles()), name).toContain(created?.id);
        expect(storage.data.get(PROFILE_LIST_KEY), name).toBe(listBefore);
      }
    });

    it('upravený profil platí jen do zavření stránky a seznam se nepřepíše', () => {
      for (const [name, spoil] of spoilers) {
        const { storage, panel1, ema } = panelWithSpoiledList(spoil);
        const listBefore = storage.data.get(PROFILE_LIST_KEY);

        expect(
          () => panel1.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] }),
          name,
        ).not.toThrow();

        expect(panel1.profiles(), name).toContainEqual({
          id: ema.id,
          nickname: 'EMIL',
          color: PROFILE_COLORS[5],
        });
        expect(storage.data.get(PROFILE_LIST_KEY), name).toBe(listBefore);
      }
    });

    it('smazání se neprovede: profil zůstane, data her zůstanou a seznam se nepřepíše', () => {
      for (const [name, spoil] of spoilers) {
        const { storage, panel1, first, ema, tom } = panelWithSpoiledList(spoil);
        const before = storage.snapshot();

        let deleted: boolean | undefined;
        expect(() => {
          deleted = panel1.deleteProfile(ema.id);
        }, name).not.toThrow();

        expect(deleted, name).toBe(false);
        expect(ids(panel1.profiles()), name).toEqual([first.id, ema.id, tom.id]);
        expect(storage.snapshot(), name).toEqual(before);
      }
    });
  });

  it('po smazání dat webu starý panel nic nezapíše a změna platí jen do zavření stránky', () => {
    // Otevřená otázka 1: smazání dat byla vůle rodiče, hra pak začne jako na novém zařízení.
    const { storage, panel1, ema, tom } = twoPanels();
    storage.data.clear();

    expect(() => {
      const a = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
      panel1.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });
      panel1.deleteProfile(tom.id);
      expect(ids(panel1.profiles())).toContain(a.id);
    }).not.toThrow();

    expect([...storage.data.keys()].filter((key) => key !== ACTIVE_PROFILE_KEY)).toEqual([]);
    const fresh = openProfiles(storage).profiles();
    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.nickname).toBeUndefined();
  });

  it('profil založený po smazání dat webu se nezapíše ani do seznamu, který vznikne později', () => {
    // Otevřená otázka 1: změny bez seznamu platí jen do zavření stránky.
    const { storage, panel1, ema } = twoPanels();
    storage.data.clear();
    const withoutList = panel1.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
    panel1.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });

    const fresh = openProfiles(storage).profiles();
    const b = panel1.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    const reloaded = openProfiles(storage).profiles();
    expect(ids(reloaded)).toEqual([...ids(fresh), b.id]);
    expect(ids(reloaded)).not.toContain(withoutList.id);
    for (const value of storage.data.values()) {
      expect(value).not.toContain('ANA');
      expect(value).not.toContain('EMIL');
    }
    expect(ids(panel1.profiles())).toContain(withoutList.id);
  });

  it('poslední profil nejde smazat, ani když ostatní mezitím smazal druhý panel', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();
    expect(panel2.deleteProfile(ema.id)).toBe(true);
    expect(panel2.deleteProfile(tom.id)).toBe(true);
    const before = storage.snapshot();

    let deleted: boolean | undefined;
    expect(() => {
      deleted = panel1.deleteProfile(first.id);
    }).not.toThrow();

    expect(deleted).toBe(false);
    expect(storage.snapshot()).toEqual(before);
    expect(idsAfterReload(storage)).toEqual([first.id]);
    expect(gameDataOf(openProfiles(storage), first.id)[0]).toBe('{"earned":1}');
    expect(storage.data.get(PROFILE_LIST_KEY)).not.toBe('[]');
  });
});

describe('#75: neuložené změny panelu se neztratí (#73 AC4)', () => {
  it('při plném úložišti zůstane úprava v panelu i po založení dalšího profilu', () => {
    const { storage, panel1, ema } = twoPanels();
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;

    panel1.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });
    const b = panel1.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    expect(panel1.profiles()).toContainEqual({
      id: ema.id,
      nickname: 'EMIL',
      color: PROFILE_COLORS[5],
    });
    expect(panel1.profiles()).toContainEqual(b);
  });

  it('neuložené změny se uloží s další změnou, až zápis zase půjde', () => {
    const { storage, panel1, panel2, first, ema, tom } = twoPanels();
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;
    panel1.updateProfile(ema.id, { nickname: 'EMIL', color: PROFILE_COLORS[5] });
    const b = panel1.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });
    storage.failWrite = () => false;
    const a = panel2.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });

    const c = panel1.createProfile({ nickname: 'CYRIL', color: PROFILE_COLORS[6] });

    const reloaded = openProfiles(storage).profiles();
    expect(ids(reloaded)).toEqual([first.id, ema.id, tom.id, a.id, b.id, c.id]);
    expect(reloaded[1]).toEqual({ id: ema.id, nickname: 'EMIL', color: PROFILE_COLORS[5] });
  });

  it('profil založený při plném úložišti po smazání jiného profilu zůstane i s hvězdičkami', () => {
    const { storage, panel1, first, ema, tom } = twoPanels();
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;
    const b = panel1.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });
    saveGameData(panel1, b, '{"earned":9}');
    storage.failWrite = () => false;

    expect(panel1.deleteProfile(ema.id)).toBe(true);

    expect(ids(panel1.profiles())).toEqual([first.id, tom.id, b.id]);
    const reloaded = openProfiles(storage);
    expect(ids(reloaded.profiles())).toEqual([first.id, tom.id, b.id]);
    expect(gameDataOf(reloaded, b.id)).toEqual(['{"earned":9}', `{"for":"${b.id}"}`]);
  });

  it('úklid zbytků po smazání nesmaže data profilu, který panel držel jen v paměti', () => {
    const { storage, panel1, ema, tom } = twoPanels();
    storage.failRemove = () => true;
    panel1.deleteProfile(ema.id);
    storage.failRemove = () => false;
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;
    const b = panel1.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });
    saveGameData(panel1, b, '{"earned":9}');
    storage.failWrite = () => false;

    expect(panel1.deleteProfile(tom.id)).toBe(true);

    expect(profileDataKeys(storage, ema.id)).toEqual([]);
    expect(gameDataOf(openProfiles(storage), b.id)).toEqual(['{"earned":9}', `{"for":"${b.id}"}`]);
  });

  it('když panel přijde o aktivní profil smazaný jinde, aktivní bude první profil', () => {
    const { storage, panel1, panel2, first, ema } = twoPanels();
    panel1.selectProfile(ema.id);
    panel2.deleteProfile(ema.id);

    panel1.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });

    expect(panel1.activeProfile().id).toBe(first.id);
    expect(storage.data.get(ACTIVE_PROFILE_KEY)).toBe(first.id);
  });
});
