import { describe, expect, it } from 'vitest';

import { KEY_FLIGHT_MS, KEY_WAIT_MS } from '../../../src/games/coloring/logic/pictureChoice';
import { createMapCardFlow } from '../../../src/shared/logic/mapCardFlow';
import type { KeyReward } from '../../../src/shared/logic/keyRewards';
import { MAP_STEPS } from '../../../src/shared/logic/progressMap';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../../src/shared/storage/keyRewardsStorage';
import {
  LEGACY_MAP_GAME_ID,
  MAP_PROGRESS_AREA,
  openMapProgress,
} from '../../../src/shared/storage/mapProgressStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import {
  advanceLockClock,
  choiceWith,
  enterColoring,
  loadPage,
  lockDevice,
  openColoringWhilePreparing,
  pictureOf,
  tapPicture,
} from './pictureLocksHelpers';
import type { LockDevice } from './pictureLocksHelpers';

/**
 * Testy k #198: klíč získaný skutečným hraním odemkne omalovánku i na
 * pomalém tabletu.
 *
 * Skutečná cesta dítěte bez ručně zapsaného úložiště: hra s hvězdičkami
 * dostane od stránky společnou mapu a klíče aktivního profilu stejně jako
 * při spuštění z menu (`launchGame`: `openMapProgress` nad oblastí
 * `MAP_PROGRESS_AREA` a `openKeyRewards` nad `KEY_REWARDS_AREA`) a po
 * každé plné řadě hvězdiček udělá krok na mapě (`createMapCardFlow`,
 * `step`). Pak se dítě domečkem vrátí do menu a otevře Omalovánky (nové
 * spuštění hry nad stejným zařízením, `loadPage`).
 *
 * Příčina chyby (zopakovaná v prohlížeči se zpomaleným procesorem): na
 * iPadu Omalovánky po otevření připravují obrysy všech omalovánek a čas
 * animací Phaseru jde pomaleji než skutečný čas. Let klíče do zámku
 * (`KEY_FLIGHT_MS`, 0,5 s) tak trval několik sekund a scéna ohlásila
 * dolet (`keyLanded`) pozdě. Druhé ťuknutí dítěte, které přišlo po půl
 * sekundě, ale před ohlášeným doletem, výběr bral jako ťuknutí za letu
 * a zahodil ho (#159 AC3). Ještě častěji stránka při přípravě obrysů
 * úplně zamrzla na několik sekund: 5 s čekání v zámku se počítalo od
 * plánovaného doletu, takže klíč se vrátil dřív, než ho scéna vůbec
 * dosadila do zámku, a druhé ťuknutí, které dítě udělalo, když klíč
 * v zámku konečně uvidělo poskakovat, ho jen poslalo do zámku znovu. Klíč
 * pak za 5 s odletěl zpátky a omalovánka zůstala zamčená.
 */

/** Časovače karty mapy, které nic nespustí: test jen počítá kroky a co dal cíl. */
const NO_TIMERS = { after: () => () => undefined };

/**
 * Dítě v menu ťukne na hru s hvězdičkami a zaplní `rows` řad (každá řada
 * je krok na mapě). Vrátí, co ukázal cíl každé dokončené mapy.
 */
function playRows(store: ProfileStore, rows: number): (KeyReward | null)[] {
  const flow = createMapCardFlow({
    mapProgress: openMapProgress(
      store.gameStorage(MAP_PROGRESS_AREA),
      store.gameStorage(LEGACY_MAP_GAME_ID),
    ),
    keyRewards: openKeyRewards(store.gameStorage(KEY_REWARDS_AREA)),
    timers: NO_TIMERS,
    playSound: () => undefined,
    events: { onShown: () => undefined, onStarsLanded: () => undefined, onHidden: () => undefined },
  });
  const goals: (KeyReward | null)[] = [];
  for (let row = 1; row <= rows; row += 1) {
    flow.step();
    expect(flow.show(), `karta mapy po ${row}. řadě`).toBe(true);
    if (flow.shownMove()?.reachedGoal === true) {
      goals.push(flow.goalKeyReward());
    }
  }
  flow.leave();
  return goals;
}

/** Dítě dohraje `maps` map a odejde domečkem; vrátí, co ukázaly cíle. */
function playMaps(device: LockDevice, maps: number): (KeyReward | null)[] {
  return playRows(loadPage(device).store, maps * MAP_STEPS);
}

/**
 * Let klíče na pomalém tabletu: podle hodin už skončil (přes 0,5 s), ale
 * scéna ještě dolet neohlásila (v prohlížeči se zpomaleným procesorem asi 2 s).
 */
const SLOW_TABLET_TAP_GAP_MS = 1200;

/**
 * Jak dlouho stránka při přípravě obrysů nezpracuje dotyk ani dolet klíče
 * (v prohlížeči se zpomaleným procesorem přes 6 s): déle než let a 5 s
 * čekání v zámku dohromady.
 */
const FROZEN_PAGE_MS = 6200;

describe('#198 AC1, AC2: skutečná cesta od mapy ke klíči v Omalovánkách', () => {
  it('cíl 1. mapy ukáže půlku klíče, cíl 2. mapy celý klíč a Omalovánky pak ukážou 1 klíč', async () => {
    const device = lockDevice();

    expect(playMaps(device, 1), 'cíl 1. mapy').toEqual(['half']);
    const afterFirst = await enterColoring(loadPage(device));
    expect(afterFirst.keyIndicator(), 'po 1. mapě jen půlka').toEqual({
      wholeKeys: 0,
      hasHalf: true,
    });

    expect(playMaps(device, 1), 'cíl 2. mapy').toEqual(['wholeKey']);
    const afterSecond = await enterColoring(loadPage(device));
    expect(afterSecond.keyIndicator(), 'po 2. mapě celý klíč').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
  });
});

describe('#198 AC3: druhé ťuknutí odemkne omalovánku i na pomalém tabletu', () => {
  it('druhé ťuknutí po půl sekundě odemkne omalovánku, i když scéna dolet klíče ještě neohlásila', async () => {
    const device = lockDevice();
    playMaps(device, 2);
    // Dřívější návštěva Omalovánek: odemčení zdarma už proběhlo.
    await enterColoring(loadPage(device));
    const page = loadPage(device);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);

    expect(tapPicture(choice, 'car').kind, 'první ťuknutí pošle klíč').toBe('keyToLock');
    advanceLockClock(SLOW_TABLET_TAP_GAP_MS);
    const second = tapPicture(choice, 'car');

    expect(second.kind, 'druhé ťuknutí 1,2 s po prvním').toBe('unlocked');
    expect(locks.isLocked(pictureOf('car'))).toBe(false);
    expect(page.keys.balance().wholeKeys, 'klíč se utratil').toBe(0);
  });

  it('když stránka po prvním ťuknutí na 6 s zamrzne, klíč v zámku počká a druhé ťuknutí omalovánku odemkne', async () => {
    const device = lockDevice();
    playMaps(device, 2);
    await enterColoring(loadPage(device));
    const page = loadPage(device);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    expect(tapPicture(choice, 'car').kind, 'první ťuknutí pošle klíč').toBe('keyToLock');

    // Příprava obrysů zablokuje stránku: dolet ani druhé ťuknutí se nezpracují dřív.
    advanceLockClock(FROZEN_PAGE_MS);
    expect(choice.keyInLock(), 'klíč se nevrátil dřív, než doletěl').toMatchObject({
      picture: pictureOf('car'),
    });
    const second = tapPicture(choice, 'car');

    expect(second.kind, 'druhé ťuknutí po zamrznutí').toBe('unlocked');
    expect(locks.isLocked(pictureOf('car'))).toBe(false);
  });

  it('klíč, který doletěl po zamrznutí stránky, čeká v zámku celých 5 s od doletu', async () => {
    const device = lockDevice();
    playMaps(device, 2);
    const page = loadPage(device);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    expect(tapPicture(choice, 'car').kind).toBe('keyToLock');
    advanceLockClock(FROZEN_PAGE_MS);
    choice.keyLanded();

    advanceLockClock(KEY_WAIT_MS - 1);
    expect(choice.keyInLock(), 'těsně před 5 s od doletu').toMatchObject({ landed: true });
    advanceLockClock(1);

    expect(choice.keyInLock(), '5 s od doletu se klíč vrátí').toBeNull();
    expect(page.keys.balance().wholeKeys, 'nic se neutratilo').toBe(1);
  });

  it('ťuknutí do půl sekundy po prvním dál nic nespotřebuje (#159 AC3)', async () => {
    const device = lockDevice();
    playMaps(device, 2);
    const page = loadPage(device);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    expect(tapPicture(choice, 'car').kind).toBe('keyToLock');

    advanceLockClock(KEY_FLIGHT_MS - 1);

    expect(tapPicture(choice, 'car').kind, 'ťuknutí za letu').toBe('ignored');
    expect(locks.isLocked(pictureOf('car'))).toBe(true);
    expect(page.keys.balance().wholeKeys, 'klíč zůstal').toBe(1);
  });

  it('při první návštěvě během přípravy obrysů se druhé ťuknutí zapamatuje a omalovánka se odemkne po kontrole', async () => {
    const device = lockDevice();
    playMaps(device, 2);
    const page = loadPage(device);
    const opening = openColoringWhilePreparing(page);
    const choice = choiceWith(opening.locks);

    expect(tapPicture(choice, 'car').kind, 'první ťuknutí pošle klíč').toBe('keyToLock');
    advanceLockClock(SLOW_TABLET_TAP_GAP_MS);
    expect(tapPicture(choice, 'car').kind, 'druhé ťuknutí během kontroly').toBe('keyWaits');
    await opening.finishPreparing();

    expect(choice.freeCheckFinished()?.kind, 'po kontrole').toBe('unlocked');
    expect(opening.locks.isLocked(pictureOf('car'))).toBe(false);
  });
});

describe('#198 AC4: odemčení platí po obnovení stránky a jen pro profil, který klíč získal', () => {
  it('odemčená omalovánka zůstane odemčená po obnovení stránky a jiný profil ji má zamčenou', async () => {
    const device = lockDevice();
    const first = loadPage(device).store;
    const other = first.createProfile({ color: PROFILE_COLORS[1] });
    playMaps(device, 2);
    const page = loadPage(device);
    const choice = choiceWith(await enterColoring(page));
    expect(tapPicture(choice, 'car').kind).toBe('keyToLock');
    advanceLockClock(SLOW_TABLET_TAP_GAP_MS);
    expect(tapPicture(choice, 'car').kind).toBe('unlocked');

    const reloaded = await enterColoring(loadPage(device));
    expect(reloaded.isLocked(pictureOf('car')), 'po obnovení stránky').toBe(false);
    expect(reloaded.keyIndicator(), 'klíč je utracený').toEqual({ wholeKeys: 0, hasHalf: false });

    const otherPage = loadPage(device);
    otherPage.store.selectProfile(other.id);
    const otherLocks = await enterColoring(loadPage(device));
    expect(otherLocks.isLocked(pictureOf('car')), 'jiný profil').toBe(true);
    expect(otherLocks.keyIndicator(), 'jiný profil nemá klíč').toEqual({
      wholeKeys: 0,
      hasHalf: false,
    });
  });
});
