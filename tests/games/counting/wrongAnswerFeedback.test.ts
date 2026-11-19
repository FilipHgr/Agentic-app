import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  isHintButtonGlowing,
  isHintButtonVisible,
  isHintVisible,
  requestHint,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { SOUNDS, soundForOutcome } from '../../../src/games/counting/logic/answerSounds';
import type { Stroke } from '../../../src/games/counting/logic/digitRecognition';
import type { Problem } from '../../../src/games/counting/logic/problems';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { answerButtonLook, KEYPAD_BUTTON_STYLE } from '../../../src/games/counting/logic/theme';
import {
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  startBoxStroke,
  updateBoxes,
} from '../../../src/games/counting/logic/twoBoxWriting';
import type { TwoBoxRound } from '../../../src/games/counting/logic/twoBoxWriting';
import {
  HINT_GLOW_PULSE_MS,
  QUESTION_MARK_HOP_MS,
  WRONG_BUTTON_FEEDBACK_MS,
  WRONG_BUTTON_MIN_SCALE,
  hintGlowFrameAt,
  questionMarkLiftAt,
  wrongButtonFrame,
} from '../../../src/games/counting/logic/wrongAnswerFeedback';
import { RECOGNITION_DELAY_MS } from '../../../src/games/counting/logic/writingRound';
import type { DigitRecognizer } from '../../../src/games/counting/logic/writingRound';
import { contrastRatio } from '../../../src/shared/logic/theme';
import { MODES, PLAY_WINDOWS, minus, playLabel, playLayoutOf, plus } from './layoutScenes';
import type { PlayCase } from './layoutScenes';
import { seededRandom } from './seededRandom';
import {
  KEYPAD_SETTINGS,
  correctAnswerOf,
  enterCounting,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';

/**
 * Testy k #155 (špatná odpověď je vidět: tlačítko zešedne a zmenší se,
 * „?“ poskočí, po 1. chybě se rozzáří žárovka nápovědy), AC1 až AC5:
 * časy a průběh odezvy, vzhled zešedlého tlačítka, stav žárovky v kole
 * i v sezení hry. Rozložení (AC6) hlídá `wrongAnswerFeedbackLayout.test.ts`.
 *
 * Navržené rozhraní:
 * - nový `src/games/counting/logic/wrongAnswerFeedback.ts` (čistý TS):
 *   - `WRONG_BUTTON_FEEDBACK_MS` (nejvýš 400) a `WRONG_BUTTON_MIN_SCALE`
 *     (aspoň 0,9, menší než 1),
 *   - `wrongButtonFrame(wrongTapsMs, nowMs): { scale, state }` jak vypadá
 *     tlačítko číselníku v čase `nowMs`, když na něj dítě špatně ťuklo
 *     v časech `wrongTapsMs` (ms, vzestupně); `state` je `'wrong'`
 *     (zešedlé) nebo `'idle'`, `scale` se mění kolem středu tlačítka,
 *   - `QUESTION_MARK_HOP_MS` a `questionMarkLiftAt(elapsedMs, layout)`
 *     o kolik herních jednotek je „?“ v čase od špatné odpovědi výš než
 *     v klidu (0 = v klidu, nikdy záporné); `layout` je rozložení hry
 *     (`DeviceScreenLayout | DeviceWritingLayout`), aby se poskok vešel
 *     i na nejnižší telefon,
 *   - `HINT_GLOW_PULSE_MS` (délka jednoho pulzu) a `hintGlowFrameAt(elapsedMs)`
 *     `{ scale, glow }` rozzářené žárovky od rozsvícení (`glow` 0 až 1),
 * - `theme.ts`: `answerButtonLook('wrong')` je zešedlý vzhled (dnes stejný
 *   jako `'idle'`),
 * - `answerRound.ts`: `isHintButtonGlowing(round)`,
 * - `countingSession.ts`: `hintButtonGlowing()`.
 *
 * Ručně se kontroluje (AC1, AC7): že tlačítko už se netřese, že nic není
 * červené ani nezmizí, okamžitost a 60 fps v Safari na iPadu a iPhonu,
 * čitelnost zešedlého čísla na displeji a záře a pulz žárovky.
 */

/** Krok, po kterém se odezva prochází v čase (ms). */
const FRAME_STEP_MS = 10;

/** Nejdelší dovolená odezva tlačítka (AC1: do 0,4 s). */
const FEEDBACK_LIMIT_MS = 400;

/** Nejmenší dovolené zmenšení tlačítka (AC1: nejvýš na 90 %). */
const SMALLEST_SCALE = 0.9;

/** Číslo na tlačítku je běžný text: kontrast aspoň 4,5 : 1 (WCAG). */
const TEXT_CONTRAST = 4.5;

/** Rozložení hry v oknech iPadu, telefonu na šířku i na výšku, číselník i psaní. */
function sampleLayouts(): Array<{
  label: string;
  layout: ReturnType<typeof playLayoutOf>['layout'];
}> {
  return PLAY_WINDOWS.flatMap((window) =>
    MODES.map((mode) => {
      const testCase: PlayCase = {
        window,
        maxNumber: 10,
        mode,
        operations: 'mixed',
        starCount: 0,
        hint: null,
      };
      return { label: playLabel(testCase), layout: playLayoutOf(testCase).layout };
    }),
  );
}

function timesUpTo(endMs: number): number[] {
  const times: number[] = [];
  for (let time = 0; time <= endMs; time += FRAME_STEP_MS) {
    times.push(time);
  }
  return times;
}

/** Kolo s pevným příkladem, aby testy nezávisely na náhodě. */
function roundWith(problem: Problem): AnswerRound {
  const settings: GameSettings = { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' };
  return { ...createAnswerRound(settings, seededRandom()), problem };
}

function wrongFor(round: AnswerRound): number {
  return round.problem.result === 0 ? 1 : 0;
}

function wrongTimes(round: AnswerRound, times: number): AnswerRound {
  let current = round;
  for (let mistake = 0; mistake < times; mistake += 1) {
    current = tapAnswer(current, wrongFor(current)).round;
  }
  return current;
}

/** Barva se znatelným červeným nádechem: červená složka převyšuje zelenou i modrou. */
function isReddish(color: string): boolean {
  const hex = color.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return (red ?? 0) - Math.max(green ?? 0, blue ?? 0) > 40;
}

/** Šedá barva má všechny tři složky skoro stejné. */
function isGray(color: string): boolean {
  const hex = color.replace('#', '');
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return Math.max(...channels) - Math.min(...channels) <= 10;
}

/** Dítě vyřeší příklady, dokud nedostane příklad s tečkami (a tedy s žárovkou). */
function untilProblemWithBulb(test: TestSession): void {
  for (let attempt = 0; attempt < 20 && !test.session.hintButtonVisible(); attempt += 1) {
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
  }
  expect(test.session.hintButtonVisible(), 'příklad s žárovkou').toBe(true);
}

// ---------------------------------------------------------------------------
// Psaní: podvržené rozpoznávání vrátí číslici, kterou test chce
// ---------------------------------------------------------------------------

const AREA = { width: 280, height: 280 } as const;

const STROKE: Stroke = [
  { x: 100, y: 100 },
  { x: 150, y: 200 },
];

const WRITING_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

function recognizeAs(digit: number): DigitRecognizer {
  return () => digit;
}

/** Dítě napíše do okénka jednotek číslici; po 1 s ji hra ukáže a čeká na ✓. */
function writtenDigit(pad: TwoBoxRound, nowMs: number): TwoBoxRound {
  const started = startBoxStroke(pad, 'ones', nowMs);
  const finished = finishBoxStroke(started, STROKE, nowMs + 100);
  return updateBoxes(finished, nowMs + 100 + RECOGNITION_DELAY_MS);
}

/** Dítě napíše špatné číslo a potvrdí ho ✓; vrátí okénka po vyhodnocení. */
function confirmWrongWriting(test: TestSession, pad: TwoBoxRound, nowMs: number): TwoBoxRound {
  const confirmed = confirmBoxes(writtenDigit(pad, nowMs));
  expect(confirmed.outcome).toBe('wrong');
  expect(test.session.answerWritten(confirmed.round.answer, confirmed.outcome)).toBe('wrong');
  return confirmed.round;
}

// ---------------------------------------------------------------------------
// AC1: tlačítko zešedne a zmenší se, do 0,4 s je zpět
// ---------------------------------------------------------------------------

describe('AC1: po špatném ťuknutí tlačítko na chvíli zešedne a zmenší se', () => {
  it('odezva trvá nejvýš 0,4 s a tlačítko se zmenší nejvýš na 90 %', () => {
    expect(WRONG_BUTTON_FEEDBACK_MS).toBeGreaterThan(0);
    expect(WRONG_BUTTON_FEEDBACK_MS).toBeLessThanOrEqual(FEEDBACK_LIMIT_MS);
    expect(WRONG_BUTTON_MIN_SCALE).toBeGreaterThanOrEqual(SMALLEST_SCALE);
    expect(WRONG_BUTTON_MIN_SCALE).toBeLessThan(1);
  });

  it('tlačítko zešedne hned po ťuknutí', () => {
    expect(wrongButtonFrame([0], 0).state).toBe('wrong');
  });

  it('během odezvy se tlačítko viditelně zmenší, ale nikdy pod 90 % a nikdy nezmizí', () => {
    const frames = timesUpTo(FEEDBACK_LIMIT_MS).map((time) => ({
      time,
      frame: wrongButtonFrame([0], time),
    }));

    expect(Math.min(...frames.map(({ frame }) => frame.scale))).toBeLessThan(1);
    for (const { time, frame } of frames) {
      expect(frame.scale, `${time} ms`).toBeGreaterThanOrEqual(SMALLEST_SCALE - 0.0001);
      expect(frame.scale, `${time} ms: tlačítko se nezvětší`).toBeLessThanOrEqual(1 + 0.0001);
    }
  });

  it('nejpozději za 0,4 s je tlačítko zpět ve své velikosti i barvě', () => {
    for (const time of [WRONG_BUTTON_FEEDBACK_MS, FEEDBACK_LIMIT_MS, 1000, 60_000]) {
      expect(wrongButtonFrame([0], time), `${time} ms`).toEqual({ scale: 1, state: 'idle' });
    }
  });

  it('tlačítko, na které dítě špatně neťuklo, vypadá normálně', () => {
    expect(wrongButtonFrame([], 0)).toEqual({ scale: 1, state: 'idle' });
    expect(wrongButtonFrame([], 5000)).toEqual({ scale: 1, state: 'idle' });
  });

  it('zešedlé tlačítko je šedé, jiné než nedotčené a bez červené', () => {
    const grayed = answerButtonLook('wrong');
    const idle = answerButtonLook('idle');

    expect(grayed).not.toEqual(idle);
    expect(isGray(grayed.background), `pozadí ${grayed.background}`).toBe(true);
    for (const color of [grayed.background, grayed.borderColor, grayed.digitColor]) {
      expect(isReddish(color), `${color} není červená`).toBe(false);
    }
  });

  it('číslo na zešedlém tlačítku zůstane vidět a jde přečíst (kontrast aspoň 4,5 : 1)', () => {
    const grayed = answerButtonLook('wrong');

    expect(grayed.digitColor.toLowerCase()).not.toBe(grayed.background.toLowerCase());
    expect(contrastRatio(grayed.digitColor, grayed.background)).toBeGreaterThanOrEqual(
      TEXT_CONTRAST,
    );
  });

  it('zešedlé tlačítko se nezamkne, jde na něj ťuknout', () => {
    expect(answerButtonLook('wrong').interactive).toBe(true);
    expect(answerButtonLook(wrongButtonFrame([0], 0).state).interactive).toBe(true);
  });

  it('po odezvě má tlačítko zase světle modrou barvu číselníku', () => {
    const look = answerButtonLook(wrongButtonFrame([0], WRONG_BUTTON_FEEDBACK_MS).state);

    expect(look.background.toLowerCase()).toBe(KEYPAD_BUTTON_STYLE.background.toLowerCase());
    expect(look.digitColor.toLowerCase()).toBe(KEYPAD_BUTTON_STYLE.digitColor.toLowerCase());
  });

  it('ve hře jde na špatné tlačítko hned ťuknout znovu a odpověď se nezablokuje', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    const wrong = wrongAnswerOf(test.session);

    expect(test.session.tapAnswer(wrong)).toBe('wrong');
    expect(test.session.tapAnswer(wrong), 'hned znovu, během odezvy').toBe('wrong');
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('correct');
  });
});

// ---------------------------------------------------------------------------
// AC2: „?“ poskočí po každé špatné odpovědi, tón chyby zůstane
// ---------------------------------------------------------------------------

describe('AC2: po každé špatné odpovědi „?“ krátce poskočí a zazní tón chyby', () => {
  it('„?“ krátce vyskočí nahoru a do konce poskoku se vrátí na své místo', () => {
    expect(QUESTION_MARK_HOP_MS).toBeGreaterThan(0);
    expect(QUESTION_MARK_HOP_MS).toBeLessThanOrEqual(1000);
    for (const { label, layout } of sampleLayouts()) {
      const lifts = timesUpTo(QUESTION_MARK_HOP_MS).map((time) => questionMarkLiftAt(time, layout));

      expect(Math.max(...lifts), `${label}: poskočí nahoru`).toBeGreaterThan(0);
      lifts.forEach((lift, index) => {
        expect(
          lift,
          `${label}, ${index * FRAME_STEP_MS} ms: nikdy pod své místo`,
        ).toBeGreaterThanOrEqual(0);
      });
      for (const time of [QUESTION_MARK_HOP_MS, QUESTION_MARK_HOP_MS + 500, 60_000]) {
        expect(questionMarkLiftAt(time, layout), `${label}, ${time} ms`).toBe(0);
      }
    }
  });

  it('každé špatné ťuknutí na číselník se vyhodnotí jako chyba s dnešním tónem chyby', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const test = enterCounting(device);

    for (let mistake = 1; mistake <= 3; mistake += 1) {
      const before = device.sounds.played.length;
      expect(test.session.tapAnswer(wrongAnswerOf(test.session)), `${mistake}. chyba`).toBe(
        'wrong',
      );
      expect(device.sounds.played.slice(before), `${mistake}. chyba`).toEqual([SOUNDS.wrong]);
    }
    expect(soundForOutcome('wrong')).toBe('wrong');
  });

  it('každé potvrzené špatné psaní se vyhodnotí jako chyba s tónem chyby', () => {
    const device = testDevice(WRITING_10);
    const test = enterCounting(device);
    const wrong = wrongAnswerOf(test.session);
    let pad = createTwoBoxRound(test.session.round(), AREA, recognizeAs(wrong));

    for (let mistake = 0; mistake < 3; mistake += 1) {
      const before = device.sounds.played.length;
      pad = confirmWrongWriting(test, pad, mistake * 5000);
      expect(device.sounds.played.slice(before), `${mistake + 1}. chyba`).toEqual([SOUNDS.wrong]);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3: žárovka se rozzáří po 1. chybě
// ---------------------------------------------------------------------------

describe('AC3: po 1. chybě se žárovka nápovědy rozzáří a jemně pulzuje', () => {
  it('u nového příkladu žárovka nesvítí', () => {
    expect(isHintButtonGlowing(roundWith(plus(3, 4)))).toBe(false);
  });

  it('po 1. chybě žárovka svítí a tečky ještě nejsou vidět', () => {
    const once = wrongTimes(roundWith(plus(3, 4)), 1);

    expect(isHintButtonGlowing(once)).toBe(true);
    expect(isHintButtonVisible(once)).toBe(true);
    expect(isHintVisible(once)).toBe(false);
  });

  it('po 1. chybě svítí u sčítání i odčítání, i s nulou', () => {
    for (const problem of [plus(3, 4), plus(5, 0), plus(0, 3), minus(7, 3), minus(4, 4)]) {
      const once = wrongTimes(roundWith(problem), 1);
      expect(isHintButtonGlowing(once), JSON.stringify(problem)).toBe(true);
    }
  });

  it('rozzářená žárovka svítí pořád a jemně pulzuje', () => {
    expect(HINT_GLOW_PULSE_MS).toBeGreaterThan(0);
    const frames = timesUpTo(2 * HINT_GLOW_PULSE_MS).map((time) => hintGlowFrameAt(time));

    for (const [index, frame] of frames.entries()) {
      const label = `${index * FRAME_STEP_MS} ms`;
      expect(frame.glow, `${label}: svítí`).toBeGreaterThan(0);
      expect(frame.glow, label).toBeLessThanOrEqual(1);
    }
    const scales = frames.map((frame) => frame.scale);
    const glows = frames.map((frame) => frame.glow);
    const pulses =
      Math.max(...scales) - Math.min(...scales) > 0 || Math.max(...glows) - Math.min(...glows) > 0;
    expect(pulses, 'záře nebo velikost se v čase mění').toBe(true);
  });

  it('pulz se opakuje stejně, dokud žárovka svítí', () => {
    for (const time of [0, 120, 333]) {
      expect(hintGlowFrameAt(time + HINT_GLOW_PULSE_MS), `${time} ms`).toEqual(
        hintGlowFrameAt(time),
      );
    }
  });

  it('po ťuknutí na žárovku přestane svítit a ukážou se tečky', () => {
    const tapped = requestHint(wrongTimes(roundWith(plus(3, 4)), 1));

    expect(isHintButtonGlowing(tapped)).toBe(false);
    expect(isHintVisible(tapped)).toBe(true);
  });

  it('po správné odpovědi žárovka nesvítí', () => {
    const once = wrongTimes(roundWith(plus(3, 4)), 1);
    const solved = tapAnswer(once, 7).round;

    expect(isHintButtonGlowing(solved)).toBe(false);
  });

  it('ve hře po 1. chybě na číselníku žárovka svítí', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);
    expect(test.session.hintButtonGlowing(), 'před chybou').toBe(false);

    test.session.tapAnswer(wrongAnswerOf(test.session));

    expect(test.session.hintButtonGlowing()).toBe(true);
    expect(test.session.hintButtonVisible()).toBe(true);
  });

  it('ve hře žárovka svítí dál, i když čas běží, dokud dítě nic neudělá', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);
    test.session.tapAnswer(wrongAnswerOf(test.session));

    test.timers.advance(10_000);

    expect(test.session.hintButtonGlowing()).toBe(true);
  });

  it('ve hře na rozzářenou žárovku jde ťuknout hned: ukáže tečky a zhasne', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);
    test.session.tapAnswer(wrongAnswerOf(test.session));

    expect(test.session.tapHintButton()).toBe(true);

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.hintButtonGlowing()).toBe(false);
  });

  it('ve hře jde na žárovku ťuknout i bez chyby jako dnes, nesvítí přitom', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);

    expect(test.session.hintButtonGlowing()).toBe(false);
    expect(test.session.tapHintButton()).toBe(true);
    expect(test.session.hintVisible()).toBe(true);
  });

  it('u dalšího příkladu žárovka nesvítí', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(test.session.hintButtonGlowing()).toBe(true);

    test.session.tapAnswer(correctAnswerOf(test.session));
    expect(test.session.hintButtonGlowing(), 'po správné odpovědi').toBe(false);
    test.timers.runAll();

    expect(test.session.wrongAnswers(), 'nový příklad').toBe(0);
    expect(test.session.hintButtonGlowing(), 'nový příklad').toBe(false);
  });

  it('po odchodu z hry a novém spuštění žárovka nesvítí', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const first = enterCounting(device);
    untilProblemWithBulb(first);
    first.session.tapAnswer(wrongAnswerOf(first.session));
    first.session.leave();

    const second = enterCounting(device);

    expect(second.session.hintButtonGlowing()).toBe(false);
  });

  it('při psaní prstem žárovka svítí po 1. potvrzené chybě a jde na ni ťuknout', () => {
    const test = enterCounting(testDevice(WRITING_10));
    untilProblemWithBulb(test);
    const pad = createTwoBoxRound(
      test.session.round(),
      AREA,
      recognizeAs(wrongAnswerOf(test.session)),
    );

    confirmWrongWriting(test, pad, 0);

    expect(test.session.hintButtonGlowing()).toBe(true);
    expect(test.session.tapHintButton()).toBe(true);
    expect(test.session.hintButtonGlowing()).toBe(false);
    expect(test.session.hintVisible()).toBe(true);
  });

  it('při psaní se stahováním rozpoznávání žárovka po 1. chybě svítí také', () => {
    const test = enterCounting(testDevice(WRITING_10));
    untilProblemWithBulb(test);
    test.session.problemDrawn();
    expect(test.session.recognizer(), 'rozpoznávání se ještě stahuje').toBeNull();
    const pad = createTwoBoxRound(
      test.session.round(),
      AREA,
      recognizeAs(wrongAnswerOf(test.session)),
    );

    confirmWrongWriting(test, pad, 0);

    expect(test.session.hintButtonGlowing()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC4: po 2. chybě tečky a žárovka zmizí
// ---------------------------------------------------------------------------

describe('AC4: po 2. chybě se ukážou tečky a žárovka zmizí', () => {
  it('po 2. chybě jsou tečky vidět, žárovka zmizí a nesvítí', () => {
    const twice = wrongTimes(roundWith(plus(3, 4)), 2);

    expect(isHintVisible(twice)).toBe(true);
    expect(isHintButtonVisible(twice)).toBe(false);
    expect(isHintButtonGlowing(twice)).toBe(false);
  });

  it('ani další chyby po tečkách žárovku nerozsvítí', () => {
    for (let mistakes = 3; mistakes <= 6; mistakes += 1) {
      const round = wrongTimes(roundWith(plus(3, 4)), mistakes);
      expect(isHintButtonGlowing(round), `${mistakes} chyb`).toBe(false);
      expect(isHintButtonVisible(round), `${mistakes} chyb`).toBe(false);
    }
  });

  it('když jsou tečky vidět po ťuknutí na žárovku, chyba ji nerozsvítí', () => {
    const tapped = requestHint(roundWith(plus(3, 4)));
    const afterMistake = tapAnswer(tapped, 0).round;

    expect(isHintVisible(afterMistake)).toBe(true);
    expect(isHintButtonGlowing(afterMistake)).toBe(false);
  });

  for (const problem of [plus(0, 0), minus(0, 0)]) {
    const name = problem.operation === 'plus' ? '0 + 0' : '0 − 0';
    it(`u ${name} žárovka není a po chybě se nerozsvítí`, () => {
      for (let mistakes = 0; mistakes <= 3; mistakes += 1) {
        const round = wrongTimes(roundWith(problem), mistakes);
        expect(isHintButtonVisible(round), `${name}, ${mistakes} chyb`).toBe(false);
        expect(isHintButtonGlowing(round), `${name}, ${mistakes} chyb`).toBe(false);
      }
    });
  }

  it('ve hře po 2. chybě tečky jsou vidět a žárovka zmizí i zhasne', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);
    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.session.tapAnswer(wrongAnswerOf(test.session));

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.hintButtonVisible()).toBe(false);
    expect(test.session.hintButtonGlowing()).toBe(false);
  });

  it('ve hře po ťuknutí na žárovku a chybě žárovka nesvítí', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    untilProblemWithBulb(test);
    test.session.tapHintButton();

    test.session.tapAnswer(wrongAnswerOf(test.session));

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.hintButtonGlowing()).toBe(false);
  });

  it('při psaní po 2. potvrzené chybě žárovka zmizí a tečky jsou vidět', () => {
    const test = enterCounting(testDevice(WRITING_10));
    untilProblemWithBulb(test);
    let pad = createTwoBoxRound(
      test.session.round(),
      AREA,
      recognizeAs(wrongAnswerOf(test.session)),
    );

    pad = confirmWrongWriting(test, pad, 0);
    confirmWrongWriting(test, pad, 5000);

    expect(test.session.hintVisible()).toBe(true);
    expect(test.session.hintButtonVisible()).toBe(false);
    expect(test.session.hintButtonGlowing()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC5: rychlé ťukání a přechod na další příklad
// ---------------------------------------------------------------------------

describe('AC5: rychlé ťukání začne odezvu znovu a při přechodu se nic nevyhodnotí', () => {
  it('další špatné ťuknutí během odezvy ji začne od začátku', () => {
    for (const secondTapMs of [0, 30, 120, 250, 390]) {
      for (const sinceSecond of timesUpTo(FEEDBACK_LIMIT_MS + 100)) {
        expect(
          wrongButtonFrame([0, secondTapMs], secondTapMs + sinceSecond),
          `druhé ťuknutí v ${secondTapMs} ms, o ${sinceSecond} ms později`,
        ).toEqual(wrongButtonFrame([0], sinceSecond));
      }
    }
  });

  it('ani při rychlém ťukání se tlačítko nezmenší pod 90 %', () => {
    const taps = [0, 20, 40, 60, 80, 100, 150, 210, 260, 330];
    for (const time of timesUpTo(1000)) {
      const frame = wrongButtonFrame(
        taps.filter((tap) => tap <= time),
        time,
      );
      expect(frame.scale, `${time} ms`).toBeGreaterThanOrEqual(SMALLEST_SCALE - 0.0001);
      expect(frame.scale, `${time} ms`).toBeLessThanOrEqual(1 + 0.0001);
    }
  });

  it('po rychlém ťukání je tlačítko do 0,4 s od posledního ťuknutí zpět', () => {
    const taps = [0, 20, 40, 60, 80, 100];
    const lastTap = 100;

    expect(wrongButtonFrame(taps, lastTap + FEEDBACK_LIMIT_MS)).toEqual({
      scale: 1,
      state: 'idle',
    });
  });

  it('ve hře se každé rychlé špatné ťuknutí vyhodnotí a nic se nezablokuje', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const test = enterCounting(device);
    const wrong = wrongAnswerOf(test.session);

    for (let tap = 0; tap < 5; tap += 1) {
      expect(test.session.tapAnswer(wrong), `${tap + 1}. ťuknutí`).toBe('wrong');
      test.timers.advance(30);
    }

    expect(device.sounds.played.filter((tones) => tones === SOUNDS.wrong)).toHaveLength(5);
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('correct');
  });

  it('ťuknutí na číselník během přechodu na další příklad nic nevyhodnotí', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const test = enterCounting(device);
    untilProblemWithBulb(test);
    const problem = test.session.problem();
    const wrong = wrongAnswerOf(test.session);
    test.session.tapAnswer(correctAnswerOf(test.session));
    const soundsBefore = device.sounds.played.length;
    const stars = test.session.starCount();

    expect(test.session.tapAnswer(wrong)).toBe('ignored');
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('ignored');

    expect(test.session.problem()).toEqual(problem);
    expect(test.session.wrongAnswers()).toBe(0);
    expect(test.session.hintButtonGlowing()).toBe(false);
    expect(test.session.starCount()).toBe(stars);
    expect(device.sounds.played).toHaveLength(soundsBefore);
  });

  it('po přechodu začne nový příklad bez chyby a bez rozzářené žárovky', () => {
    const test = enterCounting(testDevice(KEYPAD_SETTINGS));
    const wrong = wrongAnswerOf(test.session);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.session.tapAnswer(wrong);

    test.timers.runAll();

    expect(test.session.wrongAnswers()).toBe(0);
    expect(test.session.hintButtonGlowing()).toBe(false);
  });

  it('potvrzení psaní ✓ během přechodu na další příklad nic nevyhodnotí', () => {
    const device = testDevice(WRITING_10);
    const test = enterCounting(device);
    const correct = correctAnswerOf(test.session);
    const pad = writtenDigit(
      createTwoBoxRound(test.session.round(), AREA, recognizeAs(correct)),
      0,
    );
    const solved = confirmBoxes(pad);
    expect(test.session.answerWritten(solved.round.answer, solved.outcome)).toBe('correct');
    const soundsBefore = device.sounds.played.length;
    const stars = test.session.starCount();

    const again = confirmBoxes(solved.round);

    expect(test.session.answerWritten(again.round.answer, again.outcome)).toBe('ignored');
    expect(test.session.starCount()).toBe(stars);
    expect(device.sounds.played).toHaveLength(soundsBefore);
  });
});
