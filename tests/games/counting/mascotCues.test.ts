import { describe, expect, it } from 'vitest';

import {
  GREETING_NOT_YET,
  GREETING_WAIT_MS,
  greetingInterrupted,
  greetingRequested,
  greetingStep,
  isGreetingDone,
  moveForAnswer,
  moveForHintButton,
  movesToPrepare,
} from '../../../src/games/counting/logic/mascotCues';
import type { GreetingState } from '../../../src/games/counting/logic/mascotCues';
import {
  ABOVE_MAP_DEPTH,
  MAP_DEPTH,
  MASCOT_DEPTH,
  ROUND_DEPTH,
} from '../../../src/games/counting/logic/sceneDepths';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  MAX_DECODED_MOVES,
  createMascotModel,
  moveDurationMs,
} from '../../../src/shared/logic/mascot';
import type { MascotMove } from '../../../src/shared/logic/mascot';
import {
  correctAnswerOf,
  enterCounting,
  solveProblems,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';

/**
 * Testy k #167 AC4–AC6: kdy panda v Počítání co dělá.
 *
 * AC4: v klidu se pohupuje, po správné odpovědi radost, po chybné
 * povzbuzení, po ťuknutí na nápovědu přemýšlí, desátá správná spustí
 * oslavu místo radosti, po zavření karty s mapou je v klidu.
 * AC5: pozdrav se přehraje, až je vidět herní obrazovka (po průvodci);
 * když do 2 s není načtený, vynechá se.
 * AC6: panda hru nezdržuje, odpovídat jde hned.
 *
 * Reakce na odpověď se zkouší se skutečným sezením hry: scéna předá pandě
 * výsledek odpovědi a to, jestli odpověď zaplnila řadu (`celebrating()`).
 */

/** Pohyb pandy po odpovědi `answer`, jak ho scéna spočítá ze sezení. */
function pandaAfterAnswer(test: TestSession, answer: number): MascotMove | null {
  const outcome = test.session.tapAnswer(answer);
  return moveForAnswer(outcome, outcome === 'correct' && test.session.celebrating());
}

describe('#167 AC4: panda reaguje na odpovědi', () => {
  it('po správné odpovědi se panda raduje', () => {
    const test = enterCounting(testDevice());
    expect(pandaAfterAnswer(test, correctAnswerOf(test.session))).toBe('joy');
  });

  it('po chybné odpovědi panda povzbudí', () => {
    const test = enterCounting(testDevice());
    expect(pandaAfterAnswer(test, wrongAnswerOf(test.session))).toBe('encourage');
  });

  it('desátá správná odpověď spustí oslavu místo radosti', () => {
    const test = enterCounting(testDevice());
    solveProblems(test, STARS_PER_SET - 1);
    expect(test.session.starCount(), 'devět hvězdiček před desátou').toBe(STARS_PER_SET - 1);
    expect(pandaAfterAnswer(test, correctAnswerOf(test.session))).toBe('celebrate');
  });

  it('po oslavě se další správná odpověď zase jen raduje', () => {
    const test = enterCounting(testDevice());
    solveProblems(test, STARS_PER_SET);
    expect(pandaAfterAnswer(test, correctAnswerOf(test.session))).toBe('joy');
  });

  it('odpověď, kterou hra nepřijme (během oslavy a karty s mapou), pandou nepohne', () => {
    const test = enterCounting(testDevice());
    solveProblems(test, STARS_PER_SET - 1);
    test.session.tapAnswer(correctAnswerOf(test.session));
    expect(test.session.celebrating(), 'oslava běží').toBe(true);
    expect(pandaAfterAnswer(test, correctAnswerOf(test.session))).toBeNull();
  });

  it('po ťuknutí na tlačítko nápovědy panda přemýšlí, bez ukázané nápovědy nic', () => {
    const test = enterCounting(testDevice());
    expect(moveForHintButton(test.session.tapHintButton())).toBe('think');
    expect(moveForHintButton(test.session.tapHintButton()), 'nápověda už je vidět').toBeNull();
  });

  it('panda je pod kartou s mapou i jejím ztmavením, pod konfetami a pod příkladem', () => {
    expect(MASCOT_DEPTH, 'pod kartou a ztmavením').toBeLessThan(MAP_DEPTH);
    expect(MASCOT_DEPTH, 'pod konfetami a letícími hvězdičkami').toBeLessThan(ABOVE_MAP_DEPTH);
    expect(MASCOT_DEPTH, 'pod příkladem, číselníkem a nápovědou').toBeLessThan(ROUND_DEPTH);
  });

  it('po zavření karty s mapou je panda v klidu, i když oslava ještě běžela', () => {
    const panda = createMascotModel();
    panda.use();
    panda.loaded('idle');
    panda.prepare('celebrate');
    panda.loaded('celebrate');
    panda.play('celebrate', 0);
    expect(panda.currentMove(100)).toBe('celebrate');
    panda.play('idle', 200);
    expect(panda.currentMove(300)).toBe('idle');
  });

  it('v klidu se panda pohupuje dokola', () => {
    const panda = createMascotModel();
    panda.use();
    panda.loaded('idle');
    const frames = [0, moveDurationMs() / 2, moveDurationMs() * 3.5].map((now) => panda.frame(now));
    expect(frames.map((frame) => frame?.move)).toEqual(['idle', 'idle', 'idle']);
    expect(frames[1]?.frame, 'uprostřed pohupování jiný snímek').not.toBe(frames[0]?.frame);
  });
});

/** Průběh pozdravu: v časech `steps` je (ne)stažený, vrátí časy, kdy se přehrál. */
function greetingRun(
  start: GreetingState,
  steps: readonly { readonly now: number; readonly ready: boolean }[],
): { played: number[]; state: GreetingState } {
  let state = start;
  const played: number[] = [];
  for (const { now, ready } of steps) {
    const step = greetingStep(state, now, ready);
    state = step.state;
    if (step.play) {
      played.push(now);
    }
  }
  return { played, state };
}

describe('#167 AC5: pozdrav po otevření hry', () => {
  const cases: readonly {
    readonly name: string;
    readonly readyAt: number;
    /** Kdy se pozdrav přehrál, ms od ukázání obrazovky. */
    readonly played: number[];
  }[] = [
    { name: 'stažený hned se přehraje hned', readyAt: 0, played: [0] },
    { name: 'stažený za 1,5 s se přehraje', readyAt: 1500, played: [1500] },
    { name: 'stažený přesně za 2 s se ještě přehraje', readyAt: 2000, played: [2000] },
    { name: 'stažený za 2,5 s se vynechá', readyAt: 2500, played: [] },
    { name: 'nestažený se vynechá', readyAt: Infinity, played: [] },
  ];

  it('pozdrav se přehraje, jen když se stáhne do 2 s od ukázání herní obrazovky', () => {
    const shownAt = 1000;
    const problems = cases.flatMap((testCase) => {
      const start = greetingRequested(GREETING_NOT_YET, shownAt);
      const steps = [0, 250, 500, 1000, 1500, 2000, 2500, 4000, 8000].map((after) => ({
        now: shownAt + after,
        ready: after >= testCase.readyAt,
      }));
      const { played } = greetingRun(start, steps);
      const expected = testCase.played.map((at) => shownAt + at);
      return JSON.stringify(played) === JSON.stringify(expected)
        ? []
        : [
            `${testCase.name}: přehráno v ${JSON.stringify(played)}, čekáno ${JSON.stringify(expected)}`,
          ];
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('dokud je otevřený průvodce nastavením, panda nepozdraví ani se staženým pozdravem', () => {
    const { played } = greetingRun(GREETING_NOT_YET, [
      { now: 0, ready: true },
      { now: 5000, ready: true },
    ]);
    expect(played).toEqual([]);
  });

  it('po zavření průvodce panda pozdraví, i když hra běží už dlouho', () => {
    const closedAt = 60_000;
    const start = greetingRequested(GREETING_NOT_YET, closedAt);
    const { played } = greetingRun(start, [{ now: closedAt + 100, ready: true }]);
    expect(played).toEqual([closedAt + 100]);
  });

  it('pozdrav je jen jednou: druhé ukázání obrazovky ho nespustí znovu', () => {
    const first = greetingRun(greetingRequested(GREETING_NOT_YET, 0), [
      { now: 0, ready: true },
      { now: moveDurationMs() + 1, ready: true },
    ]);
    expect(isGreetingDone(first.state)).toBe(true);
    const again = greetingRun(greetingRequested(first.state, 10_000), [
      { now: 10_000, ready: true },
    ]);
    expect(again.played).toEqual([]);
  });

  it('když dítě odpoví dřív, než se pozdrav stáhne, pozdrav se vynechá', () => {
    const waiting = greetingRequested(GREETING_NOT_YET, 0);
    const interrupted = greetingInterrupted(waiting, 500);
    const { played } = greetingRun(interrupted, [{ now: 800, ready: true }]);
    expect(played).toEqual([]);
    expect(GREETING_WAIT_MS).toBe(2000);
  });
});

describe('#167 AC6: panda hru nezdržuje', () => {
  it('odpovídat jde hned po otevření hry, i když panda zrovna mává', () => {
    const test = enterCounting(testDevice());
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('correct');
  });

  it('dopředu se stahuje jen tolik pohybů, kolik se jich vejde do paměti, i s pozdravem', () => {
    const problems: string[] = [];
    for (let stars = 0; stars <= STARS_PER_SET; stars += 1) {
      for (const greetingDone of [false, true]) {
        const moves = movesToPrepare(stars, greetingDone);
        const withWave = greetingDone ? moves : [...moves, 'wave'];
        if (withWave.length > MAX_DECODED_MOVES) {
          problems.push(
            `${stars} hvězdiček, pozdrav ${greetingDone ? 'hotový' : 'čeká'}: ${withWave.join(', ')}`,
          );
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('před desátou odpovědí je dopředu stažená oslava, jinak radost a povzbuzení s přemýšlením', () => {
    expect(movesToPrepare(STARS_PER_SET - 1, true)).toEqual(['joy', 'encourage', 'celebrate']);
    expect(movesToPrepare(3, true)).toEqual(['joy', 'encourage', 'think']);
    expect(movesToPrepare(3, false)).toEqual(['joy', 'encourage']);
  });
});
