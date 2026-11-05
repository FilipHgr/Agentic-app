import { describe, expect, it } from 'vitest';

import {
  isHintVisible,
  problemText,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import type { Stroke } from '../../../src/games/counting/logic/digitRecognition';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  START_PROGRESS,
  parseProgress,
  serializeProgress,
} from '../../../src/games/counting/logic/progress';
import type { GameProgress } from '../../../src/games/counting/logic/progress';
import { createStarProgress, starsAfterTap } from '../../../src/games/counting/logic/stars';
import {
  boxDigit,
  boxFadingStrokes,
  boxStrokes,
  canConfirmBoxes,
  clearBoxes,
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  updateBoxes,
} from '../../../src/games/counting/logic/twoBoxWriting';
import type { TwoBoxRound, WritingBox } from '../../../src/games/counting/logic/twoBoxWriting';
import {
  RECOGNITION_DELAY_MS,
  REJECTED_FADE_MS,
} from '../../../src/games/counting/logic/writingRound';

/**
 * Testy k #42 (psaní odpovědi prstem do dvou okének): jak hra skládá číslo
 * z okénka desítek (vlevo) a jednotek (vpravo), odmítnutí v jednom okénku,
 * smazání a vyhodnocení potvrzené odpovědi. Čas se předává jako číslo v ms.
 * Rozpoznávání je podvržené jako v `writingRound.test.ts`: každý testovací
 * tah nese značku, kterou podvržené rozpoznávání vrátí jako číslici. Jak
 * dobře hra pozná skutečný zápis, měří `twoDigitRecognition.test.ts`.
 */

/** Velikost jednoho okénka (AC7: aspoň 280 × 280 px). */
const BOX_AREA = { width: 280, height: 280 } as const;

const TENS: WritingBox = 'tens';
const ONES: WritingBox = 'ones';

/** Značka tahu, který podvržené rozpoznávání odmítne (tečka, čárka, čmáranice). */
const NOT_A_DIGIT = -1;

/** Tah, který podvržené rozpoznávání přečte jako `digit` (nebo odmítne). */
function strokeFor(digit: number): Stroke {
  return [
    { x: 100, y: 100 },
    { x: 150, y: 200 },
    { x: 200, y: 250 + digit },
  ];
}

/** Číslice, kterou nese tah ze `strokeFor`. */
function markOf(stroke: Stroke | undefined): number | undefined {
  const last = stroke?.[2];
  return last === undefined ? undefined : last.y - 250;
}

interface FakeRecognizer {
  (strokes: readonly Stroke[], area: { width: number; height: number }): number | null;
  /** Kolik tahů dostalo rozpoznávání při každém zavolání. */
  readonly calls: number[];
}

/** Podvržené rozpoznávání: přečte značku posledního tahu v okénku. */
function fakeRecognizer(): FakeRecognizer {
  const calls: number[] = [];
  const recognize = (strokes: readonly Stroke[]): number | null => {
    calls.push(strokes.length);
    const mark = markOf(strokes[strokes.length - 1]);
    return mark === undefined || mark === NOT_A_DIGIT ? null : mark;
  };
  return Object.assign(recognize, { calls });
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Kolo s pevným příkladem, aby testy nezávisely na náhodě. */
function answerRoundFor(problem: Problem, maxNumber = 20): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 0, solved: false };
}

function roundFor(problem: Problem, maxNumber = 20, recognize = fakeRecognizer()): TwoBoxRound {
  return createTwoBoxRound(answerRoundFor(problem, maxNumber), BOX_AREA, recognize);
}

/** Dítě položí prst do okénka `box` v `startMs`, napíše `digit` a zvedne prst v `endMs`. */
function write(
  round: TwoBoxRound,
  box: WritingBox,
  digit: number,
  startMs: number,
  endMs: number,
): TwoBoxRound {
  return finishBoxStroke(startBoxStroke(round, box, startMs), strokeFor(digit), endMs);
}

/**
 * Napíše číslo jako dítě: nejdřív desítky (když jsou), pak jednotky (když
 * jsou), a počká, až se obě okénka rozpoznají. `null` = okénko zůstane prázdné.
 */
function writeNumber(
  round: TwoBoxRound,
  tens: number | null,
  ones: number | null,
  startMs: number,
): TwoBoxRound {
  let current = round;
  let lastEndMs = startMs;
  if (tens !== null) {
    current = write(current, TENS, tens, startMs, startMs + 300);
    lastEndMs = startMs + 300;
  }
  if (ones !== null) {
    current = write(current, ONES, ones, startMs + 400, startMs + 700);
    lastEndMs = startMs + 700;
  }
  return updateBoxes(current, lastEndMs + RECOGNITION_DELAY_MS);
}

/** Napíše číslo, počká na rozpoznání a ťukne na ✓. */
function writeAndConfirm(
  round: TwoBoxRound,
  tens: number | null,
  ones: number | null,
  startMs: number,
) {
  return confirmBoxes(writeNumber(round, tens, ones, startMs));
}

function expectBothBoxesEmpty(round: TwoBoxRound): void {
  for (const box of [TENS, ONES]) {
    expect(boxStrokes(round, box)).toEqual([]);
    expect(boxDigit(round, box)).toBeNull();
  }
  expect(shownNumber(round)).toBeNull();
}

describe('AC1: dvě okénka platí i pro výsledek 0–9', () => {
  it('nové kolo má obě okénka prázdná a ✓ ještě nejde', () => {
    const round = roundFor(plus(3, 4), 10);

    expectBothBoxesEmpty(round);
    expect(canConfirmBoxes(round)).toBe(false);
  });

  it('u příkladu s jednociferným výsledkem stačí napsat číslici do okénka jednotek', () => {
    const result = writeAndConfirm(roundFor(plus(3, 4), 10), null, 7, 0);

    expect(result.outcome).toBe('correct');
  });
});

describe('AC2: hra skládá číslo z okénka desítek a okénka jednotek', () => {
  it('„1“ vlevo a „5“ vpravo dá číslo 15', () => {
    const round = writeNumber(roundFor(plus(8, 7)), 1, 5, 0);

    expect(boxDigit(round, TENS)).toBe(1);
    expect(boxDigit(round, ONES)).toBe(5);
    expect(shownNumber(round)).toBe(15);
    expect(canConfirmBoxes(round)).toBe(true);
  });

  it('„2“ vlevo a „0“ vpravo dá číslo 20', () => {
    expect(shownNumber(writeNumber(roundFor(plus(12, 8)), 2, 0, 0))).toBe(20);
  });

  it('číslice jen v okénku jednotek dá jednociferné číslo', () => {
    const round = writeNumber(roundFor(plus(3, 4)), null, 7, 0);

    expect(shownNumber(round)).toBe(7);
    expect(canConfirmBoxes(round)).toBe(true);
  });

  it('číslice jen v okénku desítek dá taky jednociferné číslo', () => {
    const round = writeNumber(roundFor(plus(3, 4)), 7, null, 0);

    expect(shownNumber(round)).toBe(7);
    expect(confirmBoxes(round).outcome).toBe('correct');
  });

  it('nula v desítkách se neukáže: „0“ a „7“ je 7', () => {
    const round = writeNumber(roundFor(plus(3, 4)), 0, 7, 0);

    expect(shownNumber(round)).toBe(7);
    expect(confirmBoxes(round).outcome).toBe('correct');
  });

  it('samotná nula v kterémkoli okénku i „0“ a „0“ je výsledek 0', () => {
    for (const [tens, ones] of [
      [0, null],
      [null, 0],
      [0, 0],
    ] as const) {
      const round = writeNumber(roundFor(minus(5, 5)), tens, ones, 0);

      expect(shownNumber(round)).toBe(0);
      expect(confirmBoxes(round).outcome).toBe('correct');
    }
  });

  it('každé okénko se rozpozná zvlášť přesně 1 s poté, co v něm dítě zvedne prst', () => {
    // Desítky: prst nahoru v 300 ms. Jednotky: prst nahoru v 900 ms.
    let round = write(roundFor(plus(8, 7)), TENS, 1, 0, 300);
    round = write(round, ONES, 5, 600, 900);

    round = updateBoxes(round, 1299);
    expect(boxDigit(round, TENS)).toBeNull();
    expect(boxDigit(round, ONES)).toBeNull();

    round = updateBoxes(round, 1300);
    expect(boxDigit(round, TENS)).toBe(1);
    expect(boxDigit(round, ONES)).toBeNull();

    round = updateBoxes(round, 1899);
    expect(boxDigit(round, ONES)).toBeNull();

    round = updateBoxes(round, 1900);
    expect(boxDigit(round, ONES)).toBe(5);
    expect(shownNumber(round)).toBe(15);
  });

  it('okénko se rozpozná 1 s po posledním tahu, který do něj patří', () => {
    // Desítky: dva tahy, poslední skončí v 800 ms.
    let round = write(roundFor(plus(8, 7)), TENS, 1, 0, 300);
    round = write(round, TENS, 1, 500, 800);

    expect(boxDigit(updateBoxes(round, 1799), TENS)).toBeNull();
    expect(boxDigit(updateBoxes(round, 1800), TENS)).toBe(1);
  });

  it('✓ nereaguje, dokud druhé okénko čeká na rozpoznání, a není to chyba', () => {
    let round = write(roundFor(plus(8, 7)), TENS, 1, 0, 300);
    round = write(round, ONES, 5, 600, 900);
    round = updateBoxes(round, 1300);
    expect(boxDigit(round, TENS)).toBe(1);

    expect(canConfirmBoxes(round)).toBe(false);
    const result = confirmBoxes(round);
    expect(result.outcome).toBe('ignored');
    expect(result.round.answer.wrongAnswers).toBe(0);
    expect(result.round.answer.solved).toBe(false);
  });

  it('dokud má dítě prst na kterémkoli okénku, nic se nerozpozná', () => {
    // Desítky dopsané v 300 ms, pak prst na jednotkách od 500 do 2000 ms.
    let round = write(roundFor(plus(8, 7)), TENS, 1, 0, 300);
    round = startBoxStroke(round, ONES, 500);

    round = updateBoxes(round, 1500);
    expect(boxDigit(round, TENS)).toBeNull();
    expect(shownNumber(round)).toBeNull();

    round = finishBoxStroke(round, strokeFor(5), 2000);
    round = updateBoxes(round, 3000);
    expect(boxDigit(round, TENS)).toBe(1);
    expect(boxDigit(round, ONES)).toBe(5);
    expect(shownNumber(round)).toBe(15);
  });

  it('dokud má dítě prst na okénku, ✓ nereaguje ani s číslicí ve druhém okénku', () => {
    let round = writeNumber(roundFor(plus(3, 4)), 7, null, 0);
    expect(canConfirmBoxes(round)).toBe(true);

    round = startBoxStroke(round, ONES, 3000);

    expect(canConfirmBoxes(round)).toBe(false);
    const result = confirmBoxes(round);
    expect(result.outcome).toBe('ignored');
    expect(result.round.answer.wrongAnswers).toBe(0);
  });

  it('tah patří okénku, ve kterém začal, i když prst přejede do druhého', () => {
    // Tah začne v okénku desítek a skončí daleko vpravo, za jeho okrajem.
    const longStroke: Stroke = strokeFor(1).map((point) => ({ x: point.x + 300, y: point.y }));
    let round = startBoxStroke(roundFor(plus(8, 7)), TENS, 0);
    round = finishBoxStroke(round, longStroke, 300);
    round = updateBoxes(round, 1300);

    expect(boxStrokes(round, TENS)).toHaveLength(1);
    expect(boxStrokes(round, ONES)).toEqual([]);
    expect(boxDigit(round, TENS)).toBe(1);
    expect(boxDigit(round, ONES)).toBeNull();
  });

  it('každé okénko se rozpoznává jen ze svých tahů', () => {
    const recognize = fakeRecognizer();
    let round = write(roundFor(plus(8, 7), 20, recognize), TENS, 1, 0, 300);
    round = write(round, ONES, 2, 400, 600);
    round = write(round, ONES, 5, 700, 900);
    round = updateBoxes(round, 1900);

    expect(boxStrokes(round, TENS)).toHaveLength(1);
    expect(boxStrokes(round, ONES)).toHaveLength(2);
    expect([...recognize.calls].sort()).toEqual([1, 2]);
    expect(shownNumber(round)).toBe(15);
  });

  it('nový tah do okénka s číslicí smaže jen jeho číslici, druhé okénko zůstane', () => {
    let round = writeNumber(roundFor(plus(9, 8)), 1, 5, 0);
    expect(shownNumber(round)).toBe(15);

    round = startBoxStroke(round, ONES, 3000);
    expect(boxDigit(round, ONES)).toBeNull();
    expect(boxDigit(round, TENS)).toBe(1);

    round = finishBoxStroke(round, strokeFor(7), 3300);
    expect(boxDigit(updateBoxes(round, 4299), ONES)).toBeNull();

    round = updateBoxes(round, 4300);
    expect(boxDigit(round, ONES)).toBe(7);
    expect(boxDigit(round, TENS)).toBe(1);
    expect(shownNumber(round)).toBe(17);
    expect(confirmBoxes(round).outcome).toBe('correct');
  });

  it('když jsou obě okénka prázdná, ✓ nereaguje', () => {
    const empty = roundFor(plus(3, 4));

    expect(shownNumber(empty)).toBeNull();
    expect(canConfirmBoxes(empty)).toBe(false);
    const result = confirmBoxes(updateBoxes(empty, 10_000));
    expect(result.outcome).toBe('ignored');
    expect(result.round.answer.wrongAnswers).toBe(0);
  });

  it('bez tahů se nic nerozpoznává ani po dlouhé době', () => {
    const recognize = fakeRecognizer();
    const later = updateBoxes(roundFor(plus(3, 4), 20, recognize), 10_000);

    expect(shownNumber(later)).toBeNull();
    expect(recognize.calls).toEqual([]);
  });
});

describe('AC3: odmítnutí v jednom okénku, smazání a dvě číslice v okénku', () => {
  it('odmítnutý zápis vybledne jen ve svém okénku, druhé okénko zůstane', () => {
    let round = write(roundFor(plus(3, 4)), TENS, 1, 0, 300);
    round = write(round, ONES, NOT_A_DIGIT, 400, 700);
    const rejectedAt = 1700;
    round = updateBoxes(round, rejectedAt);

    expect(boxDigit(round, ONES)).toBeNull();
    expect(boxStrokes(round, ONES)).toEqual([]);
    expect(boxFadingStrokes(round, ONES)).toHaveLength(1);

    expect(boxDigit(round, TENS)).toBe(1);
    expect(boxStrokes(round, TENS)).toHaveLength(1);
    expect(boxFadingStrokes(round, TENS)).toEqual([]);

    const gone = updateBoxes(round, rejectedAt + REJECTED_FADE_MS);
    expect(boxFadingStrokes(gone, ONES)).toEqual([]);
    expect(boxDigit(gone, TENS)).toBe(1);
  });

  it('odmítnutí v desítkách nechá číslici v jednotkách', () => {
    let round = write(roundFor(plus(3, 4)), TENS, NOT_A_DIGIT, 0, 300);
    round = write(round, ONES, 7, 400, 700);
    round = updateBoxes(round, 1700);

    expect(boxFadingStrokes(round, TENS)).toHaveLength(1);
    expect(boxFadingStrokes(round, ONES)).toEqual([]);
    expect(shownNumber(round)).toBe(7);
  });

  it('jedno okénko odmítnuté a ve druhém číslice: ✓ potvrdí tu jednu číslici', () => {
    const onesOnly = writeAndConfirm(roundFor(plus(3, 4)), NOT_A_DIGIT, 7, 0);
    expect(onesOnly.outcome).toBe('correct');

    const tensOnly = writeAndConfirm(roundFor(plus(3, 4)), 7, NOT_A_DIGIT, 0);
    expect(tensOnly.outcome).toBe('correct');
  });

  it('odmítnutí v obou okénkách není odpověď ani chyba a ✓ nereaguje', () => {
    const round = writeNumber(roundFor(plus(3, 4)), NOT_A_DIGIT, NOT_A_DIGIT, 0);

    expect(shownNumber(round)).toBeNull();
    expect(canConfirmBoxes(round)).toBe(false);
    const result = confirmBoxes(round);
    expect(result.outcome).toBe('ignored');
    expect(result.round.answer.wrongAnswers).toBe(0);
  });

  it('do okénka, které právě bledne, jde hned psát znovu', () => {
    const recognize = fakeRecognizer();
    let round = write(roundFor(plus(3, 4), 20, recognize), ONES, NOT_A_DIGIT, 0, 300);
    round = updateBoxes(round, 1300);

    // Nový tah začne ještě během blednutí.
    round = updateBoxes(write(round, ONES, 7, 1300, 1500), 2500);

    expect(shownNumber(round)).toBe(7);
    expect(recognize.calls[recognize.calls.length - 1]).toBe(1);
    expect(confirmBoxes(round).outcome).toBe('correct');
  });

  it('ani mnoho odmítnutých zápisů nepřiblíží nápovědu', () => {
    let round = roundFor(plus(3, 4));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const box = attempt % 2 === 0 ? TENS : ONES;
      const start = attempt * 3000;
      round = updateBoxes(write(round, box, NOT_A_DIGIT, start, start + 200), start + 1200);
    }

    expect(round.answer.wrongAnswers).toBe(0);
    expect(isHintVisible(round.answer)).toBe(false);
  });

  it('smazání vyprázdní obě okénka a není to chyba', () => {
    const cleared = clearBoxes(writeNumber(roundFor(plus(8, 7)), 1, 2, 0));

    expectBothBoxesEmpty(cleared);
    expect(canConfirmBoxes(cleared)).toBe(false);
    expect(cleared.answer.wrongAnswers).toBe(0);
    expect(isHintVisible(cleared.answer)).toBe(false);
  });

  it('smazání zruší čekající rozpoznání v obou okénkách', () => {
    const recognize = fakeRecognizer();
    let round = write(roundFor(plus(8, 7), 20, recognize), TENS, 1, 0, 300);
    round = write(round, ONES, 5, 400, 700);

    const cleared = updateBoxes(clearBoxes(round), 5000);

    expectBothBoxesEmpty(cleared);
    expect(recognize.calls).toEqual([]);
  });

  it('ani mnohokrát smazané špatné číslo nepřiblíží nápovědu', () => {
    let round = roundFor(plus(8, 7));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      round = clearBoxes(writeNumber(round, 1, attempt % 2 === 0 ? 2 : 3, attempt * 5000));
    }

    expect(round.answer.wrongAnswers).toBe(0);
    expect(isHintVisible(round.answer)).toBe(false);
  });

  it('po smazání jde napsat a potvrdit správnou odpověď', () => {
    let round = clearBoxes(writeNumber(roundFor(minus(17, 3)), 1, 9, 0));
    round = writeNumber(round, 1, 4, 5000);

    expect(confirmBoxes(round).outcome).toBe('correct');
  });
});

describe('AC4: potvrzená odpověď se vyhodnotí jako na číselníku', () => {
  it('za správné dvouciferné číslo dostane dítě hvězdičku', () => {
    const result = writeAndConfirm(roundFor(plus(8, 7)), 1, 5, 0);

    expect(result.outcome).toBe('correct');
    expect(result.round.answer.solved).toBe(true);
    const stars = starsAfterTap(createStarProgress(), result.outcome);
    expect(stars.starEarned).toBe(true);
    expect(stars.progress.earned).toBe(1);
  });

  it('po správné odpovědi se v příkladu ukáže výsledek jako na číselníku', () => {
    const written = writeAndConfirm(roundFor(minus(19, 6)), 1, 3, 0).round;
    const tapped = tapAnswer(answerRoundFor(minus(19, 6)), 13).round;

    expect(problemText(written.answer)).toEqual(problemText(tapped));
    expect(problemText(written.answer).answer).toBe('13');
    expect(problemText(written.answer).answerRevealed).toBe(true);
  });

  it('při rozsahu 10 jde napsat výsledek 10', () => {
    const result = writeAndConfirm(roundFor(plus(6, 4), 10), 1, 0, 0);

    expect(result.outcome).toBe('correct');
    expect(problemText(result.round.answer).answer).toBe('10');
  });

  it('při rozsahu 20 jde napsat výsledek 20', () => {
    expect(writeAndConfirm(roundFor(plus(11, 9)), 2, 0, 0).outcome).toBe('correct');
  });

  it('hvězdička za psaní se uloží, rozepsané tahy se neukládají', () => {
    const result = writeAndConfirm(roundFor(plus(8, 7)), 1, 5, 0);
    const stars = starsAfterTap(START_PROGRESS, result.outcome);
    const progress: GameProgress = { ...START_PROGRESS, earned: stars.progress.earned };

    const saved = serializeProgress(progress);

    expect(parseProgress(saved)).toEqual({ earned: 1 });
    expect(Object.keys(JSON.parse(saved) as object)).toEqual(['earned']);
  });

  it('špatné číslo je chyba, hvězdičku nedá a obě okénka se vyprázdní', () => {
    const result = writeAndConfirm(roundFor(plus(8, 7)), 1, 4, 0);

    expect(result.outcome).toBe('wrong');
    expect(result.round.answer.wrongAnswers).toBe(1);
    expect(result.round.answer.solved).toBe(false);
    expect(starsAfterTap(createStarProgress(), result.outcome).starEarned).toBe(false);
    expect(problemText(result.round.answer).answer).toBe('?');
    expectBothBoxesEmpty(result.round);
    expect(canConfirmBoxes(result.round)).toBe(false);
  });

  it('jednociferná odpověď na dvouciferný výsledek je obyčejná chyba', () => {
    const result = writeAndConfirm(roundFor(plus(8, 7)), null, 5, 0);

    expect(result.outcome).toBe('wrong');
    expect(result.round.answer.wrongAnswers).toBe(1);
  });

  it('číslo mimo číselník (35) je obyčejná špatná odpověď, ne ignorované ťuknutí', () => {
    const result = writeAndConfirm(roundFor(plus(12, 3)), 3, 5, 0);

    expect(result.outcome).toBe('wrong');
    expect(result.round.answer.wrongAnswers).toBe(1);
    expectBothBoxesEmpty(result.round);
  });

  it('číslo nad rozsahem 10 (např. 18) je při rozsahu 10 obyčejná chyba', () => {
    const result = writeAndConfirm(roundFor(plus(5, 3), 10), 1, 8, 0);

    expect(result.outcome).toBe('wrong');
    expect(result.round.answer.wrongAnswers).toBe(1);
  });

  it('po 1. chybě nápověda ještě není, po 2. chybě se ukážou tečky', () => {
    const first = writeAndConfirm(roundFor(plus(8, 7)), 1, 4, 0).round;
    expect(isHintVisible(first.answer)).toBe(false);

    const second = writeAndConfirm(first, 1, 6, 3000).round;
    expect(second.answer.wrongAnswers).toBe(2);
    expect(isHintVisible(second.answer)).toBe(true);
  });

  it('chyby při psaní se počítají stejně jako ťuknutí na číselníku', () => {
    let written = roundFor(plus(8, 7));
    let tapped = answerRoundFor(plus(8, 7));
    const attempts: [number, number][] = [
      [1, 4],
      [1, 6],
      [1, 5],
    ];
    for (const [index, [tens, ones]] of attempts.entries()) {
      const writtenResult = writeAndConfirm(written, tens, ones, index * 3000);
      const tappedResult = tapAnswer(tapped, tens * 10 + ones);
      written = writtenResult.round;
      tapped = tappedResult.round;

      expect(writtenResult.outcome).toBe(tappedResult.outcome);
      expect(written.answer.wrongAnswers).toBe(tapped.wrongAnswers);
      expect(isHintVisible(written.answer)).toBe(isHintVisible(tapped));
    }
  });

  it('po vyřešení se další ✓ ignoruje', () => {
    const solved = writeAndConfirm(roundFor(plus(8, 7)), 1, 5, 0).round;

    const again = confirmBoxes(solved);
    expect(again.outcome).toBe('ignored');
    expect(starsAfterTap(createStarProgress(), again.outcome).starEarned).toBe(false);

    const otherNumber = confirmBoxes(writeNumber(clearBoxes(solved), 1, 2, 3000));
    expect(otherNumber.outcome).toBe('ignored');
    expect(otherNumber.round.answer.solved).toBe(true);
    expect(otherNumber.round.answer.wrongAnswers).toBe(0);
    expect(problemText(otherNumber.round.answer).answer).toBe('15');
  });
});
