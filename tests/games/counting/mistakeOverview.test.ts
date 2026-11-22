import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke } from '../../../src/games/counting/logic/digitRecognition';
import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import type { CountingSession } from '../../../src/games/counting/logic/countingSession';
import {
  EMPTY_MISTAKES,
  MAX_MISTAKEN_PROBLEMS_PER_DAY,
  MAX_MISTAKES_PER_PROBLEM,
  MAX_MISTAKE_RECORD_BYTES,
  mistakeOverview,
  parseMistakes,
  recordHintUsed,
  recordMistake,
  recordSolvedOperation,
  serializeMistakes,
} from '../../../src/games/counting/logic/mistakeActivity';
import type {
  MistakeRecord,
  MistakenProblem,
} from '../../../src/games/counting/logic/mistakeActivity';
import {
  frequentMistakeLine,
  operationShareLine,
} from '../../../src/games/counting/logic/mistakesLayout';
import {
  backToOverview,
  backToSettings,
  canConfirmSettings,
  openParentPanel,
  showMistakes,
  showOverview,
} from '../../../src/games/counting/logic/overviewPanel';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { serializeSettings } from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { openSettings } from '../../../src/games/counting/logic/settingsSession';
import { dayKeyOf } from '../../../src/games/counting/logic/weekActivity';
import {
  RECOGNITION_DELAY_MS,
  clearWriting,
  confirmWriting,
  createWritingRound,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
} from '../../../src/games/counting/logic/writingRound';
import type { DigitRecognizer, WritingRound } from '../../../src/games/counting/logic/writingRound';
import { MISTAKES_KEY } from '../../../src/games/counting/storage/mistakeStorage';
import { COUNTING_META } from '../../../src/games/counting/meta';
import { countingTexts } from '../../../src/games/counting/texts/countingTexts';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, profileDataKeys } from '../../shared/profileFixtures';
import { seededRandom } from './seededRandom';
import {
  FakePage,
  FakeRecognizerLoader,
  FakeSounds,
  FakeTimers,
  FakeVoice,
  KEYPAD_SETTINGS,
  correctAnswerOf,
  solveProblems,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';
import { brokenStorage, memoryStorage, readOnlyStorage } from './storageFakes';
import { ASYMMETRIC_DIGITS, FORM_AREA, inForm } from './writtenForms';

/**
 * Testy k #184: přehled pro rodiče ukáže, kde se dítě v Počítání plete.
 * Podíl příkladů napoprvé zvlášť pro sčítání a odčítání, nejvýš 3 příklady
 * s nejvíc chybami za 7 dní a kolikrát dítě ťuklo na nápovědu. Datum
 * „dnes“ dostane hra zvenku (`today`). Rozložení stránky Chyby je
 * v `mistakesLayout.test.ts`.
 *
 * Rozhodnutí k úkolu: nápověda se počítá jen ťuknutím na tlačítko (#84),
 * jednou za příklad; nápověda, která se ukáže sama po 2. chybě, se
 * nepočítá (ta je vidět v chybách). Napoprvé znamená totéž jako v #183:
 * bez chyby a bez nápovědy.
 */

/** Neděle 22. 11. 2026 v poledne podle kalendáře zařízení. */
const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

const MIXED_KEYPAD: GameSettings = { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' };
const WRITING_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

/** Jeden vstup do Počítání nad úložištěm `storage` s dnešním dnem podle `clock`. */
function enterOn(
  storage: KeyValueStorage | undefined,
  clock: { today: Date },
  seed?: number,
): TestSession {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  const session = createCountingSession({
    storage,
    random: seededRandom(seed),
    sounds: new FakeSounds(),
    voice: new FakeVoice(),
    timers,
    page: new FakePage(),
    loadRecognizer: recognizer.load,
    today: () => clock.today,
    onChange: () => undefined,
  });
  if (session.guideOpen()) {
    session.finishGuide(KEYPAD_SETTINGS);
  }
  return { session, timers, recognizer, changes: () => 0 };
}

/** Úložiště s uloženým nastavením rodiče. */
function storageWith(settings: GameSettings): ReturnType<typeof memoryStorage> {
  return memoryStorage(serializeSettings(settings));
}

/** Dítě odpoví `times`krát špatně a pak správně. */
function solveAfterMistakes(test: TestSession, times: number): Problem {
  const problem = test.session.problem();
  for (let mistake = 0; mistake < times; mistake += 1) {
    test.session.tapAnswer(wrongAnswerOf(test.session));
  }
  test.session.tapAnswer(correctAnswerOf(test.session));
  test.timers.runAll();
  return problem;
}

/** Dítě řeší příklady napoprvé, dokud nedostane příklad, který splní `wanted`. */
function untilProblem(test: TestSession, wanted: (problem: Problem) => boolean): void {
  for (let attempt = 0; attempt < 60 && !wanted(test.session.problem()); attempt += 1) {
    solveProblems(test, 1);
  }
  expect(wanted(test.session.problem()), 'hledaný příklad').toBe(true);
}

/** Přehled bez čehokoli: žádný druh příkladů, žádné časté chyby ani nápověda. */
const NOTHING = { operations: [], frequent: [], hintsUsed: 0 };

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Řádek časté chyby, jak ho rodič uvidí česky. */
function csLine(mistake: MistakenProblem): string {
  return frequentMistakeLine(countingTexts('cs').mistakes.frequentItem, mistake);
}

/** Text řádku s častou chybou, jak ho rodič uvidí. */
function frequentLines(session: CountingSession): string[] {
  return session.mistakeOverview().frequent.map(csLine);
}

/** Záznam, kde dítě v den `date` udělalo u příkladů chyby v daném pořadí. */
function mistakesOn(
  date: Date,
  problems: readonly Problem[],
  start = EMPTY_MISTAKES,
): MistakeRecord {
  return problems.reduce((record, problem) => recordMistake(record, date, problem), start);
}

// ---------------------------------------------------------------------------
// Psaní: dítě píše číslici, hra ji po chvíli ukáže a čeká na ✓
// ---------------------------------------------------------------------------

const STROKE: Stroke = [
  { x: 100, y: 100 },
  { x: 150, y: 200 },
];
const STROKE_MS = 300;

function written(round: WritingRound, strokes: readonly Stroke[], startMs: number): WritingRound {
  let current = round;
  strokes.forEach((stroke, index) => {
    const start = startMs + index * STROKE_MS;
    current = finishStroke(startStroke(current, start), stroke, start + STROKE_MS);
  });
  return updateWriting(current, startMs + strokes.length * STROKE_MS + RECOGNITION_DELAY_MS);
}

// ---------------------------------------------------------------------------
// AC1: co je chyba
// ---------------------------------------------------------------------------

describe('#184 AC1: chyba je každá potvrzená špatná odpověď', () => {
  it('po dvou špatných ťuknutích na číselník rodič vidí u příkladu 2 chyby', () => {
    const test = enterOn(storageWith(KEYPAD_SETTINGS), { today: SUNDAY });
    untilProblem(test, (problem) => problem.result > 1);
    const problem = solveAfterMistakes(test, 2);
    expect(test.session.mistakeOverview().frequent).toEqual([
      { first: problem.first, second: problem.second, operation: problem.operation, mistakes: 2 },
    ]);
  });

  it('správná odpověď ani ťuknutí na nápovědu chybu nepřidá', () => {
    const storage = storageWith(KEYPAD_SETTINGS);
    const test = enterOn(storage, { today: SUNDAY });
    untilProblem(test, (problem) => problem.first > 0 || problem.second > 0);
    test.session.tapHintButton();
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    solveProblems(test, 3);
    expect(test.session.mistakeOverview().frequent).toEqual([]);
    // Ani jediná chyba se neuložila, jen vyřešené příklady a nápověda.
    const saved = parseMistakes(storage.data.get(MISTAKES_KEY))[dayKeyOf(SUNDAY)];
    expect(saved?.problems).toEqual([]);
    expect(test.session.mistakeOverview().hintsUsed).toBe(1);
  });

  it('číslo napsané prstem a před ✓ přepsané na správné se jako chyba nepočítá', () => {
    const test = enterOn(storageWith(WRITING_10), { today: SUNDAY });
    untilProblem(test, (problem) => problem.result < 10);
    let digit = wrongAnswerOf(test.session);
    const recognize: DigitRecognizer = () => digit;
    const first = written(
      createWritingRound(test.session.round(), FORM_AREA, recognize),
      [STROKE],
      0,
    );
    expect(shownDigit(first)).toBe(digit);

    // Dítě špatné číslo smaže a napíše správné, teprve pak ťukne na ✓.
    digit = correctAnswerOf(test.session);
    const rewritten = written(clearWriting(first), [STROKE], 5000);
    const confirmed = confirmWriting(rewritten);
    expect(test.session.answerWritten(confirmed.round.answer, confirmed.outcome)).toBe('correct');

    const overview = test.session.mistakeOverview();
    expect(overview.frequent).toEqual([]);
    expect(overview.operations).toEqual([
      { operation: 'plus', solved: 1, firstTry: 1, percent: 100 },
    ]);
  });

  it('špatné číslo napsané prstem a potvrzené ✓ je chyba', () => {
    const test = enterOn(storageWith(WRITING_10), { today: SUNDAY });
    untilProblem(test, (problem) => problem.result < 10);
    const problem = test.session.problem();
    const recognize: DigitRecognizer = () => wrongAnswerOf(test.session);
    let round = createWritingRound(test.session.round(), FORM_AREA, recognize);
    for (let mistake = 0; mistake < 2; mistake += 1) {
      const confirmed = confirmWriting(written(round, [STROKE], mistake * 5000));
      expect(test.session.answerWritten(confirmed.round.answer, confirmed.outcome)).toBe('wrong');
      round = confirmed.round;
    }
    expect(test.session.mistakeOverview().frequent).toEqual([
      { first: problem.first, second: problem.second, operation: 'plus', mistakes: 2 },
    ]);
  });

  it('zrcadlově napsané správné číslo hra přijme jako správné, chyba nepřibude (#85)', () => {
    const test = enterOn(storageWith(WRITING_10), { today: SUNDAY });
    const asymmetric = new Set(ASYMMETRIC_DIGITS.map((item) => item.digit));
    untilProblem(test, (problem) => asymmetric.has(problem.result));
    const result = correctAnswerOf(test.session);
    const strokes = ASYMMETRIC_DIGITS.find((item) => item.digit === result)?.strokes ?? [];
    const round = createWritingRound(test.session.round(), FORM_AREA, recognizeDigit);
    const mirrored = written(round, inForm(strokes, 'zrcadlově'), 0);
    expect(shownDigit(mirrored)).toBe(result);

    const confirmed = confirmWriting(mirrored);
    expect(test.session.answerWritten(confirmed.round.answer, confirmed.outcome)).toBe('correct');
    const overview = test.session.mistakeOverview();
    expect(overview.frequent).toEqual([]);
    expect(overview.operations[0]?.firstTry).toBe(overview.operations[0]?.solved);
  });
});

// ---------------------------------------------------------------------------
// AC2: podíl napoprvé zvlášť pro sčítání a odčítání
// ---------------------------------------------------------------------------

describe('#184 AC2: podíl příkladů napoprvé zvlášť pro sčítání a odčítání', () => {
  it('když dítě hrálo jen sčítání, rodič vidí jen řádek sčítání', () => {
    const test = enterOn(storageWith(KEYPAD_SETTINGS), { today: SUNDAY });
    solveProblems(test, 3);
    solveAfterMistakes(test, 1);
    expect(test.session.mistakeOverview().operations).toEqual([
      { operation: 'plus', solved: 4, firstTry: 3, percent: 75 },
    ]);
  });

  it('při „+ −“ jsou oba druhy zvlášť, sčítání první', () => {
    const test = enterOn(storageWith(MIXED_KEYPAD), { today: SUNDAY }, 7);
    const counted = { plus: { solved: 0, firstTry: 0 }, minus: { solved: 0, firstTry: 0 } };
    for (let index = 0; index < 20; index += 1) {
      const operation = test.session.problem().operation;
      const withMistake = index % 3 === 0;
      solveAfterMistakes(test, withMistake ? 1 : 0);
      counted[operation].solved += 1;
      counted[operation].firstTry += withMistake ? 0 : 1;
    }
    expect(counted.plus.solved).toBeGreaterThan(0);
    expect(counted.minus.solved).toBeGreaterThan(0);
    const operations = test.session.mistakeOverview().operations;
    expect(operations.map((share) => share.operation)).toEqual(['plus', 'minus']);
    expect(operations.map(({ solved, firstTry }) => ({ solved, firstTry }))).toEqual([
      counted.plus,
      counted.minus,
    ]);
  });

  it('příklad s nápovědou z tlačítka se nepočítá jako napoprvé, stejně jako v přehledu', () => {
    const test = enterOn(storageWith(KEYPAD_SETTINGS), { today: SUNDAY });
    untilProblem(test, (problem) => problem.first > 0 || problem.second > 0);
    const before = test.session.mistakeOverview().operations[0] ?? { solved: 0, firstTry: 0 };
    expect(test.session.tapHintButton()).toBe(true);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    const after = test.session.mistakeOverview().operations[0];
    expect(after?.solved).toBe(before.solved + 1);
    expect(after?.firstTry).toBe(before.firstTry);
  });

  it('podíl je zaokrouhlený dolů, 199 z 200 není 100 %', () => {
    let record = EMPTY_MISTAKES;
    for (let index = 0; index < 200; index += 1) {
      record = recordSolvedOperation(record, SUNDAY, 'minus', index !== 0);
    }
    expect(mistakeOverview(record, SUNDAY).operations).toEqual([
      { operation: 'minus', solved: 200, firstTry: 199, percent: 99 },
    ]);
  });

  it('řádek podílu česky „Sčítání: 75 % (3/4)“, anglicky „Addition: 75% (3/4)“', () => {
    const share = { operation: 'plus', solved: 4, firstTry: 3, percent: 75 } as const;
    const cs = countingTexts('cs').mistakes;
    const en = countingTexts('en').mistakes;
    expect(operationShareLine(cs.addition, share, 'cs')).toBe('Sčítání: 75 % (3/4)');
    expect(operationShareLine(en.addition, share, 'en')).toBe('Addition: 75% (3/4)');
    expect(cs.subtraction).toBe('Odčítání');
    expect(en.subtraction).toBe('Subtraction');
  });

  it('druh hraný naposledy před víc než 7 dny se neukáže', () => {
    const old = recordSolvedOperation(EMPTY_MISTAKES, daysAfter(SUNDAY, -7), 'minus', true);
    const record = recordSolvedOperation(old, daysAfter(SUNDAY, -6), 'plus', false);
    expect(mistakeOverview(record, SUNDAY).operations).toEqual([
      { operation: 'plus', solved: 1, firstTry: 0, percent: 0 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// AC3 a AC4: nejčastější chyby
// ---------------------------------------------------------------------------

describe('#184 AC3: nejvýš 3 příklady s nejvíc chybami za 7 dní', () => {
  it('rodič vidí příklady seřazené od nejvíc chyb, nejvýš 3', () => {
    const record = mistakesOn(SUNDAY, [
      plus(8, 5),
      minus(9, 3),
      plus(8, 5),
      plus(2, 2),
      minus(9, 3),
      plus(8, 5),
      plus(6, 7),
      plus(6, 7),
      plus(2, 2),
      plus(8, 5),
    ]);
    const lines = mistakeOverview(record, SUNDAY).frequent.map(csLine);
    expect(lines).toEqual(['8 + 5 (4×)', '2 + 2 (2×)', '6 + 7 (2×)']);
  });

  it('příklad s jedinou chybou mezi častými není', () => {
    const record = mistakesOn(SUNDAY, [plus(3, 4), minus(7, 2), minus(7, 2)]);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([
      { first: 7, second: 2, operation: 'minus', mistakes: 2 },
    ]);
    expect(csLine({ first: 7, second: 2, operation: 'minus', mistakes: 2 })).toBe('7 − 2 (2×)');
  });

  it('chyby u stejného příkladu z různých dnů se sečtou', () => {
    const monday = mistakesOn(daysAfter(SUNDAY, -6), [plus(4, 4)]);
    const record = mistakesOn(daysAfter(SUNDAY, -2), [plus(4, 4)], monday);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([
      { first: 4, second: 4, operation: 'plus', mistakes: 2 },
    ]);
  });

  it('chyby starší než 7 dní se nepočítají', () => {
    const old = mistakesOn(daysAfter(SUNDAY, -7), [plus(4, 4), plus(4, 4)]);
    const record = mistakesOn(SUNDAY, [plus(4, 4)], old);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([]);
  });

  it('při stejném počtu chyb je výš příklad, ve kterém se dítě spletlo naposledy', () => {
    const record = mistakesOn(SUNDAY, [plus(1, 2), plus(3, 3), plus(1, 2), plus(3, 3)]);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '3 + 3 (2×)',
      '1 + 2 (2×)',
    ]);
    const later = recordMistake(record, SUNDAY, plus(3, 3));
    const evened = recordMistake(later, SUNDAY, plus(1, 2));
    expect(mistakeOverview(evened, SUNDAY).frequent.map(csLine)).toEqual([
      '1 + 2 (3×)',
      '3 + 3 (3×)',
    ]);
  });

  it('při shodě rozhodne poslední chyba i přes víc dní: dnešní chyba je novější než včerejší', () => {
    const saturday = mistakesOn(daysAfter(SUNDAY, -1), [plus(5, 5), plus(5, 5), plus(2, 3)]);
    const record = mistakesOn(SUNDAY, [plus(2, 3)], saturday);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '2 + 3 (2×)',
      '5 + 5 (2×)',
    ]);
  });

  it('při shodě o 4. místo zůstane mezi třemi ten s novější chybou', () => {
    const record = mistakesOn(SUNDAY, [
      plus(1, 1),
      plus(1, 1),
      plus(2, 2),
      plus(2, 2),
      plus(3, 3),
      plus(3, 3),
      plus(4, 4),
      plus(4, 4),
    ]);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '4 + 4 (2×)',
      '3 + 3 (2×)',
      '2 + 2 (2×)',
    ]);
  });

  it('sčítání a odčítání se stejnými čísly jsou různé příklady', () => {
    const record = mistakesOn(SUNDAY, [plus(6, 3), minus(6, 3), plus(6, 3), minus(6, 3)]);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '6 − 3 (2×)',
      '6 + 3 (2×)',
    ]);
  });

  it('chyby ze hry se uloží a po zavření a novém otevření hry zůstanou', () => {
    const storage = storageWith(KEYPAD_SETTINGS);
    const first = enterOn(storage, { today: SUNDAY });
    untilProblem(first, (problem) => problem.result > 1);
    const problem = solveAfterMistakes(first, 3);
    first.session.leave();
    const again = enterOn(storage, { today: SUNDAY });
    expect(frequentLines(again.session)).toEqual([csLine({ ...problem, mistakes: 3 })]);
  });
});

describe('#184 AC3: řádek časté chyby nevypadá jako výpočet', () => {
  it('česky i anglicky je to příklad a počet chyb v závorce: „8 + 5 (4×)“', () => {
    const mistake = { first: 8, second: 5, operation: 'plus', mistakes: 4 } as const;
    const subtraction = { first: 9, second: 3, operation: 'minus', mistakes: 2 } as const;
    for (const language of ['cs', 'en'] as const) {
      const template = countingTexts(language).mistakes.frequentItem;
      expect(frequentMistakeLine(template, mistake), language).toBe('8 + 5 (4×)');
      expect(frequentMistakeLine(template, subtraction), language).toBe('9 − 3 (2×)');
    }
  });

  it('v řádku není pomlčka ani rovnítko, které by se četly jako počítání', () => {
    const line = csLine({ first: 9, second: 3, operation: 'minus', mistakes: 2 });
    expect(line).not.toMatch(/[–=]/);
    expect(line.match(/−/g)).toHaveLength(1);
  });
});

describe('#184 AC4: bez častých chyb rodič vidí „Bez častých chyb“', () => {
  it('bez chyb nebo jen s jednou chybou na příklad nejsou žádné časté chyby', () => {
    expect(mistakeOverview(EMPTY_MISTAKES, SUNDAY).frequent).toEqual([]);
    const record = mistakesOn(SUNDAY, [plus(1, 1), plus(2, 1), minus(3, 1)]);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([]);
    // Chyby se zapsaly: druhá chyba u stejného příkladu z něj udělá častou.
    const again = recordMistake(record, SUNDAY, minus(3, 1));
    expect(mistakeOverview(again, SUNDAY).frequent).toEqual([
      { first: 3, second: 1, operation: 'minus', mistakes: 2 },
    ]);
  });

  it('nápis je česky „Bez častých chyb“ a anglicky „No frequent mistakes“', () => {
    expect(countingTexts('cs').mistakes.noFrequent).toBe('Bez častých chyb');
    expect(countingTexts('en').mistakes.noFrequent).toBe('No frequent mistakes');
  });
});

// ---------------------------------------------------------------------------
// AC5: nápověda za týden
// ---------------------------------------------------------------------------

describe('#184 AC5: kolikrát dítě za týden použilo nápovědu', () => {
  it('každé ťuknutí na tlačítko nápovědy u nového příkladu přičte 1', () => {
    const test = enterOn(storageWith(KEYPAD_SETTINGS), { today: SUNDAY });
    for (let used = 0; used < 3; used += 1) {
      untilProblem(test, (problem) => problem.first > 0 || problem.second > 0);
      expect(test.session.tapHintButton()).toBe(true);
      test.session.tapAnswer(correctAnswerOf(test.session));
      test.timers.runAll();
    }
    expect(test.session.mistakeOverview().hintsUsed).toBe(3);
  });

  it('druhé ťuknutí u stejného příkladu ani nápověda po 2. chybě se nepřičte', () => {
    const test = enterOn(storageWith(KEYPAD_SETTINGS), { today: SUNDAY });
    untilProblem(test, (problem) => problem.result > 1);
    test.session.tapHintButton();
    test.session.tapHintButton();
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    untilProblem(test, (problem) => problem.result > 1);
    solveAfterMistakes(test, 2);
    expect(test.session.mistakeOverview().hintsUsed).toBe(1);
  });

  it('nápověda se sečte za 7 dní, starší se nepočítá', () => {
    let record = EMPTY_MISTAKES;
    for (const offset of [-8, -7, -6, -3, -3, 0]) {
      record = recordHintUsed(record, daysAfter(SUNDAY, offset));
    }
    expect(mistakeOverview(record, SUNDAY).hintsUsed).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// AC6: velikost záznamu, poškozený záznam, den z budoucnosti
// ---------------------------------------------------------------------------

/**
 * Příklady s nejdelším zápisem („20 − 10“ má v záznamu 5 znaků), kolik
 * se jich za den do záznamu vejde.
 */
function longestProblems(): Problem[] {
  const problems: Problem[] = [];
  for (let first = 20; first >= 10; first -= 1) {
    for (let second = 10; second <= first; second += 1) {
      problems.push(minus(first, second));
    }
  }
  return problems.slice(0, MAX_MISTAKEN_PROBLEMS_PER_DAY);
}

describe('#184 AC6: u každého dne nejvýš 30 příkladů s chybou', () => {
  it('31. příklad s chybou za den vytlačí ten s nejméně chybami, při shodě nejstarší', () => {
    let record = EMPTY_MISTAKES;
    // 30 různých příkladů po jedné chybě, 1 + 0 (nejstarší) nakonec ještě jednou.
    record = mistakesOn(SUNDAY, [plus(1, 0)], record);
    for (let index = 0; index < MAX_MISTAKEN_PROBLEMS_PER_DAY - 1; index += 1) {
      record = recordMistake(record, SUNDAY, plus(2 + Math.floor(index / 5), index % 5));
    }
    record = recordMistake(record, SUNDAY, plus(1, 0));
    const day = record[dayKeyOf(SUNDAY)];
    expect(day?.problems).toHaveLength(MAX_MISTAKEN_PROBLEMS_PER_DAY);

    record = recordMistake(record, SUNDAY, minus(9, 9));
    const after = record[dayKeyOf(SUNDAY)]?.problems ?? [];
    expect(after).toHaveLength(MAX_MISTAKEN_PROBLEMS_PER_DAY);
    const kept = after.map((problem) => `${problem.first}${problem.operation}${problem.second}`);
    // Vypadl 2 + 0 (jedna chyba, nejstarší), 1 + 0 se dvěma chybami zůstal.
    expect(kept).not.toContain('2plus0');
    expect(kept).toContain('1plus0');
    expect(kept).toContain('9minus9');
    expect(kept).toContain('2plus1');
  });

  it('počet chyb u jednoho příkladu za den se zastaví na nejvyšší hodnotě', () => {
    let record = EMPTY_MISTAKES;
    for (let mistake = 0; mistake < MAX_MISTAKES_PER_PROBLEM + 5; mistake += 1) {
      record = recordMistake(record, SUNDAY, plus(8, 5));
    }
    expect(mistakeOverview(record, SUNDAY).frequent[0]?.mistakes).toBe(MAX_MISTAKES_PER_PROBLEM);
  });
});

describe('#184 AC6: záznam má nejvýš 4 kB', () => {
  it('7 dní po 30 příkladech s nejvíc chybami, nejdelšími čísly a nejvyššími počty se vejde do 4 kB', () => {
    let record = EMPTY_MISTAKES;
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = daysAfter(SUNDAY, offset);
      for (const problem of longestProblems()) {
        for (let mistake = 0; mistake < MAX_MISTAKES_PER_PROBLEM; mistake += 1) {
          record = recordMistake(record, date, problem);
        }
      }
      for (let solved = 0; solved < 9999; solved += 1) {
        record = recordSolvedOperation(record, date, 'plus', true);
        record = recordSolvedOperation(record, date, 'minus', true);
        record = recordHintUsed(record, date);
      }
    }
    const saved = serializeMistakes(record);
    expect(byteLength(saved)).toBeLessThanOrEqual(MAX_MISTAKE_RECORD_BYTES);
    expect(Object.keys(record)).toHaveLength(7);
    // Uložený záznam jde přečíst zpátky beze ztráty.
    expect(parseMistakes(saved)).toEqual(record);
  });

  it('uložený záznam ze hry má nejvýš 4 kB i po týdnech hraní s chybami', () => {
    const storage = storageWith({ maxNumber: 20, operations: 'mixed', answerInput: 'keypad' });
    const clock = { today: SUNDAY };
    for (let day = 0; day < 21; day += 1) {
      clock.today = daysAfter(SUNDAY, day);
      const test = enterOn(storage, clock, day);
      for (let index = 0; index < 60; index += 1) {
        solveAfterMistakes(test, index % 4);
      }
      test.session.leave();
    }
    const saved = storage.data.get(MISTAKES_KEY) ?? '';
    expect(saved).not.toBe('');
    expect(byteLength(saved)).toBeLessThanOrEqual(MAX_MISTAKE_RECORD_BYTES);
    expect(Object.keys(parseMistakes(saved)).length).toBeLessThanOrEqual(7);
  });

  it('starší dny se při zápisu zahodí', () => {
    const old = mistakesOn(daysAfter(SUNDAY, -9), [plus(2, 2)]);
    const record = recordMistake(old, SUNDAY, plus(3, 3));
    expect(Object.keys(record)).toEqual([dayKeyOf(SUNDAY)]);
  });
});

describe('#184 AC6: poškozený záznam dá prázdný přehled chyb', () => {
  const day = dayKeyOf(SUNDAY);
  const valid = { p: [2, 1], m: [0, 0], h: 1, w: [['8+5', 2]] };
  const corruptDays: readonly unknown[] = [
    '5',
    [],
    { ...valid, p: [1] },
    { ...valid, p: [1, 2] },
    { ...valid, m: [-1, 0] },
    { ...valid, h: 2.5 },
    { ...valid, h: -1 },
    { ...valid, w: 'nic' },
    { ...valid, w: [['8+5']] },
    { ...valid, w: [['8*5', 2]] },
    { ...valid, w: [['8+5', 0]] },
    { ...valid, w: [['8+5', MAX_MISTAKES_PER_PROBLEM + 1]] },
    { ...valid, w: [['15+9', 2]] },
    { ...valid, w: [['3-5', 2]] },
    { ...valid, w: [['21-1', 2]] },
    { ...valid, w: [['08+5', 2]] },
    {
      ...valid,
      w: [
        ['8+5', 2],
        ['8+5', 1],
      ],
    },
    { ...valid, w: Array.from({ length: 31 }, (_, index) => [`${index % 21}-0`, 1]) },
  ];
  const CORRUPT_RECORDS: readonly string[] = [
    '{',
    'nesmysl',
    'null',
    '42',
    '[]',
    '{"days":[]}',
    '{"days":{"nesmysl":{}}}',
    '{"days":{"2026-02-30":{}}}',
    ...corruptDays.map((value) => JSON.stringify({ days: { [day]: value } })),
  ];

  it('záznam v pořádku se přečte', () => {
    const record = parseMistakes(JSON.stringify({ days: { [day]: valid } }));
    const overview = mistakeOverview(record, SUNDAY);
    expect(overview.frequent.map(csLine)).toEqual(['8 + 5 (2×)']);
    expect(overview.hintsUsed).toBe(1);
  });

  it('každý poškozený záznam dá prázdný přehled bez chyby', () => {
    for (const corrupt of CORRUPT_RECORDS) {
      const overview = mistakeOverview(parseMistakes(corrupt), SUNDAY);
      expect(overview, corrupt).toEqual(NOTHING);
    }
  });

  it('s poškozeným záznamem hra běží a první chyba začne nový záznam', () => {
    for (const corrupt of CORRUPT_RECORDS) {
      const storage = storageWith(KEYPAD_SETTINGS);
      storage.data.set(MISTAKES_KEY, corrupt);
      const test = enterOn(storage, { today: SUNDAY });
      expect(test.session.mistakeOverview(), corrupt).toEqual(NOTHING);
      untilProblem(test, (problem) => problem.result > 1);
      solveAfterMistakes(test, 2);
      const saved = mistakeOverview(parseMistakes(storage.data.get(MISTAKES_KEY)), SUNDAY);
      expect(saved.frequent.length, corrupt).toBe(1);
      expect(saved.frequent[0]?.mistakes, corrupt).toBe(2);
    }
  });

  it('záznam s víc než 7 dny nebo delší než 4 kB je prázdný přehled', () => {
    const days = (count: number): Record<string, unknown> =>
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [dayKeyOf(daysAfter(SUNDAY, -index)), valid]),
      );
    const seven = JSON.stringify({ days: days(7) });
    expect(mistakeOverview(parseMistakes(seven), SUNDAY).hintsUsed).toBe(7);
    expect(mistakeOverview(parseMistakes(JSON.stringify({ days: days(8) })), SUNDAY)).toEqual(
      NOTHING,
    );
    // Platný záznam s mezerami navíc přes 4 kB hra nikdy nezapíše.
    const padded = seven.replace('{', '{' + ' '.repeat(MAX_MISTAKE_RECORD_BYTES));
    expect(JSON.parse(padded)).toEqual(JSON.parse(seven));
    expect(byteLength(padded)).toBeGreaterThan(MAX_MISTAKE_RECORD_BYTES);
    expect(mistakeOverview(parseMistakes(padded), SUNDAY)).toEqual(NOTHING);
  });

  it('chybějící nebo prázdný záznam je prázdný přehled', () => {
    for (const missing of [null, undefined, '']) {
      expect(mistakeOverview(parseMistakes(missing), SUNDAY)).toEqual(NOTHING);
    }
  });
});

describe('#184 AC6: den z budoucnosti se nezapočítá', () => {
  it('chyby uložené se zítřejším datem (hodiny se vrátily) přehled nepočítá', () => {
    const tomorrow = mistakesOn(daysAfter(SUNDAY, 1), [plus(8, 5), plus(8, 5)]);
    const withHint = recordHintUsed(tomorrow, daysAfter(SUNDAY, 1));
    expect(mistakeOverview(withHint, SUNDAY)).toEqual(NOTHING);
  });

  it('den z budoucnosti nepokazí dnešek a při zápisu se zahodí', () => {
    const future = daysAfter(SUNDAY, 3);
    const saved = serializeMistakes(mistakesOn(future, [plus(8, 5), plus(8, 5)]));
    const record = recordMistake(parseMistakes(saved), SUNDAY, plus(2, 2));
    expect(Object.keys(record)).toEqual([dayKeyOf(SUNDAY)]);
    expect(record[dayKeyOf(SUNDAY)]?.problems).toEqual([
      { first: 2, second: 2, operation: 'plus', mistakes: 1 },
    ]);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([]);
  });
});

describe('#184 AC6: plné nebo zakázané úložiště hru nezastaví', () => {
  it('s plným, zakázaným nebo chybějícím úložištěm hra běží a chyby platí do zavření stránky', () => {
    for (const storage of [readOnlyStorage(), brokenStorage(), undefined]) {
      const test = enterOn(storage, { today: SUNDAY });
      untilProblem(test, (problem) => problem.result > 1);
      expect(() => solveAfterMistakes(test, 2)).not.toThrow();
      expect(test.session.mistakeOverview().frequent[0]?.mistakes).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Profily a panel pro rodiče
// ---------------------------------------------------------------------------

describe('#184: každý profil má vlastní přehled chyb', () => {
  it('chyby se ukládají pod vnitřním označením profilu, nikdy s přezdívkou, a se smazáním zmizí', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ZUZANA', color: PROFILE_COLORS[2] });
    store.selectProfile(child.id);
    const test = enterOn(store.gameStorage(COUNTING_META.id), { today: SUNDAY });
    untilProblem(test, (problem) => problem.result > 1);
    solveAfterMistakes(test, 2);

    const keys = [...storage.data.keys()].filter((key) => key.endsWith(MISTAKES_KEY));
    expect(keys).toHaveLength(1);
    expect(profileDataKeys(storage, child.id)).toContain(keys[0]);
    for (const [key, value] of storage.data) {
      if (key.endsWith(MISTAKES_KEY)) {
        expect(key).not.toContain('ZUZANA');
        expect(value).not.toContain('ZUZANA');
      }
    }

    store.selectProfile(keeper.id);
    const other = enterOn(store.gameStorage(COUNTING_META.id), { today: SUNDAY });
    expect(other.session.mistakeOverview()).toEqual(NOTHING);
    expect(store.deleteProfile(child.id)).toBe(true);
    expect([...storage.data.keys()].some((key) => key.endsWith(MISTAKES_KEY))).toBe(false);
  });
});

describe('#184: stránka Chyby je v přehledu pro rodiče', () => {
  const panel = openParentPanel(openSettings({ open: false }, KEYPAD_SETTINGS));

  it('z přehledu tlačítkem Chyby rodič otevře chyby a Zpět ho vrátí do přehledu', () => {
    const overview = showOverview(panel);
    const mistakes = showMistakes(overview);
    expect(mistakes.view).toBe('mistakes');
    expect(backToOverview(mistakes).view).toBe('overview');
    expect(backToSettings(backToOverview(mistakes)).session).toEqual(panel.session);
  });

  it('chyby jdou otevřít jen z přehledu a nastavení se z nich nepotvrdí', () => {
    expect(showMistakes(panel).view).toBe('settings');
    expect(canConfirmSettings(showMistakes(showOverview(panel)))).toBe(false);
  });

  it('podívat se na chyby nic nepřičte ani neuloží', () => {
    const storage = storageWith(KEYPAD_SETTINGS);
    const test = enterOn(storage, { today: SUNDAY });
    untilProblem(test, (problem) => problem.result > 1);
    solveAfterMistakes(test, 2);
    const before = storage.data.get(MISTAKES_KEY);
    const overview = test.session.mistakeOverview();
    expect(test.session.mistakeOverview()).toEqual(overview);
    expect(storage.data.get(MISTAKES_KEY)).toBe(before);
  });
});
