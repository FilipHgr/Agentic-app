import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  hintDotGroups,
  isHintButtonVisible,
  isHintVisible,
  problemText,
  requestHint,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { STAR_FLIGHT_MS } from '../../../src/games/counting/logic/countingSession';
import type { CountingSession } from '../../../src/games/counting/logic/countingSession';
import { playStateAfterResize } from '../../../src/games/counting/logic/deviceLayout';
import type { Stroke } from '../../../src/games/counting/logic/digitRecognition';
import { countDot, startDotCounting } from '../../../src/games/counting/logic/dotCounting';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { CLOSED_SETTINGS, openSettings } from '../../../src/games/counting/logic/settingsSession';
import type { GameSettings, MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  switchToKeypad,
  updateBoxes,
} from '../../../src/games/counting/logic/twoBoxWriting';
import type { TwoBoxRound } from '../../../src/games/counting/logic/twoBoxWriting';
import { RECOGNITION_DELAY_MS } from '../../../src/games/counting/logic/writingRound';
import type { DigitRecognizer } from '../../../src/games/counting/logic/writingRound';
import { minus, plus } from './layoutScenes';
import { seededRandom } from './seededRandom';
import {
  KEYPAD_SETTINGS,
  correctAnswerOf,
  enterCounting,
  solveProblems,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';

/**
 * Testy k #84 (tlačítko nápovědy s tečkami u číselníku i u psaní), logika
 * kola a sezení hry. Rozložení tlačítka hlídá `hintButtonLayout.test.ts`.
 *
 * Rozhodnutí vlastníka (2026-11-07): tlačítko je na místě teček a tečky ho
 * nahradí, automatická nápověda po 2. chybě zůstává, tlačítko jde zmáčknout
 * hned, hvězdička se dává i s nápovědou, žádná volba v nastavení.
 *
 * Navržené rozhraní:
 * - `answerRound.ts`: `requestHint(round)` vrátí kolo s ukázanou nápovědou
 *   (bez tlačítka nebo po vyřešení kolo beze změny), `isHintButtonVisible(round)`
 *   říká, jestli je vidět tlačítko; `isHintVisible(round)` platí i po tlačítku.
 * - `countingSession.ts`: `hintButtonVisible()` a `tapHintButton()`, které
 *   vrátí `true`, když se nápověda právě ukázala.
 *
 * Ručně se kontroluje (AC8): tón a zhoupnutí po ťuknutí, animace teček
 * a pochopitelnost symbolu „?“ v Safari na iPadu a iPhonu.
 */

const RANGES: readonly MaxNumber[] = [5, 10, 20];

/** Kolo s pevným příkladem, aby testy nezávisely na náhodě. */
function roundWith(problem: Problem, maxNumber: MaxNumber = 10): AnswerRound {
  const settings: GameSettings = { maxNumber, operations: 'mixed', answerInput: 'keypad' };
  return { ...createAnswerRound(settings, seededRandom()), problem };
}

function wrongFor(round: AnswerRound): number {
  return round.problem.result === 0 ? 1 : 0;
}

function settingsFor(maxNumber: MaxNumber, answerInput: GameSettings['answerInput']): GameSettings {
  return { maxNumber, operations: 'mixed', answerInput };
}

function hasDots(session: CountingSession): boolean {
  return hintDotGroups(session.problem()).length > 0;
}

/** Dítě vyřeší příklady, dokud nedostane příklad, u kterého jsou tečky (0 + 0 je nemá). */
function untilProblemWithDots(test: TestSession): void {
  for (let attempt = 0; attempt < 20 && !hasDots(test.session); attempt += 1) {
    solveProblems(test, 1);
  }
  expect(hasDots(test.session), 'příklad s tečkami').toBe(true);
}

// ---------------------------------------------------------------------------
// Psaní: podvržené rozpoznávání vrátí číslici, kterou test chce
// ---------------------------------------------------------------------------

const AREA = { width: 280, height: 280 } as const;

const STROKE: Stroke = [
  { x: 100, y: 100 },
  { x: 150, y: 200 },
];

function recognizeAs(digit: number): DigitRecognizer {
  return () => digit;
}

/** Dítě napíše do okénka jednotek číslici; po 1 s ji hra ukáže a čeká na ✓. */
function writtenDigit(pad: TwoBoxRound, nowMs: number): TwoBoxRound {
  const started = startBoxStroke(pad, 'ones', nowMs);
  const finished = finishBoxStroke(started, STROKE, nowMs + 100);
  return updateBoxes(finished, nowMs + 100 + RECOGNITION_DELAY_MS);
}

const WRITING_5: GameSettings = settingsFor(5, 'writing');

// ---------------------------------------------------------------------------
// AC1: tlačítko u každého nového příkladu, ťuknutí ukáže nápovědu
// ---------------------------------------------------------------------------

describe('AC1: u nového příkladu je tlačítko nápovědy a ukáže tečky', () => {
  it('u nového příkladu je vidět tlačítko a nápověda ještě ne', () => {
    const round = roundWith(plus(3, 4));

    expect(isHintButtonVisible(round)).toBe(true);
    expect(isHintVisible(round)).toBe(false);
  });

  it('po ťuknutí na tlačítko se hned ukáže nápověda s tečkami, bez chyby', () => {
    const round = requestHint(roundWith(plus(3, 4)));

    expect(isHintVisible(round)).toBe(true);
    expect(round.wrongAnswers).toBe(0);
  });

  it('nápověda z tlačítka má stejné skupinky teček jako po 2. chybě, i přeškrtnuté u odčítání', () => {
    for (const problem of [plus(3, 4), plus(5, 0), minus(7, 3), minus(9, 9)]) {
      const byButton = requestHint(roundWith(problem));
      const byMistakes = tapAnswer(
        tapAnswer(roundWith(problem), wrongFor(byButton)).round,
        wrongFor(byButton),
      ).round;

      expect(
        isHintVisible(byMistakes),
        `${problem.first} ${problem.operation} ${problem.second}`,
      ).toBe(true);
      expect(byButton.problem, 'stejný příklad, stejné tečky').toEqual(byMistakes.problem);
      expect(startDotCounting(byButton.problem)).toEqual(startDotCounting(byMistakes.problem));
    }
  });

  it('u rozsahu 5 a 10 jde po tlačítku ťukat na tečky, u 20 ne (#43)', () => {
    for (const maxNumber of RANGES) {
      const round = requestHint(roundWith(plus(2, 3), maxNumber));
      const result = countDot(round, startDotCounting(round.problem), 0);
      const expected = maxNumber === 20 ? null : 1;
      expect(result.countedNumber, `do ${maxNumber}`).toBe(expected);
    }
  });

  it('ve hře je tlačítko vidět u každého nového příkladu s tečkami, u číselníku i psaní ve všech rozsazích', () => {
    for (const maxNumber of RANGES) {
      for (const answerInput of ['keypad', 'writing'] as const) {
        const test = enterCounting(testDevice(settingsFor(maxNumber, answerInput)));
        for (let problem = 0; problem < 12; problem += 1) {
          const label = `do ${maxNumber}, ${answerInput}, příklad ${problem + 1}`;
          expect(test.session.hintButtonVisible(), label).toBe(hasDots(test.session));
          expect(test.session.hintVisible(), label).toBe(false);
          solveProblems(test, 1);
        }
      }
    }
  });

  it('ve hře ťuknutí na tlačítko ukáže tečky a jde na ně ťukat', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);

    expect(test.session.tapHintButton()).toBe(true);

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.dotCounting()).toEqual(startDotCounting(test.session.problem()));
    expect(test.session.tapDot(0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC2: ťuknutí není odpověď ani chyba
// ---------------------------------------------------------------------------

describe('AC2: ťuknutí na tlačítko nápovědy není odpověď ani chyba', () => {
  it('příklad dál ukazuje „?“ a kolo není vyřešené ani nemá chybu', () => {
    const round = requestHint(roundWith(plus(3, 4)));

    expect(problemText(round).answer).toBe('?');
    expect(round.solved).toBe(false);
    expect(round.wrongAnswers).toBe(0);
  });

  it('ve hře nepřibude chyba ani hvězdička, nezazní správně ani špatně a příklad zůstane', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const test = enterCounting(device);
    untilProblemWithDots(test);
    const problem = test.session.problem();
    const stars = test.session.starCount();
    const soundsBefore = device.sounds.played.length;

    test.session.tapHintButton();
    test.timers.runAll();

    expect(test.session.problem()).toEqual(problem);
    expect(test.session.wrongAnswers()).toBe(0);
    expect(test.session.round().solved).toBe(false);
    expect(test.session.starCount()).toBe(stars);
    const newSounds = device.sounds.played.slice(soundsBefore);
    expect(newSounds).not.toContain(SOUNDS.correct);
    expect(newSounds).not.toContain(SOUNDS.wrong);
  });

  it('při psaní zůstane rozpoznané číslo čekající na ✓ a jde ho potvrdit', () => {
    const device = testDevice(WRITING_5);
    const test = enterCounting(device);
    untilProblemWithDots(test);
    const result = correctAnswerOf(test.session);
    // Okénka si scéna založí na začátku příkladu, ještě před ťuknutím na tlačítko.
    let pad = createTwoBoxRound(test.session.round(), AREA, recognizeAs(result));
    pad = writtenDigit(pad, 0);
    const stars = test.session.starCount();

    test.session.tapHintButton();

    expect(test.session.answerInput()).toBe('writing');
    expect(shownNumber(pad)).toBe(result);
    const confirmed = confirmBoxes(pad);
    expect(test.session.answerWritten(confirmed.round.answer, confirmed.outcome)).toBe('correct');
    expect(test.session.starCount()).toBe(stars + 1);
  });
});

// ---------------------------------------------------------------------------
// AC3: tečky nahradí tlačítko, neresetují se a nepřibudou podruhé
// ---------------------------------------------------------------------------

describe('AC3: když je nápověda vidět, tlačítko zmizí a tečky zůstanou', () => {
  it('po ťuknutí na tlačítko tlačítko zmizí', () => {
    const round = requestHint(roundWith(plus(3, 4)));

    expect(isHintButtonVisible(round)).toBe(false);
  });

  it('po 2. chybě se nápověda ukáže sama jako dřív a tlačítko zmizí', () => {
    const start = roundWith(plus(3, 4));
    const once = tapAnswer(start, 0).round;
    expect(isHintButtonVisible(once), 'po 1. chybě tlačítko zůstává').toBe(true);
    const twice = tapAnswer(once, 0).round;

    expect(isHintVisible(twice)).toBe(true);
    expect(isHintButtonVisible(twice)).toBe(false);
  });

  it('druhé ťuknutí na tlačítko nebo ťuknutí po 2. chybě nic nezmění', () => {
    const byButton = requestHint(roundWith(plus(3, 4)));
    const byMistakes = tapAnswer(tapAnswer(roundWith(plus(3, 4)), 0).round, 0).round;

    expect(requestHint(byButton)).toEqual(byButton);
    expect(requestHint(byMistakes)).toEqual(byMistakes);
  });

  it('spočítané tečky zůstanou i po dalších chybách a druhá sada teček nepřibude', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);
    test.session.tapHintButton();
    test.session.tapDot(0);
    const counted = test.session.dotCounting();

    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.session.tapAnswer(wrongAnswerOf(test.session));

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.hintButtonVisible()).toBe(false);
    expect(test.session.dotCounting()).toEqual(counted);
    expect(test.session.tapHintButton(), 'tlačítko už není').toBe(false);
    expect(test.session.dotCounting()).toEqual(counted);
  });

  it('po 2. chybě se tlačítko neukáže a ťuknutí na jeho místo nápovědu neresetuje', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);
    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.session.tapDot(0);
    const counted = test.session.dotCounting();

    expect(test.session.hintButtonVisible()).toBe(false);
    expect(test.session.tapHintButton()).toBe(false);
    expect(test.session.dotCounting()).toEqual(counted);
  });

  it('při psaní zůstane nápověda z tlačítka i po špatně napsaných odpovědích', () => {
    const test = enterCounting(testDevice(WRITING_5));
    untilProblemWithDots(test);
    const wrong = wrongAnswerOf(test.session);
    // Okénka vznikla s příkladem, ještě než dítě ťuklo na tlačítko.
    let pad = createTwoBoxRound(test.session.round(), AREA, recognizeAs(wrong));
    test.session.tapHintButton();
    test.session.tapDot(0);
    const counted = test.session.dotCounting();

    for (let mistake = 0; mistake < 2; mistake += 1) {
      pad = writtenDigit(pad, mistake * 5000);
      const confirmed = confirmBoxes(pad);
      expect(test.session.answerWritten(confirmed.round.answer, confirmed.outcome)).toBe('wrong');
      pad = confirmed.round;
    }

    expect(test.session.wrongAnswers()).toBe(2);
    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.hintButtonVisible()).toBe(false);
    expect(test.session.dotCounting()).toEqual(counted);
  });
});

// ---------------------------------------------------------------------------
// AC4: hvězdička a další příklad
// ---------------------------------------------------------------------------

describe('AC4: za správnou odpověď s nápovědou z tlačítka je hvězdička', () => {
  it('za správnou odpověď po tlačítku přibude hvězdička', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);
    const stars = test.session.starCount();
    test.session.tapHintButton();

    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('correct');

    expect(test.session.starCount()).toBe(stars + 1);
  });

  it('desátá hvězdička s nápovědou z tlačítka spustí oslavu jako dřív', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const test = enterCounting(device);
    solveProblems(test, STARS_PER_SET - 1);
    untilProblemWithDots(test);
    expect(test.session.starCount()).toBe(STARS_PER_SET - 1);
    test.session.tapHintButton();

    test.session.tapAnswer(correctAnswerOf(test.session));
    expect(test.session.starCount()).toBe(STARS_PER_SET);
    expect(test.session.celebrating()).toBe(true);
    test.timers.advance(STAR_FLIGHT_MS);

    expect(device.sounds.played).toContain(SOUNDS.celebration);
    test.timers.runAll();
    expect(test.session.starCount()).toBe(0);
  });

  it('po správné odpovědi tečky zmizí a tlačítko se do dalšího příkladu neukáže', () => {
    const solved = tapAnswer(requestHint(roundWith(plus(3, 4))), 7).round;
    expect(isHintVisible(solved)).toBe(false);
    expect(isHintButtonVisible(solved)).toBe(false);
    expect(requestHint(solved)).toEqual(solved);

    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);
    test.session.tapHintButton();
    test.session.tapAnswer(correctAnswerOf(test.session));

    expect(test.session.hintVisible()).toBe(false);
    expect(test.session.hintButtonVisible()).toBe(false);
  });

  it('u dalšího příkladu je nápověda skrytá a tlačítko zpět', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);
    test.session.tapHintButton();
    test.session.tapDot(0);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    untilProblemWithDots(test);

    expect(test.session.hintVisible()).toBe(false);
    expect(test.session.hintButtonVisible()).toBe(true);
    expect(test.session.dotCounting()).toEqual(startDotCounting(test.session.problem()));
  });

  it('po odchodu z hry a novém spuštění začíná příklad bez nápovědy', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const first = enterCounting(device);
    untilProblemWithDots(first);
    first.session.tapHintButton();
    first.session.leave();

    const second = enterCounting(device);

    expect(second.session.hintVisible()).toBe(false);
    expect(second.session.wrongAnswers()).toBe(0);
    expect(second.session.hintButtonVisible()).toBe(hasDots(second.session));
  });
});

// ---------------------------------------------------------------------------
// AC5: 0 + 0 a 0 − 0
// ---------------------------------------------------------------------------

describe('AC5: u 0 + 0 a 0 − 0 není tlačítko nápovědy', () => {
  for (const problem of [plus(0, 0), minus(0, 0)]) {
    const name = problem.operation === 'plus' ? '0 + 0' : '0 − 0';

    it(`u ${name} tlačítko není vidět a ťuknutí na jeho místo nic nezmění`, () => {
      const round = roundWith(problem);

      expect(isHintButtonVisible(round)).toBe(false);
      expect(requestHint(round)).toEqual(round);
    });

    it(`u ${name} hra jde dál jako dosud: správná odpověď 0 platí`, () => {
      const result = tapAnswer(roundWith(problem), 0);

      expect(result.outcome).toBe('correct');
      expect(isHintButtonVisible(result.round)).toBe(false);
    });
  }

  it('u příkladů s nulou, které tečky mají (5 + 0, 0 + 3, 4 − 4), tlačítko je', () => {
    for (const problem of [plus(5, 0), plus(0, 3), minus(4, 4)]) {
      expect(isHintButtonVisible(roundWith(problem)), JSON.stringify(problem)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AC6: otočení zařízení a psaní během stahování rozpoznávání
// ---------------------------------------------------------------------------

describe('AC6: nápověda z tlačítka přežije otočení a funguje i při stahování', () => {
  it('po otočení zařízení zůstane nápověda z tlačítka i se spočítanými tečkami', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithDots(test);
    test.session.tapHintButton();
    test.session.tapDot(0);

    const after = playStateAfterResize(
      {
        round: test.session.round(),
        settings: test.session.settings(),
        progress: test.session.starProgress(),
        counting: test.session.dotCounting(),
        writing: null,
        settingsSession: openSettings(CLOSED_SETTINGS, test.session.settings()),
        guide: null,
      },
      AREA,
    );

    expect(isHintVisible(after.round)).toBe(true);
    expect(isHintButtonVisible(after.round)).toBe(false);
    expect(after.counting).toEqual(test.session.dotCounting());
  });

  it('při psaní funguje tlačítko, i když se rozpoznávání ještě stahuje', () => {
    const test = enterCounting(testDevice(settingsFor(10, 'writing')));
    untilProblemWithDots(test);
    test.session.problemDrawn();
    expect(test.recognizer.count, 'stahování začalo').toBe(1);
    expect(test.session.recognizer()).toBeNull();
    expect(test.session.answerInput()).toBe('writing');

    expect(test.session.hintButtonVisible()).toBe(true);
    expect(test.session.tapHintButton()).toBe(true);

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.tapDot(0)).toBe(1);
  });

  it('když stahování uprostřed příkladu selže, nápověda z tlačítka zůstane i s číselníkem', () => {
    const test = enterCounting(testDevice(settingsFor(10, 'writing')));
    untilProblemWithDots(test);
    test.session.problemDrawn();
    const pad = createTwoBoxRound(test.session.round(), AREA, null);
    test.session.tapHintButton();
    test.session.tapDot(0);
    const counted = test.session.dotCounting();

    test.session.switchToKeypad(switchToKeypad(pad));

    expect(test.session.answerInput()).toBe('keypad');
    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.dotCounting()).toEqual(counted);
  });
});
