import { describe, expect, it } from 'vitest';

import { MAX_SUM } from '../src/logic/addition';
import {
  ANSWER_CHOICES,
  createAnswerRound,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import {
  HINT_DOT_SIZE,
  PROBLEM_TEXT_HEIGHT,
  layoutHintDots,
  layoutScreen,
} from '../src/logic/screenLayout';
import type { ButtonSlot } from '../src/logic/screenLayout';

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;
const MIN_FINGER_SIZE = 140;

const LAYOUT = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, ANSWER_CHOICES.length);

/** Kolo s pevným příkladem 3 + 4, aby testy ťukání nezávisely na náhodě. */
function roundThreePlusFour(): AnswerRound {
  return { problem: { first: 3, second: 4, result: 7 }, wrongAnswers: 0, solved: false };
}

/** Postupně ťukne na zadaná čísla a vrátí výsledný stav kola. */
function tapAll(round: AnswerRound, numbers: readonly number[]): AnswerRound {
  return numbers.reduce((current, number) => tapAnswer(current, number).round, round);
}

function top(button: ButtonSlot): number {
  return button.y - button.size / 2;
}

describe('AC1: číselník má všechna čísla 0 až 10 ve stálém pořadí', () => {
  it('na číselníku je každé číslo od 0 do 10 právě jednou', () => {
    expect(ANSWER_CHOICES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('správný výsledek je na číselníku u každého příkladu', () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const round = createAnswerRound();
      expect(ANSWER_CHOICES).toContain(round.problem.result);
    }
    expect(Math.max(...ANSWER_CHOICES)).toBe(MAX_SUM);
  });

  it('horní řada má čísla 0–5 a dolní 6–10, zleva doprava', () => {
    const buttons = LAYOUT.answerButtons;
    const topRowY = buttons[0]?.y;
    const topRow = buttons.filter((button) => button.y === topRowY);
    const bottomRow = buttons.filter((button) => button.y !== topRowY);

    expect(topRow).toHaveLength(6);
    expect(bottomRow).toHaveLength(5);
    expect(bottomRow.every((button) => button.y > (topRowY ?? 0))).toBe(true);
    for (const row of [topRow, bottomRow]) {
      for (let index = 1; index < row.length; index += 1) {
        expect(row[index]?.x).toBeGreaterThan(row[index - 1]?.x ?? Infinity);
      }
    }
  });
});

describe('AC2: tlačítka jsou dost velká, celá na obrazovce a nepřekrývají se', () => {
  it('každé tlačítko má aspoň 140 × 140 px', () => {
    for (const button of LAYOUT.answerButtons) {
      expect(button.size).toBeGreaterThanOrEqual(MIN_FINGER_SIZE);
    }
  });

  it('všechna tlačítka jsou celá na obrazovce', () => {
    for (const button of LAYOUT.answerButtons) {
      const half = button.size / 2;
      expect(button.x - half).toBeGreaterThanOrEqual(0);
      expect(button.x + half).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(button.y - half).toBeGreaterThanOrEqual(0);
      expect(button.y + half).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  it('žádná dvě tlačítka se nepřekrývají', () => {
    const buttons = LAYOUT.answerButtons;

    for (const [index, a] of buttons.entries()) {
      for (const b of buttons.slice(index + 1)) {
        const apartHorizontally = Math.abs(a.x - b.x) >= (a.size + b.size) / 2;
        const apartVertically = Math.abs(a.y - b.y) >= (a.size + b.size) / 2;
        expect(apartHorizontally || apartVertically).toBe(true);
      }
    }
  });

  it('tlačítka nepřekrývají příklad', () => {
    const highestButtonTop = Math.min(...LAYOUT.answerButtons.map(top));

    expect(LAYOUT.problem.y + PROBLEM_TEXT_HEIGHT / 2).toBeLessThan(highestButtonTop);
  });
});

describe('AC3: správná odpověď ukončí kolo', () => {
  it('ťuknutí na správné číslo je uznáno', () => {
    const result = tapAnswer(roundThreePlusFour(), 7);

    expect(result.outcome).toBe('correct');
    expect(result.round.solved).toBe(true);
  });

  it('správná odpověď je uznána i po předchozích chybách', () => {
    const afterMistakes = tapAll(roundThreePlusFour(), [2, 9, 5]);

    expect(tapAnswer(afterMistakes, 7).outcome).toBe('correct');
  });

  it('nové kolo začíná bez chyb a bez nápovědy', () => {
    const round = createAnswerRound();

    expect(round.solved).toBe(false);
    expect(round.wrongAnswers).toBe(0);
    expect(isHintVisible(round)).toBe(false);
  });
});

describe('AC4: špatné číslo se nevyřadí, příklad zůstává', () => {
  it('ťuknutí na špatné číslo není uznáno a příklad zůstane', () => {
    const round = roundThreePlusFour();
    const result = tapAnswer(round, 2);

    expect(result.outcome).toBe('wrong');
    expect(result.round.problem).toEqual(round.problem);
    expect(result.round.solved).toBe(false);
  });

  it('na stejné špatné číslo jde ťuknout znovu, nevyřadí se', () => {
    const afterWrong = tapAnswer(roundThreePlusFour(), 2).round;

    expect(tapAnswer(afterWrong, 2).outcome).toBe('wrong');
  });

  it('vyzkoušení všech špatných čísel kolo nevyřeší', () => {
    const wrongNumbers = ANSWER_CHOICES.filter((number) => number !== 7);
    const afterAllWrong = tapAll(roundThreePlusFour(), wrongNumbers);

    expect(afterAllWrong.solved).toBe(false);
  });

  it('číslo mimo číselník se ignoruje a nespadne', () => {
    const round = roundThreePlusFour();

    for (const tapped of [-1, 11, Number.NaN, 7.5]) {
      const result = tapAnswer(round, tapped);
      expect(result.outcome).toBe('ignored');
      expect(result.round).toEqual(round);
    }
  });
});

describe('AC5: po druhé chybě se ukáže nápověda s tečkami', () => {
  it('po první chybě nápověda ještě není', () => {
    expect(isHintVisible(tapAll(roundThreePlusFour(), [2]))).toBe(false);
  });

  it('po druhé chybě se nápověda ukáže', () => {
    expect(isHintVisible(tapAll(roundThreePlusFour(), [2, 9]))).toBe(true);
  });

  it('dvě chyby na stejném čísle se počítají obě', () => {
    expect(isHintVisible(tapAll(roundThreePlusFour(), [2, 2]))).toBe(true);
  });

  it('nápověda zůstane i po dalších chybách', () => {
    expect(isHintVisible(tapAll(roundThreePlusFour(), [2, 9, 5, 1]))).toBe(true);
  });

  it('po správné odpovědi nápověda zmizí', () => {
    expect(isHintVisible(tapAll(roundThreePlusFour(), [2, 9, 7]))).toBe(false);
  });

  it('příklad 3 + 4 má skupinky 3 a 4 tečky', () => {
    expect(hintDotGroups({ first: 3, second: 4, result: 7 })).toEqual([3, 4]);
  });

  it('teček je vždy tolik, kolik je výsledek', () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const { problem } = createAnswerRound();
      const dots = hintDotGroups(problem).reduce((sum, count) => sum + count, 0);
      expect(dots).toBe(problem.result);
    }
  });

  it('tečky jsou dost velké, aby se daly dobře spočítat', () => {
    expect(HINT_DOT_SIZE).toBeGreaterThanOrEqual(44);
  });

  it('v jedné řadě je nejvýš 5 teček, jako na počítadle', () => {
    for (const groups of [[10], [7, 3], [9, 1], [6]]) {
      const dots = layoutHintDots(groups, LAYOUT.hint);
      const rows = new Map<string, number>();
      for (const dot of dots) {
        const key = `${dot.group}:${dot.y}`;
        rows.set(key, (rows.get(key) ?? 0) + 1);
      }
      expect(Math.max(...rows.values())).toBeLessThanOrEqual(5);
    }
  });

  it('7 teček je řada 5 a pod ní řada 2', () => {
    const dots = layoutHintDots([7], LAYOUT.hint);
    const rowYs = [...new Set(dots.map((dot) => dot.y))].sort((a, b) => a - b);

    expect(rowYs).toHaveLength(2);
    expect(dots.filter((dot) => dot.y === rowYs[0])).toHaveLength(5);
    expect(dots.filter((dot) => dot.y === rowYs[1])).toHaveLength(2);
  });

  it('každá skupinka má tolik teček, kolik je její číslo', () => {
    const dots = layoutHintDots([3, 4], LAYOUT.hint);

    expect(dots.filter((dot) => dot.group === 0)).toHaveLength(3);
    expect(dots.filter((dot) => dot.group === 1)).toHaveLength(4);
  });

  it('skupinky jsou od sebe oddělené větší mezerou než tečky uvnitř', () => {
    const dots = layoutHintDots([3, 4], LAYOUT.hint);
    const first = dots.filter((dot) => dot.group === 0).map((dot) => dot.x);
    const second = dots.filter((dot) => dot.group === 1).map((dot) => dot.x);
    const spacingInsideGroup = (first[1] ?? 0) - (first[0] ?? 0);
    const gapBetweenGroups = Math.min(...second) - Math.max(...first);

    expect(gapBetweenGroups).toBeGreaterThan(spacingInsideGroup);
  });

  it('u každého příkladu se nápověda vejde mezi příklad a číselník', () => {
    const problemBottom = LAYOUT.problem.y + PROBLEM_TEXT_HEIGHT / 2;
    const highestButtonTop = Math.min(...LAYOUT.answerButtons.map(top));
    const radius = HINT_DOT_SIZE / 2;

    for (let first = 0; first <= MAX_SUM; first += 1) {
      for (let second = 0; first + second <= MAX_SUM; second += 1) {
        const groups = hintDotGroups({ first, second, result: first + second });
        for (const dot of layoutHintDots(groups, LAYOUT.hint)) {
          expect(dot.x - radius).toBeGreaterThanOrEqual(0);
          expect(dot.x + radius).toBeLessThanOrEqual(SCREEN_WIDTH);
          expect(dot.y - radius).toBeGreaterThan(problemBottom);
          expect(dot.y + radius).toBeLessThan(highestButtonTop);
        }
      }
    }
  });

  it('u každého příkladu se tečky navzájem nepřekrývají', () => {
    for (let first = 0; first <= MAX_SUM; first += 1) {
      for (let second = 0; first + second <= MAX_SUM; second += 1) {
        const groups = hintDotGroups({ first, second, result: first + second });
        const dots = layoutHintDots(groups, LAYOUT.hint);
        for (const [index, a] of dots.entries()) {
          for (const b of dots.slice(index + 1)) {
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(HINT_DOT_SIZE);
          }
        }
      }
    }
  });
});

describe('AC6: příklady s nulou mají správnou nápovědu', () => {
  it('5 + 0 má jen jednu skupinku s 5 tečkami', () => {
    expect(hintDotGroups({ first: 5, second: 0, result: 5 })).toEqual([5]);
  });

  it('0 + 6 má jen jednu skupinku s 6 tečkami', () => {
    expect(hintDotGroups({ first: 0, second: 6, result: 6 })).toEqual([6]);
  });

  it('0 + 0 nemá žádné tečky a rozložení nespadne', () => {
    const groups = hintDotGroups({ first: 0, second: 0, result: 0 });

    expect(groups).toEqual([]);
    expect(layoutHintDots(groups, LAYOUT.hint)).toEqual([]);
  });
});

describe('AC7: po správné odpovědi se další ťuknutí ignorují', () => {
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
    expect(result.round.wrongAnswers).toBe(0);
  });
});
