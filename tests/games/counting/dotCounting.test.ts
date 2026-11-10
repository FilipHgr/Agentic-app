import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  hintCrossedOutDots,
  hintDotGroups,
  isHintVisible,
  problemText,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import {
  canCountDots,
  countDot,
  countedDotCount,
  countingTone,
  startDotCounting,
} from '../../../src/games/counting/logic/dotCounting';
import type { DotCounting } from '../../../src/games/counting/logic/dotCounting';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { createStarProgress, starsAfterTap } from '../../../src/games/counting/logic/stars';

import { seededRandom } from './seededRandom';

/**
 * Testy počítání teček ťukáním v nápovědě (#43). Rozložení ploch pro ťuknutí
 * (AC7) je v dotCountingLayout.test.ts. Čitelnost čísla v tečce (AC8)
 * se kontroluje ručně.
 */

const THREE_PLUS_FOUR: Problem = { first: 3, second: 4, operation: 'plus', result: 7 };
const SEVEN_MINUS_THREE: Problem = { first: 7, second: 3, operation: 'minus', result: 4 };

/** Kolik teček nápověda pro příklad ukáže (i s přeškrtnutými). */
function dotCountOf(problem: Problem): number {
  return hintDotGroups(problem).reduce((sum, count) => sum + count, 0);
}

/** Kolo, ve kterém se dítě dvakrát spletlo, takže už vidí nápovědu. */
function roundWithHint(problem: Problem, maxNumber = 10): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 2, solved: false };
}

/** Postupně ťukne na zadané tečky a vrátí výsledný stav počítání. */
function countAll(
  round: AnswerRound,
  counting: DotCounting,
  dotIndexes: readonly number[],
): DotCounting {
  return dotIndexes.reduce((current, index) => countDot(round, current, index).counting, counting);
}

/** Indexy teček, na které jde ťuknout (bez přeškrtnutých na konci). */
function countableIndexes(problem: Problem): number[] {
  const countable = dotCountOf(problem) - hintCrossedOutDots(problem);
  return Array.from({ length: countable }, (_, index) => index);
}

/** Všechny příklady, které v rozsahu mohou přijít. */
function allProblems(maxNumber: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; first + second <= maxNumber; second += 1) {
      problems.push({ first, second, operation: 'plus', result: first + second });
    }
    for (let second = 0; second <= first; second += 1) {
      problems.push({ first, second, operation: 'minus', result: first - second });
    }
  }
  return problems;
}

describe('AC1: ťuknutá tečka dostane číslo podle pořadí ťuknutí', () => {
  it('na tečky jde ťukat u rozsahu 5 a 10, u rozsahu 20 ne', () => {
    expect(canCountDots(5)).toBe(true);
    expect(canCountDots(10)).toBe(true);
    expect(canCountDots(20)).toBe(false);
  });

  it('na začátku nápovědy nemá žádná tečka číslo', () => {
    const counting = startDotCounting(THREE_PLUS_FOUR);

    expect(counting.numbers).toHaveLength(7);
    expect(counting.numbers.every((number) => number === null)).toBe(true);
    expect(countedDotCount(counting)).toBe(0);
  });

  it('první ťuknutá tečka má 1, další 2, i když dítě ťuká na přeskáčku', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const first = countDot(round, startDotCounting(THREE_PLUS_FOUR), 5);
    const second = countDot(round, first.counting, 0);
    const third = countDot(round, second.counting, 3);

    expect(first.countedNumber).toBe(1);
    expect(second.countedNumber).toBe(2);
    expect(third.countedNumber).toBe(3);
    expect(third.counting.numbers[5]).toBe(1);
    expect(third.counting.numbers[0]).toBe(2);
    expect(third.counting.numbers[3]).toBe(3);
    expect(third.counting.numbers[1]).toBeNull();
  });

  it('jde spočítat i tečku, která ještě nenaskočila (hned po ukázání nápovědy i poslední)', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const result = countDot(round, startDotCounting(THREE_PLUS_FOUR), 6);

    expect(result.countedNumber).toBe(1);
    expect(result.counting.numbers[6]).toBe(1);
  });

  it('dvě tečky ťuknuté současně dostanou čísla za sebou a žádné se neopakuje', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    // Scéna dostane dva dotyky naráz jako dvě události hned po sobě.
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [2, 4]);

    expect([counting.numbers[2], counting.numbers[4]]).toEqual([1, 2]);
    expect(countedDotCount(counting)).toBe(2);
  });

  it('u rozsahu 20 ťuknutí na tečku nic nedělá', () => {
    const problem: Problem = { first: 12, second: 5, operation: 'plus', result: 17 };
    const round = roundWithHint(problem, 20);
    const counting = startDotCounting(problem);
    const result = countDot(round, counting, 0);

    expect(result.countedNumber).toBeNull();
    expect(result.counting.numbers.every((number) => number === null)).toBe(true);
  });

  it('rozhoduje rozsah, se kterým se příklad ukázal (rozsah uložený v kole)', () => {
    // Stejný příklad 3 + 4: ukázal-li se při rozsahu 10, počítat jde, při 20 ne.
    const counting = startDotCounting(THREE_PLUS_FOUR);

    expect(countDot(roundWithHint(THREE_PLUS_FOUR, 10), counting, 0).countedNumber).toBe(1);
    expect(countDot(roundWithHint(THREE_PLUS_FOUR, 20), counting, 0).countedNumber).toBeNull();
  });

  it('dokud se nápověda neukázala, ťuknutí do míst teček nic nedělá', () => {
    const round: AnswerRound = { ...roundWithHint(THREE_PLUS_FOUR), wrongAnswers: 1 };
    expect(isHintVisible(round)).toBe(false);

    const result = countDot(round, startDotCounting(THREE_PLUS_FOUR), 0);

    expect(result.countedNumber).toBeNull();
    expect(countedDotCount(result.counting)).toBe(0);
  });
});

describe('AC2: sčítání se počítá přes obě skupinky, u odčítání jen zbylé tečky', () => {
  it('u 3 + 4 svítí po spočítání všech teček čísla 1 až 7', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1, 2, 3, 4, 5, 6]);

    expect(counting.numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('druhá skupinka u sčítání pokračuje v počítání, nezačíná od jedničky', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1, 2]);
    const firstOfSecondGroup = countDot(round, counting, 3);

    expect(firstOfSecondGroup.countedNumber).toBe(4);
  });

  it('u 7 − 3 na přeškrtnutou tečku ťuknout nejde a nedostane číslo', () => {
    const round = roundWithHint(SEVEN_MINUS_THREE);
    const counting = startDotCounting(SEVEN_MINUS_THREE);

    // Přeškrtnuté jsou poslední tři tečky (indexy 4, 5, 6).
    for (const crossedOut of [4, 5, 6]) {
      const result = countDot(round, counting, crossedOut);
      expect(result.countedNumber).toBeNull();
      expect(result.counting.numbers[crossedOut]).toBeNull();
    }
  });

  it('u 7 − 3 jdou spočítat 4 tečky a poslední číslo je výsledek', () => {
    const round = roundWithHint(SEVEN_MINUS_THREE);
    const counting = countAll(round, startDotCounting(SEVEN_MINUS_THREE), [0, 1, 2, 3, 4, 5, 6]);

    expect(countedDotCount(counting)).toBe(4);
    expect(counting.numbers).toEqual([1, 2, 3, 4, null, null, null]);
  });

  it.each([5, 10])(
    'u každého příkladu do %i je po spočítání všech teček nejvyšší číslo výsledek',
    (maxNumber) => {
      for (const problem of allProblems(maxNumber)) {
        const round = roundWithHint(problem, maxNumber);
        const all = Array.from({ length: dotCountOf(problem) }, (_, index) => index);
        const counting = countAll(round, startDotCounting(problem), all);
        const numbers = counting.numbers.filter((number): number is number => number !== null);

        expect(countedDotCount(counting)).toBe(problem.result);
        expect(Math.max(0, ...numbers)).toBe(problem.result);
      }
    },
  );
});

describe('AC3: opakované ťuknutí a ťuknutí mimo tečky nic nemění', () => {
  it('druhé ťuknutí na spočítanou tečku nechá její číslo a počet neroste', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1]);
    const again = countDot(round, counting, 0);

    expect(again.countedNumber).toBeNull();
    expect(again.counting.numbers[0]).toBe(1);
    expect(countedDotCount(again.counting)).toBe(2);
  });

  it('po opakovaném ťuknutí dostane další nová tečka číslo hned za posledním', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1, 0, 1]);

    expect(countDot(round, counting, 2).countedNumber).toBe(3);
  });

  it('ťuknutí na tečku, která v nápovědě není, nic nedělá', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = startDotCounting(THREE_PLUS_FOUR);

    for (const outside of [-1, 7, 100]) {
      const result = countDot(round, counting, outside);
      expect(result.countedNumber).toBeNull();
      expect(countedDotCount(result.counting)).toBe(0);
    }
  });
});

describe('AC4: počítání teček není odpověď', () => {
  it('ani po spočítání všech teček se příklad nevyhodnotí a dál ukazuje „?“', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1, 2, 3, 4, 5, 6]);

    expect(round.solved).toBe(false);
    expect(round.wrongAnswers).toBe(2);
    expect(problemText(round).answer).toBe('?');
  });

  it('počítání nepřidá hvězdičku ani chybu, odpověď jde dál zadat číselníkem', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1, 2, 3, 4, 5, 6]);

    expect(createStarProgress().earned).toBe(0);
    const answer = tapAnswer(round, 7);
    expect(answer.outcome).toBe('correct');
    expect(starsAfterTap(createStarProgress(), answer.outcome).progress.earned).toBe(1);
  });

  it('po další špatné odpovědi zůstanou spočítané tečky i jejich čísla', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [4, 0, 6]);
    const afterWrong = tapAnswer(round, 9);
    expect(afterWrong.outcome).toBe('wrong');

    const next = countDot(afterWrong.round, counting, 2);

    expect(next.counting.numbers[4]).toBe(1);
    expect(next.counting.numbers[0]).toBe(2);
    expect(next.counting.numbers[6]).toBe(3);
    expect(next.countedNumber).toBe(4);
  });
});

describe('AC5: po správné odpovědi a v dalším příkladu', () => {
  it('po správné odpovědi ťuknutí na tečky nic nedělá', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const counting = countAll(round, startDotCounting(THREE_PLUS_FOUR), [0, 1]);
    const solved = tapAnswer(round, 7).round;
    const result = countDot(solved, counting, 2);

    expect(result.countedNumber).toBeNull();
    expect(result.counting.numbers[2]).toBeNull();
    expect(countedDotCount(result.counting)).toBe(2);
  });

  it('další příklad začíná bez spočítaných teček a nápověda se ukáže až po 2. chybě', () => {
    const random = seededRandom();
    const next = createAnswerRound({ maxNumber: 10, operations: 'mixed' }, random);
    const counting = startDotCounting(next.problem);

    expect(countedDotCount(counting)).toBe(0);
    expect(counting.numbers.every((number) => number === null)).toBe(true);
    expect(isHintVisible(next)).toBe(false);
  });

  it.each<Problem>([
    { first: 0, second: 0, operation: 'plus', result: 0 },
    { first: 5, second: 5, operation: 'minus', result: 0 },
  ])('když nápověda nemá co počítat ($first, $operation, $second), hra jde dál', (problem) => {
    const round = roundWithHint(problem, 5);
    const counting = startDotCounting(problem);
    const result = countDot(round, counting, 0);

    expect(countableIndexes(problem)).toHaveLength(0);
    expect(result.countedNumber).toBeNull();
    expect(countedDotCount(result.counting)).toBe(0);
    expect(tapAnswer(round, 0).outcome).toBe('correct');
  });
});

describe('AC6: každá nově spočítaná tečka zahraje vyšší tón', () => {
  const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const highestCelebrationHz = Math.max(...SOUNDS.celebration.map((tone) => tone.frequencyHz));

  it('každý další tón je vyšší než předchozí (až do 10 teček)', () => {
    const frequencies = COUNTS.map((count) => countingTone(count).frequencyHz);

    for (let index = 1; index < frequencies.length; index += 1) {
      expect(frequencies[index]).toBeGreaterThan(frequencies[index - 1] ?? Infinity);
    }
  });

  it('žádný tón není vyšší než nejvyšší tón oslavy', () => {
    for (const count of COUNTS) {
      expect(countingTone(count).frequencyHz).toBeLessThanOrEqual(highestCelebrationHz);
    }
  });

  it('tón zazní hned po ťuknutí a je krátký', () => {
    for (const count of COUNTS) {
      const tone = countingTone(count);
      expect(tone.startSeconds).toBe(0);
      expect(tone.durationSeconds).toBeGreaterThan(0);
      expect(tone.durationSeconds).toBeLessThanOrEqual(0.3);
      expect(tone.volume).toBeGreaterThan(0);
      expect(tone.volume).toBeLessThanOrEqual(1);
    }
  });

  it('nově spočítaná tečka řekne, který tón zahrát, opakované ťuknutí žádný', () => {
    const round = roundWithHint(THREE_PLUS_FOUR);
    const first = countDot(round, startDotCounting(THREE_PLUS_FOUR), 0);
    const repeated = countDot(round, first.counting, 0);

    expect(first.countedNumber).toBe(1);
    expect(repeated.countedNumber).toBeNull();
  });
});
