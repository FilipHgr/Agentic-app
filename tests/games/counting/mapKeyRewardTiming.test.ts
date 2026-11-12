import { describe, expect, it } from 'vitest';

import { SOUNDS, soundLengthSeconds } from '../../../src/games/counting/logic/answerSounds';
import { keyRewardMomentAt, markerShareAt } from '../../../src/games/counting/logic/mapAnimation';
import { MAP_GOAL_SHOW_MS, MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import type { KeyReward } from '../../../src/shared/logic/keyRewards';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { enterCountingOn, fillRow, keysOf, openPage, waitForMap } from './keyRewardFakes';
import type { KeyedCounting } from './keyRewardFakes';

/**
 * Testy k #139 AC2: na obrazovce cíle se u cíle objeví půlka klíče
 * s tónem, a když tím vznikne celý klíč, obě půlky se spojí. Půlka i tón
 * začnou až po melodii cíle (#135 AC3), nepřekrývají se s ní a skončí do
 * konce 5 s zobrazení cíle. Vzhled je ruční kontrola.
 *
 * Navržené rozhraní: časová osa `keyRewardMomentAt(reward, elapsedMs)`
 * v `mapAnimation.ts` (ms od ukázání mapy, jako ostatní časová osa mapy)
 * vrátí `{ visible, joined }`; sezení zahraje `SOUNDS.keyReward` ve
 * chvíli, kdy se půlka objeví. Melodie cíle začíná, když značka dojde
 * (`markerShareAt` poprvé 1).
 */

const REWARDS: readonly KeyReward[] = ['half', 'wholeKey'];

/** Kdy značka dojde do cíle, ms od ukázání mapy (po 1 ms). */
function arrivalMs(): number {
  for (let ms = 0; ms <= MAP_GOAL_SHOW_MS; ms += 1) {
    if (markerShareAt(ms) >= 1) {
      return ms;
    }
  }
  return MAP_GOAL_SHOW_MS + 1;
}

/** Kdy dohraje melodie cíle, ms od ukázání mapy. */
function goalMelodyEndMs(): number {
  return arrivalMs() + soundLengthSeconds(SOUNDS.mapGoal) * 1000;
}

/** Kdy se půlka poprvé objeví, nebo `null`, když se do 5 s neobjeví. */
function firstVisibleMs(reward: KeyReward): number | null {
  for (let ms = 0; ms <= MAP_GOAL_SHOW_MS; ms += 1) {
    if (keyRewardMomentAt(reward, ms).visible) {
      return ms;
    }
  }
  return null;
}

/** Poslední ms, kdy se ukázání půlky ještě měnilo (po 1 ms až o 1 s za konec cíle). */
function lastChangeMs(reward: KeyReward): number {
  let last = 0;
  let previous = JSON.stringify(keyRewardMomentAt(reward, 0));
  for (let ms = 1; ms <= MAP_GOAL_SHOW_MS + 1000; ms += 1) {
    const current = JSON.stringify(keyRewardMomentAt(reward, ms));
    if (current !== previous) {
      last = ms;
    }
    previous = current;
  }
  return last;
}

/** Dítě dojde do cíle; vrátí stránku, sezení s právě ukázaným cílem a počet zvuků do té chvíle. */
function reachGoal(completedMaps: number): {
  page: ProfileStore;
  test: KeyedCounting;
  before: number;
} {
  const page = openPage(new DeviceStorage());
  const test = enterCountingOn(page, { step: MAP_STEPS - 1, completedMaps });
  fillRow(test);
  waitForMap(test);
  return { page, test, before: test.sounds.played.length };
}

/** Zvuk, který zazněl, a kdy (ms od ukázání cíle). */
interface HeardSound {
  readonly tones: readonly Tone[];
  readonly atMs: number;
}

/** Co zaznělo během 5 s cíle (po 1 ms). */
function soundsDuringGoal(test: KeyedCounting, before: number): HeardSound[] {
  const heard: HeardSound[] = [];
  let checked = before;
  for (let elapsed = 0; elapsed <= MAP_GOAL_SHOW_MS; elapsed += 1) {
    const played = test.sounds.played;
    for (; checked < played.length; checked += 1) {
      const tones = played[checked];
      if (tones !== undefined) {
        heard.push({ tones, atMs: elapsed });
      }
    }
    test.timers.advance(1);
  }
  return heard;
}

function timesOf(heard: readonly HeardSound[], tones: readonly Tone[]): number[] {
  return heard.filter((sound) => sound.tones === tones).map((sound) => sound.atMs);
}

describe('#139 AC2: půlka klíče na obrazovce cíle', () => {
  it('cíl první mapy dá půlku, cíl druhé dokončí celý klíč', () => {
    const cases: ReadonlyArray<readonly [number, KeyReward]> = [
      [0, 'half'],
      [1, 'wholeKey'],
      [2, 'half'],
      [3, 'wholeKey'],
    ];
    for (const [completedMaps, reward] of cases) {
      const { test } = reachGoal(completedMaps);
      expect(test.session.goalKeyReward(), `${completedMaps + 1}. mapa`).toBe(reward);
    }
  });

  it('půlka je u cíle vidět po celou obrazovku cíle, dokud se mapa nezavře', () => {
    const { test } = reachGoal(0);
    for (let elapsed = 0; elapsed < MAP_GOAL_SHOW_MS - 1; elapsed += 1) {
      expect(test.session.goalKeyReward(), `${elapsed} ms`).toBe('half');
      test.timers.advance(1);
    }
    test.timers.advance(2);
    expect(test.session.shownMap()).toBeNull();
    expect(test.session.goalKeyReward()).toBeNull();
  });

  it('půlka se objeví až po melodii cíle a do konce 5 s cíle', () => {
    for (const reward of REWARDS) {
      const shownAt = firstVisibleMs(reward);
      expect(shownAt, `${reward}: půlka se objeví`).not.toBeNull();
      expect(shownAt ?? 0, `${reward}: ne dřív než po melodii`).toBeGreaterThanOrEqual(
        goalMelodyEndMs(),
      );
      expect(keyRewardMomentAt(reward, MAP_GOAL_SHOW_MS).visible, `${reward}: na konci`).toBe(true);
    }
  });

  it('ukázání půlky doběhne do konce 5 s cíle a pak už se nemění', () => {
    for (const reward of REWARDS) {
      expect(lastChangeMs(reward), reward).toBeLessThanOrEqual(MAP_GOAL_SHOW_MS);
    }
  });

  it('obě půlky se spojí v celý klíč, jen když cíl dokončil klíč', () => {
    for (let ms = 0; ms <= MAP_GOAL_SHOW_MS; ms += 1) {
      expect(keyRewardMomentAt('half', ms).joined, `půlka, ${ms} ms`).toBe(false);
    }
    const shownAt = firstVisibleMs('wholeKey') ?? 0;
    expect(keyRewardMomentAt('wholeKey', shownAt).joined, 'při objevení ještě ne').toBe(false);
    expect(keyRewardMomentAt('wholeKey', MAP_GOAL_SHOW_MS).joined, 'na konci cíle').toBe(true);
  });

  it('spojené půlky se už nerozpojí', () => {
    let joined = false;
    for (let ms = 0; ms <= MAP_GOAL_SHOW_MS; ms += 1) {
      const now = keyRewardMomentAt('wholeKey', ms).joined;
      if (joined) {
        expect(now, `${ms} ms`).toBe(true);
      }
      joined = now;
    }
  });
});

describe('#139 AC2: tón půlky klíče', () => {
  it('tón zazní jednou, spolu s půlkou, po melodii cíle a dohraje do konce 5 s', () => {
    for (const [completedMaps, reward] of [
      [0, 'half'],
      [1, 'wholeKey'],
    ] as const) {
      const { test, before } = reachGoal(completedMaps);
      const heard = soundsDuringGoal(test, before);
      const melody = timesOf(heard, SOUNDS.mapGoal);
      const tone = timesOf(heard, SOUNDS.keyReward);

      expect(melody, `${reward}: melodie cíle`).toHaveLength(1);
      expect(tone, `${reward}: tón klíče jednou`).toHaveLength(1);
      const toneAt = tone[0] ?? 0;
      const melodyEnd = (melody[0] ?? 0) + soundLengthSeconds(SOUNDS.mapGoal) * 1000;
      expect(toneAt, `${reward}: nepřekrývá se s melodií`).toBeGreaterThanOrEqual(melodyEnd);
      expect(toneAt, `${reward}: zazní, když se objeví půlka`).toBe(firstVisibleMs(reward));
      expect(
        toneAt + soundLengthSeconds(SOUNDS.keyReward) * 1000,
        `${reward}: dohraje do konce cíle`,
      ).toBeLessThanOrEqual(MAP_GOAL_SHOW_MS);
    }
  });

  it('tón klíče je krátký tón z přehrávače tónů, ne nahrávka', () => {
    expect(SOUNDS.keyReward.length).toBeGreaterThan(0);
    for (const tone of SOUNDS.keyReward) {
      expect(tone.frequencyHz).toBeGreaterThan(0);
      expect(tone.volume).toBeGreaterThan(0);
    }
  });

  it('přerušení cíle nastavením před tónem: tón už nezazní, půlka zůstane započtená', () => {
    const { page, test, before } = reachGoal(0);
    test.timers.advance(arrivalMs());

    test.page.holdGear();
    test.session.confirmSettings();
    test.timers.runAll();

    expect(test.sounds.played.slice(before)).not.toContain(SOUNDS.keyReward);
    expect(test.session.goalKeyReward()).toBeNull();
    expect(keysOf(page).balance().halves).toBe(1);
  });
});
