import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import type { CountingSession } from '../../../src/games/counting/logic/countingSession';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { START_MAP } from '../../../src/games/counting/logic/progressMap';
import type { GameSettings } from '../../../src/games/counting/logic/settings';

import {
  GROUPS,
  expectNoEarlyRepeat,
  expectRotation,
  expectValidProblem,
  firstEarlyRepeat,
  fullRotations,
  groupKeys,
  minus,
  plus,
  rotationViolation,
} from './rotationChecks';
import { seededRandom } from './seededRandom';
import { FakeRecognizerLoader, FakeTimers, testDevice } from './sessionFakes';
import type { TestDevice } from './sessionFakes';

/**
 * Testy k #94 na úrovni sezení hry, jak ho hraje dítě: chyby a nápověda
 * (AC4), potvrzení nastavení, oslava a mapa (AC5) a nové spuštění hry
 * (AC7). Sledují jen příklady, které se dítěti ukázaly. Rozhraní sezení
 * zůstává, sezení si vystřídání drží samo (viz `problemRotation.test.ts`).
 */

const PLUS_TO_5: GameSettings = { maxNumber: 5, operations: 'plus', answerInput: 'keypad' };
const PLUS_TO_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };
const PLUS_TO_20: GameSettings = { maxNumber: 20, operations: 'plus', answerInput: 'keypad' };

interface PlayedSession {
  readonly session: CountingSession;
  readonly timers: FakeTimers;
  /** Každý příklad, který se ukázal na obrazovce, v pořadí. */
  readonly shown: Problem[];
}

/** Vstup do Počítání, který si zapisuje každý ukázaný příklad. */
function play(device: TestDevice, seed?: number): PlayedSession {
  const timers = new FakeTimers();
  const shown: Problem[] = [];
  // Sezení ještě neexistuje, když se `onChange` předává, proto přes držák.
  const holder: { session?: CountingSession } = {};
  const session = createCountingSession({
    storage: device.storage,
    random: seededRandom(seed),
    sounds: device.sounds,
    voice: device.voice,
    timers,
    page: device.page,
    loadRecognizer: new FakeRecognizerLoader().load,
    onChange: (change) => {
      if (change.kind === 'roundStarted' && holder.session !== undefined) {
        shown.push(holder.session.problem());
      }
    },
  });
  holder.session = session;
  shown.push(session.problem());
  return { session, timers, shown };
}

/** Dítě vyřeší příklad hned a počká na další (i přes oslavu a mapu). */
function solveRightAway(played: PlayedSession): void {
  played.session.tapAnswer(played.session.problem().result);
  played.timers.runAll();
}

function solveRightAwayTimes(played: PlayedSession, count: number): void {
  for (let solved = 0; solved < count; solved += 1) {
    solveRightAway(played);
  }
}

function wrongAnswerOf(problem: Problem): number {
  return problem.result === 0 ? 1 : 0;
}

describe('kontroly řady příkladů dělají, co mají', () => {
  it('skupiny bez nuly mají tolik příkladů, kolik uvádí zadání', () => {
    expect(groupKeys({ maxNumber: 5, operations: 'plus' }, 'withoutZero').size).toBe(10);
    expect(groupKeys({ maxNumber: 10, operations: 'plus' }, 'withoutZero').size).toBe(45);
    expect(groupKeys({ maxNumber: 20, operations: 'mixed' }, 'withoutZero').size).toBe(380);
    expect(groupKeys({ maxNumber: 20, operations: 'mixed' }, 'withZero').size).toBe(82);
  });

  it('„3 + 4“ a „4 + 3“ jsou různé příklady, ob 4 jiné se příklad vrátit smí', () => {
    const others = [plus(1, 1), plus(1, 2), plus(2, 1), plus(2, 2)];

    expect(firstEarlyRepeat([plus(3, 4), plus(4, 3)])).toBeNull();
    expect(firstEarlyRepeat([plus(5, 0), minus(5, 0)])).toBeNull();
    expect(firstEarlyRepeat([plus(3, 4), ...others, plus(3, 4)])).toBeNull();
    expect(firstEarlyRepeat([plus(3, 4), ...others.slice(1), plus(3, 4)])).not.toBeNull();
    expect(firstEarlyRepeat([plus(3, 4), plus(3, 4)])).not.toBeNull();
  });

  it('vystřídání se pozná: celý úsek má každý příklad jednou, neúplný žádný dvakrát', () => {
    const keys = new Set(['1 + 1', '1 + 2', '2 + 1']);

    expect(
      rotationViolation([plus(1, 1), plus(2, 1), plus(1, 2), plus(1, 2), plus(1, 1)], keys),
    ).toBeNull();
    expect(rotationViolation([plus(1, 1), plus(2, 1), plus(1, 1)], keys)).not.toBeNull();
    expect(
      rotationViolation([plus(1, 1), plus(2, 1), plus(1, 2), plus(1, 2), plus(1, 2)], keys),
    ).not.toBeNull();
    expect(rotationViolation([plus(4, 4)], keys)).not.toBeNull();
  });
});

describe('AC4: příklad, ve kterém se dítě spletlo, nepřijde dřív ani častěji', () => {
  it('po špatné odpovědi zůstává stejný příklad, i s nápovědou, dokud ho dítě nevyřeší', () => {
    const played = play(testDevice(PLUS_TO_10));
    const problem = played.session.problem();

    played.session.tapHintButton();
    played.session.tapAnswer(wrongAnswerOf(problem));
    played.session.tapAnswer(wrongAnswerOf(problem));
    played.timers.runAll();

    expect(played.session.hintVisible()).toBe(true);
    expect(played.session.problem()).toEqual(problem);
    expect(played.shown).toHaveLength(1);
  });

  it('řada s chybami a nápovědou má se stejným losováním stejné pořadí příkladů jako bez chyb', () => {
    for (const settings of [
      PLUS_TO_5,
      PLUS_TO_10,
      { ...PLUS_TO_10, operations: 'mixed' as const },
    ]) {
      const withoutMistakes = play(testDevice(settings));
      solveRightAwayTimes(withoutMistakes, 40);

      const withMistakes = play(testDevice(settings));
      for (let solved = 0; solved < 40; solved += 1) {
        const problem = withMistakes.session.problem();
        withMistakes.session.tapHintButton();
        withMistakes.session.tapAnswer(wrongAnswerOf(problem));
        withMistakes.session.tapAnswer(wrongAnswerOf(problem));
        withMistakes.session.tapDot(0);
        withMistakes.timers.runAll();
        solveRightAway(withMistakes);
      }

      expect(withMistakes.shown).toEqual(withoutMistakes.shown);
    }
  });

  it('i s chybami v každém příkladu platí vystřídání a aspoň 4 jiné mezi stejnými', () => {
    const played = play(testDevice(PLUS_TO_5));
    for (let solved = 0; solved < 60; solved += 1) {
      played.session.tapAnswer(wrongAnswerOf(played.session.problem()));
      solveRightAway(played);
    }

    expectNoEarlyRepeat(played.shown, 's chybami');
    for (const group of GROUPS) {
      expectRotation(played.shown, PLUS_TO_5, group, `s chybami, skupina ${group}`);
    }
  });
});

describe('AC5: potvrzené nastavení, oslava a mapa', () => {
  /** Rodič podrží kolečko a potvrdí ✓; bez `chosen` beze změny. */
  function parentConfirms(device: TestDevice, played: PlayedSession, chosen?: GameSettings): void {
    device.page.holdGear();
    played.session.confirmSettings(chosen);
    played.timers.runAll();
  }

  it('do 10 s „+“ a potom do 20 s „+“: příklad z posledních 4 nepřijde dřív než po 4 jiných', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const device = testDevice(PLUS_TO_10);
      const played = play(device, seed);
      solveRightAwayTimes(played, 7);

      parentConfirms(device, played, PLUS_TO_20);
      solveRightAwayTimes(played, 8);

      expect(played.session.settings()).toEqual(PLUS_TO_20);
      expectNoEarlyRepeat(played.shown, `seed ${seed}`);
    }
  });

  it('po změně nastavení začne nové vystřídání pro nové nastavení', () => {
    const device = testDevice(PLUS_TO_5);
    const played = play(device);
    // Uprostřed vystřídání do 5 (10 příkladů bez nuly).
    solveRightAwayTimes(played, 5);
    const shownBefore = played.shown.length;

    parentConfirms(device, played, PLUS_TO_10);
    solveRightAwayTimes(played, 120);
    const shownAfter = played.shown.slice(shownBefore);

    for (const problem of shownAfter) {
      expectValidProblem(problem, PLUS_TO_10);
    }
    expect(fullRotations(shownAfter, PLUS_TO_10, 'withoutZero')).toBeGreaterThanOrEqual(2);
    for (const group of GROUPS) {
      expectRotation(shownAfter, PLUS_TO_10, group, `od změny, skupina ${group}`);
    }
    expectNoEarlyRepeat(played.shown, 'přes změnu');
  });

  it('nastavení potvrzené beze změny vystřídání nepřeruší, hra pokračuje dál', () => {
    const device = testDevice(PLUS_TO_5);
    const played = play(device);
    for (let round = 0; round < 25; round += 1) {
      solveRightAwayTimes(played, 3);
      parentConfirms(device, played);
    }

    expect(played.session.settings()).toEqual(PLUS_TO_5);
    expect(fullRotations(played.shown, PLUS_TO_5, 'withoutZero')).toBeGreaterThanOrEqual(5);
    expectNoEarlyRepeat(played.shown, 'beze změny');
    for (const group of GROUPS) {
      expectRotation(played.shown, PLUS_TO_5, group, `beze změny, skupina ${group}`);
    }
  });

  it('oslava ani mapa postupu vystřídání nepřeruší', () => {
    // 80 vyřešených příkladů = 8 oslav s krokem na mapě, do 5 jsou to aspoň 7 vystřídání.
    const played = play(testDevice(PLUS_TO_5));
    solveRightAwayTimes(played, 80);

    expect(played.session.mapProgress()).not.toEqual(START_MAP);
    expect(fullRotations(played.shown, PLUS_TO_5, 'withoutZero')).toBeGreaterThanOrEqual(6);
    expectNoEarlyRepeat(played.shown, 'přes oslavy');
    for (const group of GROUPS) {
      expectRotation(played.shown, PLUS_TO_5, group, `přes oslavy, skupina ${group}`);
    }
  });
});

describe('AC7: po zavření hry nebo návratu domečkem začne nové vystřídání', () => {
  it('nová hra se stejným profilem se spustí bez chyby a první příklad je z rozsahu', () => {
    const device = testDevice(PLUS_TO_5);
    const first = play(device);
    solveRightAwayTimes(first, 6);
    first.session.leave();

    let next: PlayedSession | undefined;
    expect(() => {
      next = play(device);
    }).not.toThrow();

    expectValidProblem(next?.session.problem() ?? plus(99, 99), PLUS_TO_5);
  });

  it('uložené hvězdičky, mapa ani nastavení se kvůli vystřídání nemění', () => {
    const device = testDevice(PLUS_TO_5);
    const first = play(device);
    solveRightAwayTimes(first, 6);
    first.session.leave();
    const savedAfterLeave = new Map(device.storage.data);

    const next = play(device);

    expect(next.session.starCount()).toBe(6);
    expect(new Map(device.storage.data)).toEqual(savedAfterLeave);
  });

  it('nová hra nepokračuje ve vystřídání minulé hry, začne od začátku', () => {
    // Se stejným losováním dá nová hra stejné příklady jako úplně první hra:
    // nic z minulého vystřídání se nepamatuje.
    const freshDevice = testDevice(PLUS_TO_5);
    const fresh = play(freshDevice, 5);
    solveRightAwayTimes(fresh, 8);

    const device = testDevice(PLUS_TO_5);
    const before = play(device, 5);
    solveRightAwayTimes(before, 6);
    before.session.leave();
    const after = play(device, 5);
    solveRightAwayTimes(after, 8);

    expect(after.shown.slice(0, 8)).toEqual(fresh.shown.slice(0, 8));
  });
});
