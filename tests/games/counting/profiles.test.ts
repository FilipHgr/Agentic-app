import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import { answerInputOf } from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { COUNTING_META } from '../../../src/games/counting/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import {
  ACTIVE_PROFILE_KEY,
  PROFILE_LIST_KEY,
  openProfiles,
} from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import {
  CORRUPT_PROFILE_LISTS,
  DeviceStorage,
  LEGACY_PROGRESS_KEY,
  LEGACY_SETTINGS_KEY,
  forbiddenStorage,
} from '../../shared/profileFixtures';

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
 * Testy k #71 AC2, AC3, AC4 a AC6 z pohledu Počítání: dnešní hvězdičky
 * a nastavení se po aktualizaci přenesou do výchozího profilu a hra pak
 * načítá a ukládá jen aktivnímu profilu.
 *
 * Jedno „spuštění“ je `openProfiles(storage)` (načtení stránky) a vstup do
 * Počítání je sezení hry nad úložištěm aktivního profilu
 * `store.gameStorage(COUNTING_META.id)`. Sezení i jeho úložiště
 * (`loadSettingsState`, `loadProgress`) zůstávají, jak jsou, jen dostanou
 * úložiště profilu místo celého úložiště zařízení.
 */

const TODAY_SETTINGS = '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}';
const TODAY_PROGRESS = '{"earned":7}';

/** Zařízení s daty, která tam nechala dnešní verze hry (před profily). */
function todayDevice(saved: Record<string, string> = {}): DeviceStorage {
  return new DeviceStorage(saved);
}

interface ProfileSession extends TestSession {
  readonly page: FakePage;
}

/** Dítě ťukne v menu na Počítání: sezení hry nad úložištěm aktivního profilu. */
function enterCounting(store: ProfileStore, seed?: number): ProfileSession {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  const page = new FakePage();
  let changes = 0;
  const session = createCountingSession({
    storage: store.gameStorage(COUNTING_META.id),
    random: seededRandom(seed),
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

/** Co dítě po vstupu do Počítání vidí: nastavení, hvězdičky a průvodce. */
function whatChildSees(store: ProfileStore): {
  settings: GameSettings;
  answerInput: string;
  stars: number;
  guide: boolean;
} {
  const test = enterCounting(store);
  const seen = {
    settings: test.session.settings(),
    answerInput: answerInputOf(test.session.settings()),
    stars: test.session.starCount(),
    guide: test.session.guideOpen(),
  };
  test.session.leave();
  return seen;
}

const SECOND_CHILD_SETTINGS: GameSettings = {
  maxNumber: 20,
  operations: 'minus',
  answerInput: 'keypad',
};

describe('#71 AC2: po aktualizaci dítě pokračuje se svými hvězdičkami a nastavením', () => {
  it('nastavení a 7 hvězdiček dají rozsah 10, sčítání, číselník a 7 hvězdiček bez průvodce', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });

    const seen = whatChildSees(openProfiles(storage));

    expect(seen.settings.maxNumber).toBe(10);
    expect(seen.settings.operations).toBe('plus');
    expect(seen.answerInput).toBe('keypad');
    expect(seen.stars).toBe(7);
    expect(seen.guide).toBe(false);
  });

  it('data se přenesou do výchozího profilu bez přezdívky a jiný profil nevznikne', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });

    const store = openProfiles(storage);

    expect(store.profiles()).toHaveLength(1);
    expect(store.activeProfile().nickname).toBeUndefined();
    expect(store.activeProfile().color).toBe(PROFILE_COLORS[0]);
  });

  it('jen nastavení bez postupu dá nastavení a 0 hvězdiček', () => {
    const storage = todayDevice({ [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS });

    const seen = whatChildSees(openProfiles(storage));

    expect(seen.settings).toEqual({ maxNumber: 10, operations: 'plus', answerInput: 'keypad' });
    expect(seen.stars).toBe(0);
    expect(seen.guide).toBe(false);
  });

  it('jen postup bez nastavení dá hvězdičky a otevře se průvodce (#48)', () => {
    const storage = todayDevice({ [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS });

    const seen = whatChildSees(openProfiles(storage));

    expect(seen.stars).toBe(7);
    expect(seen.guide).toBe(true);
  });

  it('poškozené nastavení a platný postup dají hvězdičky a otevře se průvodce', () => {
    for (const corrupt of ['{', 'nesmysl', '{"maxNumber":7,"operations":"plus"}']) {
      const storage = todayDevice({
        [LEGACY_SETTINGS_KEY]: corrupt,
        [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
      });

      const seen = whatChildSees(openProfiles(storage));

      expect(seen.stars, corrupt).toBe(7);
      expect(seen.guide, corrupt).toBe(true);
    }
  });

  it('poškozený postup dá začátek bez chyby a nastavení se přenese', () => {
    for (const corrupt of ['{"earned":', 'nesmysl', '{"earned":-3}', '{"earned":"7"}']) {
      const storage = todayDevice({
        [LEGACY_SETTINGS_KEY]: '{"maxNumber":20,"operations":"minus","answerInput":"writing"}',
        [LEGACY_PROGRESS_KEY]: corrupt,
      });

      expect(() => whatChildSees(openProfiles(storage)), corrupt).not.toThrow();
      const seen = whatChildSees(openProfiles(storage));

      expect(seen.stars, corrupt).toBe(0);
      expect(seen.guide, corrupt).toBe(false);
      expect(seen.settings, corrupt).toEqual({
        maxNumber: 20,
        operations: 'minus',
        answerInput: 'writing',
      });
    }
  });

  it('starý postup s postavičkou dá hvězdičky a postavička se ignoruje', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: '{"earned":7,"character":"robik"}',
    });
    const store = openProfiles(storage);

    expect(whatChildSees(store).stars).toBe(7);

    const test = enterCounting(store);
    solveProblems(test, 1);
    test.session.leave();
    expect(whatChildSees(openProfiles(storage)).stars).toBe(8);
  });

  it('na novém zařízení se při prvním spuštění Počítání otevře průvodce a hra začne bez hvězdiček', () => {
    const storage = todayDevice();

    const seen = whatChildSees(openProfiles(storage));

    expect(seen.guide).toBe(true);
    expect(seen.stars).toBe(0);
  });

  it('po průvodci na novém zařízení se příště průvodce neotevře', () => {
    const storage = todayDevice();
    const test = enterCounting(openProfiles(storage));
    test.session.finishGuide(SECOND_CHILD_SETTINGS);
    test.session.leave();

    const seen = whatChildSees(openProfiles(storage));
    expect(seen.guide).toBe(false);
    expect(seen.settings).toEqual(SECOND_CHILD_SETTINGS);
  });

  it('se zakázaným úložištěm hra běží bez chyby s výchozím profilem v paměti', () => {
    for (const storage of [forbiddenStorage(), undefined]) {
      const store = openProfiles(storage);
      expect(store.profiles()).toHaveLength(1);

      const test = enterCounting(store);
      expect(test.session.guideOpen()).toBe(true);
      expect(() => {
        test.session.finishGuide(SECOND_CHILD_SETTINGS);
        solveProblems(test, 2);
        test.session.leave();
      }).not.toThrow();
      expect(test.session.starCount()).toBe(2);
    }
  });

  it('když se nepodaří uložit seznam profilů, dítě hraje s přenesenými daty a příště se přenos dokončí', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    storage.failWrite = (key) => key === PROFILE_LIST_KEY;

    const failed = openProfiles(storage);
    expect(failed.profiles()).toHaveLength(1);
    expect(whatChildSees(failed)).toMatchObject({ stars: 7, guide: false });
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(false);

    storage.failWrite = () => false;
    const retried = openProfiles(storage);
    expect(whatChildSees(retried)).toMatchObject({ stars: 7, guide: false });
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(true);

    // Přenos je hotový: pozdější změna starých klíčů už nic nezmění.
    storage.data.set(LEGACY_PROGRESS_KEY, '{"earned":2}');
    const later = openProfiles(storage);
    expect(later.profiles()).toHaveLength(1);
    expect(whatChildSees(later)).toMatchObject({ stars: 7, guide: false });
  });

  it('když se nepodaří uložit data výchozího profilu, dítě hraje s přenesenými daty a příště se přenos zopakuje', () => {
    const legacy = { [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS, [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS };
    const storage = todayDevice(legacy);
    // Projde jen zápis seznamu profilů a aktivního profilu, data profilu ne.
    storage.failWrite = (key) => key !== PROFILE_LIST_KEY && key !== ACTIVE_PROFILE_KEY;

    const failed = openProfiles(storage);
    expect(whatChildSees(failed)).toMatchObject({ stars: 7, guide: false });
    // Druhý vstup do hry v témže načtení stránky: data jsou dál v paměti.
    expect(whatChildSees(failed)).toMatchObject({ stars: 7, guide: false });
    // Bez uložených dat profilu se přenos nepočítá za hotový.
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(false);

    storage.failWrite = () => false;
    const retried = openProfiles(storage);
    expect(retried.profiles()).toHaveLength(1);
    expect(whatChildSees(retried)).toMatchObject({ stars: 7, guide: false });
    expect(storage.data.has(PROFILE_LIST_KEY)).toBe(true);
  });

  it('druhé spuštění po hotovém přenosu a změně starých klíčů nic nezmění', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    const migrated = openProfiles(storage);
    const profile = migrated.activeProfile();

    storage.data.set(LEGACY_SETTINGS_KEY, '{"maxNumber":5,"operations":"mixed"}');
    storage.data.set(LEGACY_PROGRESS_KEY, '{"earned":2}');

    const again = openProfiles(storage);
    expect(again.profiles()).toEqual([profile]);
    expect(whatChildSees(again)).toMatchObject({
      settings: { maxNumber: 10, operations: 'plus', answerInput: 'keypad' },
      stars: 7,
      guide: false,
    });
  });

  it('hvězdičky a nastavení získané po přenosu platí i po dalším spuštění, staré klíče je nepřepíšou', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    const test = enterCounting(openProfiles(storage));
    solveProblems(test, 2);
    test.page.holdGear();
    test.session.confirmSettings({ maxNumber: 5, operations: 'plus', answerInput: 'keypad' });
    test.session.leave();

    const seen = whatChildSees(openProfiles(storage));
    expect(seen.stars).toBe(9);
    expect(seen.settings.maxNumber).toBe(5);
  });

  it('staré klíče se nesmažou ani nepřepíšou, ani když dítě hraje a rodič změní nastavení', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });

    const test = enterCounting(openProfiles(storage));
    solveProblems(test, 4);
    test.page.holdGear();
    test.session.confirmSettings({ maxNumber: 20, operations: 'mixed', answerInput: 'writing' });
    test.session.leave();
    openProfiles(storage);

    expect(storage.data.get(LEGACY_SETTINGS_KEY)).toBe(TODAY_SETTINGS);
    expect(storage.data.get(LEGACY_PROGRESS_KEY)).toBe(TODAY_PROGRESS);
  });
});

describe('#71 AC3: s poškozeným seznamem profilů hra běží bez chyby', () => {
  it('poškozený seznam bez starých klíčů dá výchozí začátek s průvodcem a nic se neuloží', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const storage = todayDevice({ [PROFILE_LIST_KEY]: corrupt });
      const before = storage.snapshot();

      const test = enterCounting(openProfiles(storage));
      expect(test.session.guideOpen(), corrupt).toBe(true);
      expect(test.session.starCount(), corrupt).toBe(0);
      test.session.finishGuide(SECOND_CHILD_SETTINGS);
      solveProblems(test, 3);
      test.session.leave();

      expect(storage.snapshot(), corrupt).toEqual(before);
    }
  });

  it('s poškozeným seznamem dítě uvidí nastavení a hvězdičky ze starých klíčů a ty se nezmění', () => {
    const storage = todayDevice({
      [PROFILE_LIST_KEY]: '{',
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    const before = storage.snapshot();
    const store = openProfiles(storage);

    expect(whatChildSees(store)).toMatchObject({
      settings: { maxNumber: 10, operations: 'plus', answerInput: 'keypad' },
      stars: 7,
      guide: false,
    });

    const test = enterCounting(store);
    solveProblems(test, 2);
    test.page.holdGear();
    test.session.confirmSettings({ maxNumber: 5, operations: 'minus', answerInput: 'keypad' });
    test.session.leave();

    expect(storage.snapshot()).toEqual(before);
  });

  it('hvězdičky získané s poškozeným seznamem platí do zavření stránky', () => {
    const storage = todayDevice({
      [PROFILE_LIST_KEY]: 'nesmysl',
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    const store = openProfiles(storage);

    const test = enterCounting(store);
    solveProblems(test, 2);
    test.session.leave();
    // Odchod domečkem a nový vstup v témže načtení stránky.
    expect(whatChildSees(store).stars).toBe(9);

    // Po obnovení stránky platí zase jen staré klíče.
    expect(whatChildSees(openProfiles(storage)).stars).toBe(7);
  });

  it('po opravě seznamu dítě uvidí hvězdičky a nastavení svého profilu', () => {
    const storage = todayDevice();
    const test = enterCounting(openProfiles(storage));
    test.session.finishGuide(SECOND_CHILD_SETTINGS);
    solveProblems(test, 4);
    test.session.leave();
    const savedList = storage.data.get(PROFILE_LIST_KEY) ?? '';

    storage.data.set(PROFILE_LIST_KEY, '{');
    expect(whatChildSees(openProfiles(storage))).toMatchObject({ stars: 0, guide: true });

    storage.data.set(PROFILE_LIST_KEY, savedList);
    expect(whatChildSees(openProfiles(storage))).toMatchObject({
      settings: SECOND_CHILD_SETTINGS,
      stars: 4,
      guide: false,
    });
  });
});

describe('#71 AC4: Počítání ukládá hvězdičky a nastavení k aktivnímu profilu', () => {
  it('hvězdičky a nastavení jednoho profilu nezmění druhý, ani průvodce, ani oslava', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    const store = openProfiles(storage);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    // Druhé dítě: průvodce, pak 13 příkladů (s oslavou po desáté hvězdičce).
    store.selectProfile(second.id);
    const inSecond = enterCounting(store);
    expect(inSecond.session.guideOpen()).toBe(true);
    expect(inSecond.session.starCount()).toBe(0);
    inSecond.session.finishGuide(SECOND_CHILD_SETTINGS);
    solveProblems(inSecond, 13);
    inSecond.session.leave();

    store.selectProfile(first.id);
    expect(whatChildSees(store)).toMatchObject({
      settings: { maxNumber: 10, operations: 'plus', answerInput: 'keypad' },
      stars: 7,
      guide: false,
    });

    // První dítě: 3 hvězdičky do plné řady a oslava, pak změna nastavení.
    const inFirst = enterCounting(store);
    solveProblems(inFirst, 3);
    inFirst.page.holdGear();
    inFirst.session.confirmSettings({ maxNumber: 5, operations: 'mixed', answerInput: 'keypad' });
    inFirst.session.leave();

    const reloaded = openProfiles(storage);
    expect(reloaded.activeProfile()).toEqual(first);
    expect(whatChildSees(reloaded)).toMatchObject({
      settings: { maxNumber: 5, operations: 'mixed', answerInput: 'keypad' },
      stars: 0,
      guide: false,
    });
    reloaded.selectProfile(second.id);
    expect(whatChildSees(reloaded)).toMatchObject({
      settings: SECOND_CHILD_SETTINGS,
      stars: 3,
      guide: false,
    });
  });

  it('průvodce se otevře v každém profilu při jeho prvním spuštění Počítání', () => {
    const storage = todayDevice();
    const store = openProfiles(storage);
    const first = store.activeProfile();

    const inFirst = enterCounting(store);
    expect(inFirst.session.guideOpen()).toBe(true);
    inFirst.session.finishGuide(SECOND_CHILD_SETTINGS);
    inFirst.session.leave();

    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);
    expect(whatChildSees(store).guide).toBe(true);
    // Průvodce bez „Začít hrát“ nic neuloží, druhé dítě ho uvidí i příště.
    expect(whatChildSees(openProfiles(storage)).guide).toBe(true);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(whatChildSees(reloaded).guide).toBe(false);
  });

  it('klíče úložiště obsahují vnitřní označení profilu, nikdy přezdívku', () => {
    const storage = todayDevice();
    const store = openProfiles(storage);
    const child = store.createProfile({ nickname: 'ŽŮŘ', color: PROFILE_COLORS[4] });
    store.selectProfile(child.id);
    const before = storage.snapshot();

    const test = enterCounting(store);
    test.session.finishGuide(SECOND_CHILD_SETTINGS);
    solveProblems(test, 2);
    test.session.leave();

    const added = storage.keysAddedSince(before);
    expect(added.length).toBeGreaterThan(0);
    for (const key of added) {
      expect(key).toContain(child.id);
    }
    for (const key of storage.data.keys()) {
      expect(key).not.toMatch(/[ŽŮŘ]/);
    }
  });
});

describe('#71 AC6: do úložiště přibudou jen záznamy profilů a jejich her', () => {
  it('kromě starých klíčů, seznamu profilů a aktivního profilu má každý klíč označení profilu', () => {
    const storage = todayDevice({
      [LEGACY_SETTINGS_KEY]: TODAY_SETTINGS,
      [LEGACY_PROGRESS_KEY]: TODAY_PROGRESS,
    });
    const store = openProfiles(storage);
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    const first = enterCounting(store);
    solveProblems(first, 3);
    first.session.leave();
    store.selectProfile(second.id);
    const inSecond = enterCounting(store);
    inSecond.session.finishGuide(SECOND_CHILD_SETTINGS);
    inSecond.session.leave();

    const pageKeys = [
      LEGACY_SETTINGS_KEY,
      LEGACY_PROGRESS_KEY,
      PROFILE_LIST_KEY,
      ACTIVE_PROFILE_KEY,
    ];
    const ids = openProfiles(storage)
      .profiles()
      .map((profile) => profile.id);
    for (const key of storage.data.keys()) {
      if (!pageKeys.includes(key)) {
        expect(
          ids.some((id) => key.includes(id)),
          key,
        ).toBe(true);
      }
    }
  });
});
