import { describe, expect, it } from 'vitest';

import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { MAP_GOAL_SHOW_MS, MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import type { MapProgress } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MAP_PROGRESS_KEY, loadMapProgress } from '../../../src/games/counting/storage/mapStorage';
import { saveProgress } from '../../../src/games/counting/storage/progressStorage';
import type { KeyBalance, KeyReward } from '../../../src/shared/logic/keyRewards';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { KEY_REWARDS_AREA, KEY_REWARDS_KEY } from '../../../src/shared/storage/keyRewardsStorage';
import { DeviceStorage, profileDataKeys } from '../../shared/profileFixtures';
import {
  completeRow,
  countingStorageOf,
  enterCountingOn,
  enterCountingWithKeys,
  fillRow,
  keysOf,
  openPage,
  waitForMap,
} from './keyRewardFakes';
import type { KeyedCounting } from './keyRewardFakes';
import { solveProblems } from './sessionFakes';

/**
 * Testy k #139 AC1, AC3, AC4, AC5 a AC6 v Počítání: když značka dojde do
 * cíle mapy, sezení nahlásí stránce počet dokončených map
 * (`keyRewards.reportCompletedMaps`) hned při započtení kroku (ještě před
 * oslavou, jako uložení mapy v #87 AC4), takže přerušení obrazovky cíle
 * půlku nevezme. Při každém vstupu do hry sezení nahlásí uložený počet
 * dokončených map bez animace a bez tónu: tak se jednou převedou mapy
 * dokončené před změnou (AC5) a dřív započtené mapy se nezapočtou znovu.
 * Co cíl dal, ukazuje `goalKeyReward()` jen po dobu obrazovky cíle.
 * Časy půlky a tónu testuje `mapKeyRewardTiming.test.ts`.
 */

const NO_KEYS: KeyBalance = { halves: 0, wholeKeys: 0, hasHalf: false };

function balanceAfter(halves: number): KeyBalance {
  return { halves, wholeKeys: Math.floor(halves / 2), hasHalf: halves % 2 === 1 };
}

/** Kolikrát zazněl tón klíče. */
function keyTones(test: KeyedCounting): number {
  return test.sounds.played.filter((played) => played === SOUNDS.keyReward).length;
}

/** Mapa těsně před cílem: další plná řada ji dokončí. */
function beforeGoal(completedMaps: number): MapProgress {
  return { step: MAP_STEPS - 1, completedMaps };
}

/** Dítě dojde do cíle a obrazovka cíle se ukáže; vrátí, co cíl dal. */
function reachGoal(test: KeyedCounting): KeyReward | null {
  fillRow(test);
  waitForMap(test);
  expect(test.session.shownMap()?.reachedGoal, 'ukázal se cíl').toBe(true);
  return test.session.goalKeyReward();
}

describe('#139 AC1: když značka dojde do cíle, dítě dostane půl klíče', () => {
  it('po 1. mapě půl klíče, po 2. celý klíč, po 3. celý a půl', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    const test = enterCountingOn(page);
    const expected: readonly KeyReward[] = ['half', 'wholeKey', 'half'];

    for (const [index, reward] of expected.entries()) {
      for (let row = 1; row < MAP_STEPS; row += 1) {
        completeRow(test);
      }
      expect(reachGoal(test), `${index + 1}. mapa`).toBe(reward);
      test.timers.runAll();
      expect(keysOf(page).balance(), `po ${index + 1}. mapě`).toEqual(balanceAfter(index + 1));
    }
  });

  it('kroky mapy mimo cíl klíč nedávají a obrazovka zastávky žádnou půlku neukáže', () => {
    for (let step = 0; step < MAP_STEPS - 1; step += 1) {
      const page = openPage(new DeviceStorage());
      const test = enterCountingOn(page, { step, completedMaps: 0 });

      fillRow(test);
      waitForMap(test);

      expect(test.session.shownMap()?.reachedGoal, `krok ${step + 1}`).toBe(false);
      expect(test.session.goalKeyReward(), `krok ${step + 1}`).toBeNull();
      test.timers.runAll();
      expect(keyTones(test), `krok ${step + 1}`).toBe(0);
      expect(keysOf(page).balance(), `krok ${step + 1}`).toEqual(NO_KEYS);
    }
  });

  it('samotné hvězdičky klíč nedávají', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingOn(page, beforeGoal(0));

    solveProblems(test, STARS_PER_SET - 1);

    expect(keysOf(page).balance()).toEqual(NO_KEYS);
    expect(keyTones(test)).toBe(0);
  });

  it('mimo obrazovku cíle hra žádnou půlku neukazuje', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingOn(page, beforeGoal(0));
    expect(test.session.goalKeyReward(), 'na začátku').toBeNull();

    reachGoal(test);
    test.timers.advance(MAP_GOAL_SHOW_MS + 100);

    expect(test.session.shownMap(), 'mapa se zavřela').toBeNull();
    expect(test.session.goalKeyReward(), 'po zavření cíle').toBeNull();
    test.timers.runAll();
    expect(test.session.goalKeyReward(), 'u dalšího příkladu').toBeNull();
  });
});

describe('#139 AC3: za jednu dokončenou mapu je půl klíče jen jednou', () => {
  it('po návratu domečkem a opakovaném vstupu do hry se půlka nepřičte znovu', () => {
    const page = openPage(new DeviceStorage());
    const first = enterCountingOn(page, beforeGoal(0));
    reachGoal(first);
    first.timers.runAll();
    first.session.leave();

    for (let entry = 1; entry <= 3; entry += 1) {
      const again = enterCountingOn(page);
      again.timers.advance(MAP_GOAL_SHOW_MS);
      expect(again.session.goalKeyReward(), `${entry}. návrat`).toBeNull();
      expect(keyTones(again), `${entry}. návrat`).toBe(0);
      again.session.leave();
    }
    expect(keysOf(page).balance()).toEqual(balanceAfter(1));
  });

  it('po obnovení stránky má dítě stejně klíčů a mapa se znovu nezapočte', () => {
    const storage = new DeviceStorage();
    const test = enterCountingOn(openPage(storage), beforeGoal(0));
    reachGoal(test);
    test.timers.runAll();

    const reloaded = openPage(storage);
    const again = enterCountingOn(reloaded);
    again.timers.runAll();

    expect(keysOf(reloaded).balance()).toEqual(balanceAfter(1));
    expect(again.session.mapProgress().completedMaps).toBe(1);
  });

  it('přerušení obrazovky cíle (nastavení, domeček, zavření stránky) půlku nechá započtenou jednou', () => {
    const interruptions: ReadonlyArray<readonly [string, (test: KeyedCounting) => void]> = [
      [
        'nastavení',
        (test) => {
          test.page.holdGear();
          test.session.confirmSettings();
          test.timers.runAll();
        },
      ],
      ['domeček', (test) => test.session.leave()],
      // Zavření stránky: časovače sezení už nikdy neproběhnou.
      ['zavření stránky', () => undefined],
    ];
    const moments: readonly number[] = [
      0,
      1,
      Math.floor(MAP_GOAL_SHOW_MS / 2),
      MAP_GOAL_SHOW_MS - 1,
    ];

    for (const [name, interrupt] of interruptions) {
      for (const moment of moments) {
        const storage = new DeviceStorage();
        const test = enterCountingOn(openPage(storage), beforeGoal(0));
        reachGoal(test);
        test.timers.advance(moment);

        interrupt(test);

        const reloaded = openPage(storage);
        const again = enterCountingOn(reloaded);
        again.timers.runAll();
        const label = `${name} po ${moment} ms`;
        expect(keysOf(reloaded).balance(), label).toEqual(balanceAfter(1));
        expect(again.session.goalKeyReward(), label).toBeNull();
      }
    }
  });

  it('odchod domečkem hned po 10. hvězdičce do cíle (před oslavou) půlku nechá započtenou', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingOn(page, beforeGoal(0));

    fillRow(test);
    test.session.leave();

    expect(keysOf(page).balance()).toEqual(balanceAfter(1));
  });

  it('ve dvou panelech je za stejnou dokončenou mapu půlka jen jednou', () => {
    const storage = new DeviceStorage();
    const firstPage = openPage(storage);
    const secondPage = openPage(storage);
    const first = enterCountingOn(firstPage, beforeGoal(0));
    const second = enterCountingWithKeys(countingStorageOf(secondPage), keysOf(secondPage));

    expect(reachGoal(first), '1. panel').toBe('half');
    expect(reachGoal(second), '2. panel, stejná mapa').toBeNull();
    first.timers.runAll();
    second.timers.runAll();

    expect(keyTones(second), '2. panel bez tónu klíče').toBe(0);
    expect(keysOf(firstPage).balance()).toEqual(balanceAfter(1));
    expect(keysOf(openPage(storage)).balance(), 'po obnovení').toEqual(balanceAfter(1));
  });

  it('po poškozeném záznamu mapy dítě o půlky nepřijde a nové přibudou až nad dřív dosaženým počtem', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    enterCountingOn(page, { step: 0, completedMaps: 3 }).session.leave();
    expect(keysOf(page).balance(), 'před poškozením').toEqual(balanceAfter(3));

    // Poškozený počet map: krok zůstane, mapa jde zase od 0 map (#133 AC5).
    countingStorageOf(page).setItem(
      MAP_PROGRESS_KEY,
      JSON.stringify({ format: 2, step: MAP_STEPS - 1, completedMaps: -5 }),
    );
    const afterCorruption = enterCountingOn(page);
    expect(afterCorruption.session.mapProgress().completedMaps).toBe(0);
    expect(keysOf(page).balance(), 'hned po poškození').toEqual(balanceAfter(3));

    expect(reachGoal(afterCorruption), 'mapa pod dřív dosaženým počtem').toBeNull();
    afterCorruption.timers.runAll();
    afterCorruption.session.leave();
    expect(keysOf(page).balance(), 'po 1. mapě od poškození').toEqual(balanceAfter(3));

    const later = enterCountingOn(page, beforeGoal(3));
    expect(reachGoal(later), '4. mapa nad dřív dosaženým počtem').toBe('wholeKey');
    later.timers.runAll();
    expect(keysOf(page).balance()).toEqual(balanceAfter(4));
  });
});

describe('#139 AC4: klíče z Počítání patří profilu', () => {
  it('půlka z cíle patří profilu, který hrál; jiný a nový profil klíče nemají', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const firstId = page.profiles()[0]?.id ?? '';
    page.selectProfile(ema.id);
    const test = enterCountingOn(page, beforeGoal(0));
    reachGoal(test);
    test.timers.runAll();
    test.session.leave();

    page.selectProfile(firstId);
    const other = enterCountingOn(page);
    other.timers.runAll();
    expect(keysOf(page).balance(), 'jiný profil').toEqual(NO_KEYS);
    other.session.leave();

    const ota = page.createProfile({ nickname: 'OTA', color: PROFILE_COLORS[2] });
    page.selectProfile(ota.id);
    expect(keysOf(page).balance(), 'nový profil').toEqual(NO_KEYS);

    page.selectProfile(ema.id);
    expect(keysOf(page).balance(), 'profil, který hrál').toEqual(balanceAfter(1));
  });

  it('přezdívka se s klíči nikde neuloží a smazáním profilu klíče zmizí', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    const zuzanka = page.createProfile({ nickname: 'ZUZANKA', color: PROFILE_COLORS[3] });
    page.selectProfile(zuzanka.id);
    const test = enterCountingOn(page, beforeGoal(1));
    reachGoal(test);
    test.timers.runAll();
    test.session.leave();

    for (const [key, value] of storage.data) {
      if (key.includes(KEY_REWARDS_AREA)) {
        expect(key, key).not.toContain('ZUZANKA');
        expect(value, key).not.toContain('ZUZANKA');
      }
    }
    expect(keysOf(page).balance()).toEqual(balanceAfter(2));

    expect(page.deleteProfile(zuzanka.id)).toBe(true);
    expect(profileDataKeys(storage, zuzanka.id), 'po smazání nic nezbylo').toEqual([]);
  });
});

describe('#139 AC5: mapy dokončené před změnou se převedou při prvním otevření Počítání', () => {
  it('za každou dřív dokončenou mapu půl klíče, bez animace a bez tónu', () => {
    const maps: readonly MapProgress[] = [
      { step: 0, completedMaps: 1 },
      { step: 1, completedMaps: 2 },
      { step: MAP_STEPS, completedMaps: 3 },
      { step: 2, completedMaps: 7 },
    ];
    for (const map of maps) {
      const page = openPage(new DeviceStorage());
      const countingStorage = countingStorageOf(page, map);
      saveProgress(countingStorage, { earned: 4 });
      expect(keysOf(page).balance(), 'před otevřením Počítání').toEqual(NO_KEYS);

      const test = enterCountingWithKeys(countingStorage, keysOf(page));
      const label = `${map.completedMaps} map, krok ${map.step}`;
      expect(keysOf(page).balance(), label).toEqual(balanceAfter(map.completedMaps));
      test.timers.advance(MAP_GOAL_SHOW_MS * 2);
      expect(test.session.shownMap(), `${label}: žádná mapa se neukáže`).toBeNull();
      expect(test.session.goalKeyReward(), `${label}: žádná půlka`).toBeNull();
      expect(keyTones(test), `${label}: žádný tón`).toBe(0);
      expect(test.session.mapProgress(), `${label}: mapa zůstala`).toEqual(map);
      expect(test.session.starCount(), `${label}: hvězdičky zůstaly`).toBe(4);
      expect(loadMapProgress(countingStorage), `${label}: uložená mapa zůstala`).toEqual(map);
    }
  });

  it('převod proběhne jen jednou, další otevření nic nepřidá', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    enterCountingOn(page, { step: 1, completedMaps: 3 }).session.leave();

    for (let entry = 1; entry <= 3; entry += 1) {
      const reloaded = openPage(storage);
      enterCountingOn(reloaded).session.leave();
      expect(keysOf(reloaded).balance(), `${entry}. otevření`).toEqual(balanceAfter(3));
    }
  });

  it('mapa ve starém tvaru z #87 se převede s dokončenými mapami', () => {
    const page = openPage(new DeviceStorage());
    const countingStorage = countingStorageOf(page);
    countingStorage.setItem(MAP_PROGRESS_KEY, JSON.stringify({ step: 4, completedMaps: 2 }));

    enterCountingWithKeys(countingStorage, keysOf(page)).session.leave();

    expect(keysOf(page).balance()).toEqual(balanceAfter(2));
  });

  it('každý profil se převádí zvlášť a dokud Počítání neotevře, má 0 klíčů', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ota = page.createProfile({ nickname: 'OTA', color: PROFILE_COLORS[2] });
    page.selectProfile(ema.id);
    countingStorageOf(page, { step: 1, completedMaps: 2 });
    page.selectProfile(ota.id);
    countingStorageOf(page, { step: 2, completedMaps: 5 });

    page.selectProfile(ema.id);
    enterCountingOn(page).session.leave();
    expect(keysOf(page).balance(), 'EMA po otevření').toEqual(balanceAfter(2));
    page.selectProfile(ota.id);
    expect(keysOf(page).balance(), 'OTA bez otevření').toEqual(NO_KEYS);

    enterCountingOn(page).session.leave();
    expect(keysOf(page).balance(), 'OTA po otevření').toEqual(balanceAfter(5));
    page.selectProfile(ema.id);
    expect(keysOf(page).balance(), 'EMA beze změny').toEqual(balanceAfter(2));
  });
});

describe('#139 AC6: chybějící nebo poškozený záznam klíčů a hra bez klíčů', () => {
  it('poškozený záznam klíčů dá po převodu jen půlky z dokončených map a hra jede dál', () => {
    const corrupt: readonly string[] = ['{', 'nesmysl', 'null', '[]', '{"completedMaps":-2}'];
    for (const raw of corrupt) {
      const page = openPage(new DeviceStorage());
      page.gameStorage(KEY_REWARDS_AREA).setItem(KEY_REWARDS_KEY, raw);
      expect(keysOf(page).balance(), `záznam ${raw}`).toEqual(NO_KEYS);

      const test = enterCountingOn(page, beforeGoal(2));
      expect(keysOf(page).balance(), `záznam ${raw}: po převodu`).toEqual(balanceAfter(2));
      expect(reachGoal(test), `záznam ${raw}: další mapa`).toBe('half');
      test.timers.runAll();
      expect(keysOf(page).balance(), `záznam ${raw}`).toEqual(balanceAfter(3));
    }
  });

  it('klíč, který se nepodaří uložit, platí do zavření stránky', () => {
    const storage = new DeviceStorage();
    const page = openPage(storage);
    const countingStorage = countingStorageOf(page, beforeGoal(0));
    storage.failWrite = (key) => key.includes(KEY_REWARDS_AREA);
    const test = enterCountingWithKeys(countingStorage, keysOf(page));

    expect(reachGoal(test)).toBe('half');
    test.timers.runAll();
    test.session.leave();

    expect(keysOf(page).balance(), 'do zavření stránky').toEqual(balanceAfter(1));
    const again = enterCountingOn(page);
    again.timers.runAll();
    expect(again.session.goalKeyReward()).toBeNull();
    expect(keysOf(page).balance(), 'další vstup do hry').toEqual(balanceAfter(1));
  });

  it('bez klíčů od stránky mapa dojde do cíle bez půlky, bez tónu klíče a bez chyby', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingWithKeys(countingStorageOf(page, beforeGoal(0)), undefined);

    expect(reachGoal(test)).toBeNull();
    test.timers.runAll();

    expect(keyTones(test)).toBe(0);
    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
    expect(test.session.round().solved, 'hra pokračuje dalším příkladem').toBe(false);
  });

  it('klíče, které při hlášení vyhodí výjimku, hru nezastaví', () => {
    const page = openPage(new DeviceStorage());
    const failing = {
      reportCompletedMaps: () => {
        throw new Error('klíče selhaly');
      },
      balance: () => {
        throw new Error('klíče selhaly');
      },
    };
    const test = enterCountingWithKeys(countingStorageOf(page, beforeGoal(0)), failing);

    expect(reachGoal(test)).toBeNull();
    test.timers.runAll();

    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
    expect(test.session.round().solved).toBe(false);
  });
});
