import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke } from '../../../src/games/counting/logic/digitRecognition';
import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import {
  MAX_MISTAKES_PER_PROBLEM,
  MAX_MISTAKE_RECORD_BYTES,
  mistakeOverview as sharedMistakeOverview,
  parseMistakes as sharedParseMistakes,
} from '../../../src/shared/logic/mistakeActivity';
import type {
  MistakeOverview,
  MistakeRecord,
  MistakenProblem,
} from '../../../src/shared/logic/mistakeActivity';
import { equationKey } from '../../../src/shared/logic/overviewProblems';
import type { OverviewOperation } from '../../../src/shared/logic/overviewProblems';
import { frequentMistakeLine } from '../../../src/menu/logic/overviewLines';
import { overviewTexts } from '../../../src/menu/logic/menuTexts';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { serializeSettings } from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { dayKeyOf } from '../../../src/shared/logic/weekActivity';
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
import { MISTAKES_KEY, readGameOverview } from '../../../src/shared/storage/activityStorage';
import { COUNTING_META, COUNTING_OVERVIEW } from '../../../src/games/counting/meta';
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
 * „dnes“ dostane hra zvenku (`today`).
 *
 * Od #192 je přehled v hlavním menu: co rodič uvidí, čte menu z úložiště
 * hry přes sdílenou logiku (`readGameOverview`), stejně to čtou i tyto
 * testy. Záznam chyb je ve sdílené části společný pro hry, příklad je
 * v něm krátký text („8+5“); testy volají sdílenou logiku s popisem
 * přehledu Počítání z `meta.ts`. Obrazovka přehledu v menu je
 * v `tests/menu/parentOverview*.test.ts`.
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

const MIXED_KEYPAD: GameSettings = { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' };
const WRITING_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

// Sdílená logika s popisem přehledu Počítání, jak ji používá menu (#192).
function mistakeOverview(record: MistakeRecord, date: Date): MistakeOverview {
  return sharedMistakeOverview(record, date, COUNTING_OVERVIEW);
}

function parseMistakes(saved: string | null | undefined): MistakeRecord {
  return sharedParseMistakes(saved, COUNTING_OVERVIEW);
}

/** Příklad s `mistakes` chybami, jak ho přehled vrátí. */
function mistaken(
  first: number,
  second: number,
  operation: OverviewOperation,
  mistakes: number,
): MistakenProblem {
  return { problem: equationKey(first, operation, second), mistakes };
}

/** Vstup do hry, ve kterém se dá podívat, co rodič v přehledu v menu uvidí. */
type OverviewTest = TestSession & {
  /** Přehled chyb, jak ho menu přečte z úložiště hry (#192). */
  mistakes(): MistakeOverview;
};

/** Jeden vstup do Počítání nad úložištěm `storage` s dnešním dnem podle `clock`. */
function enterOn(
  storage: KeyValueStorage | undefined,
  clock: { today: Date },
  seed?: number,
): OverviewTest {
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
  return {
    session,
    timers,
    recognizer,
    changes: () => 0,
    mistakes: () => readGameOverview(storage, COUNTING_OVERVIEW, clock.today).mistakes,
  };
}

/** Úložiště s uloženým nastavením rodiče. */
function storageWith(settings: GameSettings): ReturnType<typeof memoryStorage> {
  return memoryStorage(serializeSettings(settings));
}

/** Dítě odpoví `times`krát špatně a pak správně. */
function solveAfterMistakes(test: OverviewTest, times: number): Problem {
  const problem = test.session.problem();
  for (let mistake = 0; mistake < times; mistake += 1) {
    test.session.tapAnswer(wrongAnswerOf(test.session));
  }
  test.session.tapAnswer(correctAnswerOf(test.session));
  test.timers.runAll();
  return problem;
}

/** Dítě řeší příklady napoprvé, dokud nedostane příklad, který splní `wanted`. */
function untilProblem(test: OverviewTest, wanted: (problem: Problem) => boolean): void {
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
  return frequentMistakeLine(overviewTexts('cs').frequentItem, mistake.problem, mistake.mistakes);
}

/** Text řádku s častou chybou, jak ho rodič uvidí. */
function frequentLines(test: OverviewTest): string[] {
  return test.mistakes().frequent.map(csLine);
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
    expect(test.mistakes().frequent).toEqual([
      mistaken(problem.first, problem.second, problem.operation, 2),
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
    expect(test.mistakes().frequent).toEqual([]);
    // Ani jediná chyba se neuložila, jen vyřešené příklady a nápověda.
    const saved = parseMistakes(storage.data.get(MISTAKES_KEY))[dayKeyOf(SUNDAY)];
    expect(saved?.problems).toEqual([]);
    expect(test.mistakes().hintsUsed).toBe(1);
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

    const overview = test.mistakes();
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
    expect(test.mistakes().frequent).toEqual([mistaken(problem.first, problem.second, 'plus', 2)]);
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
    const overview = test.mistakes();
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
    expect(test.mistakes().operations).toEqual([
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
    const operations = test.mistakes().operations;
    expect(operations.map((share) => share.operation)).toEqual(['plus', 'minus']);
    expect(operations.map(({ solved, firstTry }) => ({ solved, firstTry }))).toEqual([
      counted.plus,
      counted.minus,
    ]);
  });

  it('příklad s nápovědou z tlačítka se nepočítá jako napoprvé, stejně jako v přehledu', () => {
    const test = enterOn(storageWith(KEYPAD_SETTINGS), { today: SUNDAY });
    untilProblem(test, (problem) => problem.first > 0 || problem.second > 0);
    const before = test.mistakes().operations[0] ?? { solved: 0, firstTry: 0 };
    expect(test.session.tapHintButton()).toBe(true);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    const after = test.mistakes().operations[0];
    expect(after?.solved).toBe(before.solved + 1);
    expect(after?.firstTry).toBe(before.firstTry);
  });
});

// ---------------------------------------------------------------------------
// AC3 a AC4: nejčastější chyby
// ---------------------------------------------------------------------------

describe('#184 AC3: nejvýš 3 příklady s nejvíc chybami za 7 dní', () => {
  it('chyby ze hry se uloží a po zavření a novém otevření hry zůstanou', () => {
    const storage = storageWith(KEYPAD_SETTINGS);
    const first = enterOn(storage, { today: SUNDAY });
    untilProblem(first, (problem) => problem.result > 1);
    const problem = solveAfterMistakes(first, 3);
    first.session.leave();
    const again = enterOn(storage, { today: SUNDAY });
    expect(frequentLines(again)).toEqual([
      csLine(mistaken(problem.first, problem.second, problem.operation, 3)),
    ]);
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
    expect(test.mistakes().hintsUsed).toBe(3);
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
    expect(test.mistakes().hintsUsed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC6: velikost záznamu, poškozený záznam, den z budoucnosti
// ---------------------------------------------------------------------------

describe('#184 AC6: záznam má nejvýš 4 kB', () => {
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
      expect(test.mistakes(), corrupt).toEqual(NOTHING);
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
});

describe('#184 AC6: plné nebo zakázané úložiště hru nezastaví', () => {
  it('s plným, zakázaným nebo chybějícím úložištěm hra běží a chyby platí do zavření stránky', () => {
    for (const storage of [readOnlyStorage(), brokenStorage(), undefined]) {
      const test = enterOn(storage, { today: SUNDAY });
      untilProblem(test, (problem) => problem.result > 1);
      expect(() => solveAfterMistakes(test, 2)).not.toThrow();
    }
    // Menu čte úložiště profilu, které neuložené hodnoty drží do zavření stránky (#192).
    for (const fail of ['plné', 'zakázané'] as const) {
      const device = new DeviceStorage();
      const store = openProfiles(device);
      device.failWrite = () => true;
      device.failReads = fail === 'zakázané';
      const test = enterOn(store.gameStorage(COUNTING_META.id), { today: SUNDAY });
      untilProblem(test, (problem) => problem.result > 1);
      expect(() => solveAfterMistakes(test, 2)).not.toThrow();
      expect(test.mistakes().frequent[0]?.mistakes, fail).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Profily
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
    expect(other.mistakes()).toEqual(NOTHING);
    expect(store.deleteProfile(child.id)).toBe(true);
    expect([...storage.data.keys()].some((key) => key.endsWith(MISTAKES_KEY))).toBe(false);
  });
});

describe('#184, #192: podívat se na chyby nic nemění', () => {
  it('podívat se na chyby nic nepřičte ani neuloží', () => {
    const storage = storageWith(KEYPAD_SETTINGS);
    const test = enterOn(storage, { today: SUNDAY });
    untilProblem(test, (problem) => problem.result > 1);
    solveAfterMistakes(test, 2);
    const before = storage.data.get(MISTAKES_KEY);
    const overview = test.mistakes();
    expect(test.mistakes()).toEqual(overview);
    expect(storage.data.get(MISTAKES_KEY)).toBe(before);
  });
});
