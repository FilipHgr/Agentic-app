import { describe, expect, it } from 'vitest';

import { MAX_SUM } from '../src/logic/addition';
import {
  ANSWER_CHOICE_COUNT,
  createAnswerChoices,
  createAnswerRound,
  tapAnswer,
} from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import { layoutScreen } from '../src/logic/screenLayout';

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;
const MIN_FINGER_SIZE = 140;

const MANY_ROUNDS = Array.from({ length: 500 }, () => createAnswerRound());

/** Kolo s pevným příkladem 3 + 4, aby testy ťukání nezávisely na náhodě. */
function roundThreePlusFour(): AnswerRound {
  return {
    problem: { first: 3, second: 4, result: 7 },
    choices: [2, 7, 9],
    rejected: [],
    solved: false,
  };
}

describe('AC1: pod příkladem jsou 3 tlačítka, právě jedno je správné', () => {
  it('hráč dostane na výběr přesně 3 čísla', () => {
    for (const round of MANY_ROUNDS) {
      expect(round.choices).toHaveLength(3);
    }
    expect(ANSWER_CHOICE_COUNT).toBe(3);
  });

  it('mezi nabízenými čísly je právě jednou správný výsledek', () => {
    for (const round of MANY_ROUNDS) {
      const correctChoices = round.choices.filter((choice) => choice === round.problem.result);
      expect(correctChoices).toHaveLength(1);
    }
  });

  it('tlačítka jsou na obrazovce pod příkladem', () => {
    const layout = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, ANSWER_CHOICE_COUNT);

    expect(layout.answerButtons).toHaveLength(3);
    for (const button of layout.answerButtons) {
      expect(button.y - button.size / 2).toBeGreaterThan(layout.problem.y);
    }
  });
});

describe('AC2: nabízená čísla se neopakují a jsou od 0 do 10', () => {
  it('žádné nabízené číslo se neopakuje', () => {
    for (const round of MANY_ROUNDS) {
      expect(new Set(round.choices).size).toBe(round.choices.length);
    }
  });

  it('všechna nabízená čísla jsou celá od 0 do 10', () => {
    for (const round of MANY_ROUNDS) {
      for (const choice of round.choices) {
        expect(Number.isInteger(choice)).toBe(true);
        expect(choice).toBeGreaterThanOrEqual(0);
        expect(choice).toBeLessThanOrEqual(MAX_SUM);
      }
    }
  });

  it('i u krajních příkladů 0 + 0 a součtu 10 jsou čísla různá a v rozsahu', () => {
    const extremes = [
      { first: 0, second: 0, result: 0 },
      { first: 4, second: 6, result: 10 },
    ];

    for (const problem of extremes) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const choices = createAnswerChoices(problem);
        expect(new Set(choices).size).toBe(3);
        expect(choices).toContain(problem.result);
        expect(choices.every((choice) => choice >= 0 && choice <= MAX_SUM)).toBe(true);
      }
    }
  });

  it('ani generátor vracející hraniční hodnoty nerozbije nabídku', () => {
    const problem = { first: 2, second: 3, result: 5 };

    for (const value of [0, 0.999999, 1]) {
      const choices = createAnswerChoices(problem, () => value);
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(5);
    }
  });
});

describe('AC3: správná odpověď není pořád na stejném místě', () => {
  it('správné číslo se objeví na každém ze tří míst', () => {
    const positionsOfCorrectAnswer = new Set(
      MANY_ROUNDS.map((round) => round.choices.indexOf(round.problem.result)),
    );

    expect(positionsOfCorrectAnswer).toEqual(new Set([0, 1, 2]));
  });
});

describe('AC4: po ťuknutí na správné číslo kolo skončí a přijde nový příklad', () => {
  it('ťuknutí na správné číslo je uznáno', () => {
    const result = tapAnswer(roundThreePlusFour(), 7);

    expect(result.outcome).toBe('correct');
    expect(result.round.solved).toBe(true);
  });

  it('nové kolo má nový příklad s vlastní nabídkou čísel', () => {
    const nextRound = createAnswerRound();

    expect(nextRound.solved).toBe(false);
    expect(nextRound.rejected).toEqual([]);
    expect(nextRound.choices).toContain(nextRound.problem.result);
  });
});

describe('AC5: špatné číslo nic netrestá, hráč zkouší dál', () => {
  it('ťuknutí na špatné číslo není uznáno, ale příklad zůstává', () => {
    const round = roundThreePlusFour();
    const result = tapAnswer(round, 2);

    expect(result.outcome).toBe('wrong');
    expect(result.round.problem).toEqual(round.problem);
    expect(result.round.choices).toEqual(round.choices);
    expect(result.round.solved).toBe(false);
  });

  it('po špatné odpovědi jde pořád odpovědět správně', () => {
    const afterWrong = tapAnswer(roundThreePlusFour(), 2).round;
    const result = tapAnswer(afterWrong, 7);

    expect(result.outcome).toBe('correct');
  });

  it('po obou špatných odpovědích jde pořád odpovědět správně', () => {
    const afterFirstWrong = tapAnswer(roundThreePlusFour(), 2).round;
    const afterSecondWrong = tapAnswer(afterFirstWrong, 9).round;

    expect(tapAnswer(afterSecondWrong, 7).outcome).toBe('correct');
  });

  it('opakované ťuknutí na zešedlé špatné číslo nic nedělá', () => {
    const afterWrong = tapAnswer(roundThreePlusFour(), 2).round;
    const result = tapAnswer(afterWrong, 2);

    expect(result.outcome).toBe('ignored');
    expect(result.round).toEqual(afterWrong);
  });

  it('číslo, které nebylo nabídnuto, se ignoruje a nespadne', () => {
    const round = roundThreePlusFour();

    for (const tapped of [5, -1, 11, Number.NaN, 7.5]) {
      const result = tapAnswer(round, tapped);
      expect(result.outcome).toBe('ignored');
      expect(result.round).toEqual(round);
    }
  });
});

describe('AC6: po správné odpovědi se další ťuknutí ignorují', () => {
  it('druhé ťuknutí na správné číslo už nic nezmění', () => {
    const solved = tapAnswer(roundThreePlusFour(), 7).round;
    const result = tapAnswer(solved, 7);

    expect(result.outcome).toBe('ignored');
    expect(result.round).toEqual(solved);
  });

  it('ťuknutí na špatné číslo po správné odpovědi už nic nezmění', () => {
    const solved = tapAnswer(roundThreePlusFour(), 7).round;
    const result = tapAnswer(solved, 2);

    expect(result.outcome).toBe('ignored');
    expect(result.round.rejected).toEqual([]);
  });
});

describe('AC7: tlačítka jsou dost velká na prst a vejdou se na obrazovku', () => {
  const layout = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, ANSWER_CHOICE_COUNT);

  it('každé tlačítko má aspoň 140 × 140 px', () => {
    for (const button of layout.answerButtons) {
      expect(button.size).toBeGreaterThanOrEqual(MIN_FINGER_SIZE);
    }
  });

  it('všechna tlačítka jsou celá na obrazovce', () => {
    for (const button of layout.answerButtons) {
      const half = button.size / 2;
      expect(button.x - half).toBeGreaterThanOrEqual(0);
      expect(button.x + half).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(button.y - half).toBeGreaterThanOrEqual(0);
      expect(button.y + half).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  it('tlačítka se nepřekrývají, takže se netrefí vedlejší', () => {
    const sortedByX = [...layout.answerButtons].sort((a, b) => a.x - b.x);

    for (let index = 1; index < sortedByX.length; index += 1) {
      const left = sortedByX[index - 1];
      const right = sortedByX[index];
      if (!left || !right) {
        throw new Error('chybí tlačítko v rozložení');
      }
      expect(right.x - right.size / 2).toBeGreaterThan(left.x + left.size / 2);
    }
  });
});
