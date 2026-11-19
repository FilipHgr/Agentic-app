import { describe, expect, it } from 'vitest';

import { SOUNDS, soundLengthSeconds } from '../../../src/games/counting/logic/answerSounds';
import {
  isPlaceLitAt,
  keyRewardMomentAt,
  mapClosableFromMs,
  markerShareAt,
} from '../../../src/games/counting/logic/mapAnimation';
import { mapShowMs } from '../../../src/games/counting/logic/progressMap';
import type { MapMove } from '../../../src/games/counting/logic/progressMap';
import type { KeyReward } from '../../../src/shared/logic/keyRewards';
import { LATEST_ARRIVAL_MS, allMoves } from './mapAnimationHelpers';
import type { MoveCase } from './mapAnimationHelpers';

/**
 * Testy k #145 AC3 a AC4 na časové ose karty (čistá logika, bez sezení):
 * karta je otevřená 7 s u kroku i u cíle, všechno se do 7 s vejde, klíč
 * doběhne do 5 s a ťuknutím jde kartu zavřít až po doběhnutí animace.
 * Každé pravidlo projde v cyklu všechny kroky na všech 5 mapách
 * (`allMoves`), popis případu je ve zprávě `expect`.
 *
 * Navržené rozhraní:
 * - `mapShowMs(move)` v `progressMap.ts` vrátí 7 000 ms u kroku i u cíle
 *   (nahrazuje 3 s a 5 s z #133 a #135),
 * - `mapClosableFromMs(move: MapMove, keyReward: KeyReward | null): number`
 *   v `mapAnimation.ts`: od kolika ms od ukázání karty ji ťuknutí zavře.
 *   `keyReward` je to, co dal ukázaný cíl (`CountingSession.goalKeyReward()`),
 *   `null` na zastávce a u cíle, za který se půlka nepřičte (#139 AC3).
 */

/** Jak dlouho je karta otevřená, když na ni dítě neťukne (AC3). */
const CARD_OPEN_MS = 7000;

/** Nejpozději tehdy doběhne půlka klíče i spojení půlek (AC3, #139 AC2). */
const KEY_DONE_MS = 5000;

/** Kdy se časová osa kontroluje: po 1 ms až o 1 s za zavření karty. */
const CHECK_UNTIL_MS = CARD_OPEN_MS + 1000;

/** První ms, kdy platí `condition`, nebo `null`. */
function firstMs(condition: (ms: number) => boolean): number | null {
  for (let ms = 0; ms <= CHECK_UNTIL_MS; ms += 1) {
    if (condition(ms)) {
      return ms;
    }
  }
  return null;
}

function stopMoves(): MoveCase[] {
  return allMoves().filter(({ move }) => !move.reachedGoal);
}

function goalMoves(): MoveCase[] {
  return allMoves().filter(({ move }) => move.reachedGoal);
}

/** Kdy značka stojí na novém místě a místo svítí. */
function standingAndLitMs(move: MapMove): number | null {
  return firstMs((ms) => markerShareAt(ms) >= 1 && isPlaceLitAt(move, move.to, ms));
}

/** Kdy dohraje melodie cíle (začne, když značka dojde). */
function goalMelodyEndMs(): number {
  const arrived = firstMs((ms) => markerShareAt(ms) >= 1) ?? CHECK_UNTIL_MS;
  return arrived + soundLengthSeconds(SOUNDS.mapGoal) * 1000;
}

/** Poslední ms, kdy se ukázání klíče ještě změnilo. */
function keyLastChangeMs(reward: KeyReward): number {
  let last = 0;
  let previous = JSON.stringify(keyRewardMomentAt(reward, 0));
  for (let ms = 1; ms <= CHECK_UNTIL_MS; ms += 1) {
    const current = JSON.stringify(keyRewardMomentAt(reward, ms));
    if (current !== previous) {
      last = ms;
    }
    previous = current;
  }
  return last;
}

describe('#145 AC3: karta zůstane otevřená 7 s od ukázání, u kroku i u cíle', () => {
  it('na zastávce i v cíli je karta otevřená 7 s', () => {
    for (const { label, move } of allMoves()) {
      expect(mapShowMs(move), label).toBe(CARD_OPEN_MS);
    }
  });

  it('pohyb značky trvá nejvýš 1,5 s a melodie cíle dohraje dřív, než se karta po 7 s zavře', () => {
    for (const { label, move } of allMoves()) {
      const arrived = firstMs((ms) => markerShareAt(ms) >= 1);
      expect(arrived, label).not.toBeNull();
      expect(arrived ?? Infinity, label).toBeLessThanOrEqual(LATEST_ARRIVAL_MS);
      if (move.reachedGoal) {
        expect(goalMelodyEndMs(), label).toBeLessThanOrEqual(mapShowMs(move));
      }
    }
  });

  it('půlka klíče naskočí a půlky se spojí nejpozději v 5 s a pak se už nic nemění', () => {
    for (const reward of ['half', 'wholeKey'] as const) {
      expect(keyLastChangeMs(reward), reward).toBeLessThanOrEqual(KEY_DONE_MS);
      expect(keyRewardMomentAt(reward, KEY_DONE_MS).popShare, reward).toBe(1);
    }
    expect(keyRewardMomentAt('wholeKey', KEY_DONE_MS).joined).toBe(true);
  });
});

describe('#145 AC4: ťuknutí kartu zavře až po doběhnutí animace', () => {
  it('na zastávce jde kartu zavřít, jakmile značka stojí a místo se rozsvítilo, nejpozději od 1,5 s', () => {
    const moves = stopMoves();
    expect(moves.length).toBeGreaterThan(0);
    for (const { label, move } of moves) {
      const closable = mapClosableFromMs(move, null);
      expect(closable, label).toBe(standingAndLitMs(move));
      expect(closable, label).toBeLessThanOrEqual(LATEST_ARRIVAL_MS);
    }
  });

  it('v cíli s půlkou klíče jde kartu zavřít od konce naskočení půlky', () => {
    const halfPopped = firstMs((ms) => keyRewardMomentAt('half', ms).popShare >= 1);
    expect(halfPopped).not.toBeNull();
    for (const { label, move } of goalMoves()) {
      expect(mapClosableFromMs(move, 'half'), label).toBe(halfPopped);
    }
  });

  it('v cíli s celým klíčem jde kartu zavřít od spojení půlek', () => {
    const joined = firstMs((ms) => keyRewardMomentAt('wholeKey', ms).joined);
    expect(joined).not.toBeNull();
    for (const { label, move } of goalMoves()) {
      expect(mapClosableFromMs(move, 'wholeKey'), label).toBe(joined);
    }
  });

  it('v cíli, za který se půlka nepřičte, jde kartu zavřít od konce melodie cíle', () => {
    const melodyEnd = goalMelodyEndMs();
    for (const { label, move } of goalMoves()) {
      const closable = mapClosableFromMs(move, null);
      expect(closable, label).toBeGreaterThanOrEqual(melodyEnd);
      expect(closable - melodyEnd, `${label}: zbytečné čekání po melodii`).toBeLessThan(1);
    }
  });

  it('kartu jde ťuknutím zavřít vždy dřív, než se po 7 s zavře sama', () => {
    for (const { label, move } of allMoves()) {
      const rewards: ReadonlyArray<KeyReward | null> = move.reachedGoal
        ? [null, 'half', 'wholeKey']
        : [null];
      for (const reward of rewards) {
        expect(mapClosableFromMs(move, reward), `${label}, ${String(reward)}`).toBeLessThan(
          mapShowMs(move),
        );
      }
    }
  });

  it('v cíli se čeká nejkratší dobu bez klíče, déle na půlku a nejdéle na spojení půlek', () => {
    for (const { label, move } of goalMoves()) {
      const none = mapClosableFromMs(move, null);
      const half = mapClosableFromMs(move, 'half');
      const whole = mapClosableFromMs(move, 'wholeKey');
      expect(none, label).toBeLessThan(half);
      expect(half, label).toBeLessThan(whole);
    }
  });
});
