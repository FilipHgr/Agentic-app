import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
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
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { createStarProgress, starsAfterTap } from '../../../src/games/counting/logic/stars';
import {
  RECOGNITION_DELAY_MS,
  REJECTED_FADE_MS,
  canConfirm,
  clearWriting,
  confirmWriting,
  createWritingRound,
  fadingStrokes,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  writtenStrokes,
} from '../../../src/games/counting/logic/writingRound';
import type { WritingRound } from '../../../src/games/counting/logic/writingRound';

import { seededRandom } from './seededRandom';

/**
 * Testy k #41 (psaní odpovědi prstem): průběh jednoho kola s psaním.
 * Čas se předává jako číslo v ms, žádné skutečné časovače. Rozpoznávání
 * je podvržené, aby testy nezávisely na tom, jak dobře pozná číslici
 * (to měří `digitRecognition.slow.test.ts`): každý testovací tah nese značku,
 * kterou podvržené rozpoznávání vrátí jako číslici.
 */

const AREA = { width: 320, height: 320 } as const;

/** Značka tahu, který podvržené rozpoznávání odmítne (není to číslice). */
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

/** Podvržené rozpoznávání: přečte značku posledního tahu. */
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
function answerRoundFor(problem: Problem, maxNumber = 10): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 0, solved: false };
}

function roundFor(problem: Problem, recognize = fakeRecognizer()): WritingRound {
  return createWritingRound(answerRoundFor(problem), AREA, recognize);
}

/** Dítě položí prst v `startMs`, napíše `digit` a zvedne prst v `endMs`. */
function write(round: WritingRound, digit: number, startMs: number, endMs: number): WritingRound {
  return finishStroke(startStroke(round, startMs), strokeFor(digit), endMs);
}

/** Napíše číslici, počká na její ukázání a vrátí kolo s ukázanou číslicí. */
function writeAndWait(round: WritingRound, digit: number, startMs: number): WritingRound {
  const endMs = startMs + 300;
  return updateWriting(write(round, digit, startMs, endMs), endMs + RECOGNITION_DELAY_MS);
}

/** Napíše číslici, počká na ni a potvrdí ✓. */
function writeAndConfirm(round: WritingRound, digit: number, startMs: number) {
  return confirmWriting(writeAndWait(round, digit, startMs));
}

describe('AC1: po zavření nastavení začne nové kolo bez rozepsaného zápisu', () => {
  const writingTo10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

  it('nové kolo po nastavení nemá žádný tah, číslici ani chyby', () => {
    // Před otevřením nastavení: dvě chyby a rozepsaný tah.
    let before = roundFor(plus(3, 4));
    before = writeAndConfirm(before, 5, 0).round;
    before = writeAndConfirm(before, 6, 2000).round;
    before = finishStroke(startStroke(before, 4000), strokeFor(2), 4200);
    expect(before.answer.wrongAnswers).toBe(2);

    const after = createWritingRound(
      createAnswerRound(writingTo10, seededRandom(), before.answer.problem),
      AREA,
      fakeRecognizer(),
    );

    expect(writtenStrokes(after)).toEqual([]);
    expect(fadingStrokes(after)).toEqual([]);
    expect(shownDigit(after)).toBeNull();
    expect(canConfirm(after)).toBe(false);
    expect(after.answer.wrongAnswers).toBe(0);
    expect(isHintVisible(after.answer)).toBe(false);
    expect(after.answer.solved).toBe(false);
  });

  it('rozepsaný tah se v novém kole nerozpozná ani po čase', () => {
    const recognize = fakeRecognizer();
    const after = createWritingRound(
      createAnswerRound(writingTo10, seededRandom()),
      AREA,
      recognize,
    );

    const later = updateWriting(after, 10_000);

    expect(shownDigit(later)).toBeNull();
    expect(recognize.calls).toEqual([]);
  });
});

describe('AC3: přesně 1 s po zvednutí prstu se ukáže rozpoznaná číslice a ✓', () => {
  it('hra čeká na rozpoznání přesně 1 sekundu', () => {
    expect(RECOGNITION_DELAY_MS).toBe(1000);
  });

  it('999 ms po zvednutí prstu ještě nic, v 1000 ms se ukáže číslice', () => {
    const written = write(roundFor(plus(3, 4)), 7, 4000, 5000);

    expect(shownDigit(updateWriting(written, 5999))).toBeNull();
    expect(shownDigit(updateWriting(written, 6000))).toBe(7);
  });

  it('s ukázanou číslicí jde ťuknout na ✓', () => {
    const shown = writeAndWait(roundFor(plus(3, 4)), 7, 0);

    expect(canConfirm(shown)).toBe(true);
  });

  it('dokud se číslice neukáže, ✓ nereaguje a nepočítá se jako chyba', () => {
    const written = updateWriting(write(roundFor(plus(3, 4)), 5, 0, 300), 1299);

    expect(canConfirm(written)).toBe(false);
    const result = confirmWriting(written);

    expect(result.outcome).toBe('ignored');
    expect(result.round.answer.wrongAnswers).toBe(0);
    expect(result.round.answer.solved).toBe(false);
  });

  it('✓ na prázdné ploše nereaguje', () => {
    const empty = roundFor(plus(3, 4));

    expect(canConfirm(empty)).toBe(false);
    expect(confirmWriting(empty).outcome).toBe('ignored');
  });

  it('dokud má dítě prst na ploše, číslice se neukáže', () => {
    // První tah skončí v 0 ms, druhý začne v 500 ms a trvá přes 1 s.
    let round = write(roundFor(plus(3, 4)), 1, 0, 0);
    round = startStroke(round, 500);

    expect(shownDigit(updateWriting(round, 1000))).toBeNull();
    expect(shownDigit(updateWriting(round, 1600))).toBeNull();

    round = finishStroke(round, strokeFor(4), 1800);
    expect(shownDigit(updateWriting(round, 2799))).toBeNull();
    expect(shownDigit(updateWriting(round, 2800))).toBe(4);
  });

  it('když dítě píše i po ukázání, po další 1 s se rozpozná celý zápis a číslice se nahradí', () => {
    const recognize = fakeRecognizer();
    const shown = writeAndWait(roundFor(plus(3, 4), recognize), 1, 0);
    expect(shownDigit(shown)).toBe(1);

    const more = write(shown, 4, 2000, 2400);

    expect(shownDigit(updateWriting(more, 3400))).toBe(4);
    expect(recognize.calls[recognize.calls.length - 1]).toBe(2);
    expect(writtenStrokes(updateWriting(more, 3400))).toHaveLength(2);
  });

  it('během dopisování ✓ nepotvrdí starou číslici', () => {
    const shown = writeAndWait(roundFor(plus(3, 4)), 1, 0);
    const more = updateWriting(write(shown, 4, 2000, 2400), 3399);

    expect(canConfirm(more)).toBe(false);
    expect(confirmWriting(more).outcome).toBe('ignored');
    expect(confirmWriting(more).round.answer.wrongAnswers).toBe(0);
  });

  it('smazání zápis i číslici odstraní a nepočítá se jako chyba', () => {
    const shown = writeAndWait(roundFor(plus(3, 4)), 5, 0);
    const cleared = clearWriting(shown);

    expect(writtenStrokes(cleared)).toEqual([]);
    expect(shownDigit(cleared)).toBeNull();
    expect(canConfirm(cleared)).toBe(false);
    expect(cleared.answer.wrongAnswers).toBe(0);
  });

  it('smazání před ukázáním zruší čekající rozpoznání', () => {
    const recognize = fakeRecognizer();
    const written = write(roundFor(plus(3, 4), recognize), 5, 0, 300);
    const cleared = updateWriting(clearWriting(written), 5000);

    expect(shownDigit(cleared)).toBeNull();
    expect(recognize.calls).toEqual([]);
  });

  it('ani mnohokrát smazané a znovu napsané špatné číslo nepřiblíží nápovědu', () => {
    let round = roundFor(plus(3, 4));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      round = clearWriting(writeAndWait(round, attempt % 2 === 0 ? 5 : 2, attempt * 5000));
    }

    expect(round.answer.wrongAnswers).toBe(0);
    expect(isHintVisible(round.answer)).toBe(false);
  });

  it('přepsání špatné číslice správnou bez potvrzení není chyba', () => {
    let round = writeAndWait(roundFor(plus(3, 4)), 5, 0);
    round = writeAndWait(round, 7, 3000);

    expect(shownDigit(round)).toBe(7);
    const result = confirmWriting(round);

    expect(result.outcome).toBe('correct');
    expect(result.round.answer.wrongAnswers).toBe(0);
  });

  it('po smazání jde napsat a potvrdit správnou odpověď', () => {
    let round = clearWriting(writeAndWait(roundFor(minus(7, 3)), 9, 0));
    round = writeAndWait(round, 4, 3000);

    expect(confirmWriting(round).outcome).toBe('correct');
  });
});

describe('AC4: potvrzená odpověď se vyhodnotí stejně jako na číselníku', () => {
  it('za správnou potvrzenou odpověď dostane dítě hvězdičku', () => {
    const result = writeAndConfirm(roundFor(plus(3, 4)), 7, 0);

    expect(result.outcome).toBe('correct');
    expect(result.round.answer.solved).toBe(true);
    const stars = starsAfterTap(createStarProgress(), result.outcome);
    expect(stars.starEarned).toBe(true);
    expect(stars.progress.earned).toBe(1);
  });

  it('po správné odpovědi se v příkladu ukáže výsledek jako na číselníku', () => {
    const written = writeAndConfirm(roundFor(minus(7, 3)), 4, 0).round;
    const tapped = tapAnswer(answerRoundFor(minus(7, 3)), 4).round;

    expect(problemText(written.answer)).toEqual(problemText(tapped));
    expect(problemText(written.answer).answer).toBe('4');
    expect(problemText(written.answer).answerRevealed).toBe(true);
  });

  it('výsledek 0 jde napsat a ukáže se: „5 − 5 = 0“', () => {
    const result = writeAndConfirm(roundFor(minus(5, 5)), 0, 0);

    expect(result.outcome).toBe('correct');
    expect(problemText(result.round.answer).answer).toBe('0');
  });

  it('hvězdička za psaní se uloží, rozepsaný tah se neukládá', () => {
    const result = writeAndConfirm(roundFor(plus(3, 4)), 7, 0);
    const stars = starsAfterTap(START_PROGRESS, result.outcome);
    const progress: GameProgress = { ...START_PROGRESS, earned: stars.progress.earned };

    const saved = serializeProgress(progress);

    expect(parseProgress(saved)).toEqual({ earned: 1 });
    expect(Object.keys(JSON.parse(saved) as object)).toEqual(['earned']);
  });

  it('špatná potvrzená odpověď je chyba a hvězdičku nedá', () => {
    const result = writeAndConfirm(roundFor(plus(3, 4)), 5, 0);

    expect(result.outcome).toBe('wrong');
    expect(result.round.answer.wrongAnswers).toBe(1);
    expect(result.round.answer.solved).toBe(false);
    expect(starsAfterTap(createStarProgress(), result.outcome).starEarned).toBe(false);
    expect(problemText(result.round.answer).answer).toBe('?');
  });

  it('po 1. chybě nápověda ještě není, po 2. chybě se ukážou tečky', () => {
    const first = writeAndConfirm(roundFor(plus(3, 4)), 5, 0).round;
    expect(isHintVisible(first.answer)).toBe(false);

    const second = writeAndConfirm(clearWriting(first), 6, 3000).round;
    expect(second.answer.wrongAnswers).toBe(2);
    expect(isHintVisible(second.answer)).toBe(true);
  });

  it('chyby při psaní se počítají stejně jako ťuknutí na číselníku', () => {
    let written = roundFor(plus(3, 4));
    let tapped = answerRoundFor(plus(3, 4));
    for (const [index, digit] of [5, 6, 7].entries()) {
      const writtenResult = writeAndConfirm(clearWriting(written), digit, index * 3000);
      const tappedResult = tapAnswer(tapped, digit);
      written = writtenResult.round;
      tapped = tappedResult.round;

      expect(writtenResult.outcome).toBe(tappedResult.outcome);
      expect(written.answer.wrongAnswers).toBe(tapped.wrongAnswers);
      expect(isHintVisible(written.answer)).toBe(isHintVisible(tapped));
    }
  });

  it('po vyřešení se další ✓ ignoruje', () => {
    const solved = writeAndConfirm(roundFor(plus(3, 4)), 7, 0).round;

    const again = confirmWriting(solved);
    expect(again.outcome).toBe('ignored');
    expect(starsAfterTap(createStarProgress(), again.outcome).starEarned).toBe(false);

    const otherDigit = confirmWriting(writeAndWait(solved, 2, 3000));
    expect(otherDigit.outcome).toBe('ignored');
    expect(otherDigit.round.answer.solved).toBe(true);
    expect(otherDigit.round.answer.wrongAnswers).toBe(0);
    expect(problemText(otherDigit.round.answer).answer).toBe('7');
  });
});

describe('AC5: odmítnutý zápis není odpověď ani chyba a do 0,5 s zmizí', () => {
  it('odmítnutý zápis vybledne nejvýš za 0,5 s', () => {
    expect(REJECTED_FADE_MS).toBeGreaterThan(0);
    expect(REJECTED_FADE_MS).toBeLessThanOrEqual(500);
  });

  it('po odmítnutí se neukáže žádná číslice a ✓ nereaguje', () => {
    const rejected = updateWriting(write(roundFor(plus(3, 4)), NOT_A_DIGIT, 0, 300), 1300);

    expect(shownDigit(rejected)).toBeNull();
    expect(canConfirm(rejected)).toBe(false);
    const result = confirmWriting(rejected);
    expect(result.outcome).toBe('ignored');
    expect(result.round.answer.wrongAnswers).toBe(0);
  });

  it('odmítnutý zápis bledne a pak zmizí, plocha je hned volná', () => {
    const rejectedAt = 1300;
    const rejected = updateWriting(write(roundFor(plus(3, 4)), NOT_A_DIGIT, 0, 300), rejectedAt);

    expect(writtenStrokes(rejected)).toEqual([]);
    expect(fadingStrokes(rejected)).toHaveLength(1);

    const gone = updateWriting(rejected, rejectedAt + REJECTED_FADE_MS);
    expect(fadingStrokes(gone)).toEqual([]);
    expect(writtenStrokes(gone)).toEqual([]);
  });

  it('dítě může psát hned znovu a odmítnutý zápis se do nového nepočítá', () => {
    const recognize = fakeRecognizer();
    const rejected = updateWriting(
      write(roundFor(plus(3, 4), recognize), NOT_A_DIGIT, 0, 300),
      1300,
    );

    // Nový tah začne ještě během blednutí.
    const again = updateWriting(write(rejected, 7, 1300, 1500), 2500);

    expect(shownDigit(again)).toBe(7);
    expect(recognize.calls[recognize.calls.length - 1]).toBe(1);
    expect(confirmWriting(again).outcome).toBe('correct');
  });

  it('ani mnoho odmítnutých zápisů nepřiblíží nápovědu', () => {
    let round = roundFor(plus(3, 4));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const start = attempt * 3000;
      round = updateWriting(write(round, NOT_A_DIGIT, start, start + 200), start + 1200);
    }

    expect(round.answer.wrongAnswers).toBe(0);
    expect(isHintVisible(round.answer)).toBe(false);
  });
});
