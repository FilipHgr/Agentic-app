import { describe, expect, it } from 'vitest';

import {
  answerChoices,
  createAnswerRound,
  hintCrossedOutDots,
  hintDotGroups,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import { createProblem, formatProblem } from '../../../src/games/counting/logic/problems';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  STAR_SIZE,
  layoutHint,
  layoutScreen,
} from '../../../src/games/counting/logic/screenLayout';
import type { ScreenLayout } from '../../../src/games/counting/logic/screenLayout';
import {
  DEFAULT_SETTINGS,
  MAX_NUMBER_OPTIONS,
  OPERATION_OPTIONS,
  parseSettings,
  serializeSettings,
} from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { loadSettings, saveSettings } from '../../../src/games/counting/storage/settingsStorage';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';

import { seededRandom } from './seededRandom';

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

/** Všechny kombinace, které rodič může nastavit. */
const ALL_SETTINGS: GameSettings[] = MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
  OPERATION_OPTIONS.map((operations) => ({ maxNumber, operations })),
);

function layoutFor(maxNumber: number): ScreenLayout {
  return layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, answerChoices(maxNumber).length, STARS_PER_SET);
}

/** Všechny příklady, které mohou v daném rozsahu nastat (sčítání i odčítání). */
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

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= SCREEN_WIDTH && b.bottom <= SCREEN_HEIGHT;
}

/** Vše na herní ploše kromě nápovědy: příklad, hvězdičky, tlačítka. */
function fixedBoxes(layout: ScreenLayout): Box[] {
  const { problem } = layout;
  return [
    box(problem.x, problem.y, layout.problemSize.width, layout.problemSize.height),
    ...layout.stars.map((star) => box(star.x, star.y, STAR_SIZE, STAR_SIZE)),
    ...layout.answerButtons.map((button) => box(button.x, button.y, button.size, button.size)),
  ];
}

/** Úložiště v paměti, jako localStorage v prohlížeči. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('AC2: nastavení nabízí rozsah 5, 10, 20 a +, −, + −', () => {
  it('rozsahy jsou 5, 10 a 20', () => {
    expect([...MAX_NUMBER_OPTIONS]).toEqual([5, 10, 20]);
  });

  it('druhy příkladů jsou sčítání, odčítání a obojí', () => {
    expect([...OPERATION_OPTIONS]).toEqual(['plus', 'minus', 'mixed']);
  });
});

describe('AC3: po zavření nastavení přijde příklad podle nového nastavení', () => {
  it.each(ALL_SETTINGS)('nové kolo odpovídá nastavení $maxNumber / $operations', (settings) => {
    const round = createAnswerRound(settings, seededRandom());

    expect(round.maxNumber).toBe(settings.maxNumber);
    expect(round.problem.result).toBeLessThanOrEqual(settings.maxNumber);
    expect(round.solved).toBe(false);
  });
});

describe('AC4: čísla v příkladu i výsledek jsou v rozsahu a nikdy záporná', () => {
  it.each(ALL_SETTINGS)('nastavení $maxNumber / $operations', (settings) => {
    const random = seededRandom();
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const problem = createProblem(settings, random);
      for (const value of [problem.first, problem.second, problem.result]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(settings.maxNumber);
      }
    }
  });

  it('i nejvyšší hodnoty generátoru dají platný příklad', () => {
    for (const settings of ALL_SETTINGS) {
      for (const value of [0, 0.999999, 1]) {
        const problem = createProblem(settings, () => value);
        expect(problem.result).toBeGreaterThanOrEqual(0);
        expect(problem.result).toBeLessThanOrEqual(settings.maxNumber);
      }
    }
  });
});

describe('AC5: odčítání se zobrazí jako „7 − 3 = ?“ a nápověda škrtá odečítané tečky', () => {
  const sevenMinusThree: Problem = { first: 7, second: 3, operation: 'minus', result: 4 };

  it('příklad se zobrazí se znaménkem minus', () => {
    expect(formatProblem(sevenMinusThree)).toBe('7 − 3 = ?');
  });

  it('při odčítání je výsledek rozdíl čísel', () => {
    const random = seededRandom();
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const problem = createProblem({ maxNumber: 20, operations: 'minus' }, random);
      expect(problem.operation).toBe('minus');
      expect(problem.result).toBe(problem.first - problem.second);
    }
  });

  it('správná odpověď na odčítání je uznána, sčítání čísel ne', () => {
    const round = { problem: sevenMinusThree, maxNumber: 10, wrongAnswers: 0, solved: false };

    expect(tapAnswer(round, 4).outcome).toBe('correct');
    expect(tapAnswer(round, 10).outcome).toBe('wrong');
  });

  it('nápověda ukáže 7 teček a 3 z nich přeškrtne', () => {
    expect(hintDotGroups(sevenMinusThree)).toEqual([7]);
    expect(hintCrossedOutDots(sevenMinusThree)).toBe(3);
  });

  it('nepřeškrtnutých teček je vždy tolik, kolik je výsledek', () => {
    for (const problem of allProblems(20)) {
      const dots = hintDotGroups(problem).reduce((sum, count) => sum + count, 0);
      expect(dots - hintCrossedOutDots(problem)).toBe(problem.result);
    }
  });

  it('u sčítání se nic nepřeškrtává', () => {
    expect(hintCrossedOutDots({ first: 3, second: 4, operation: 'plus', result: 7 })).toBe(0);
  });

  it('5 − 0 má pět teček bez škrtnutí a 0 − 0 žádné tečky', () => {
    expect(hintDotGroups({ first: 5, second: 0, operation: 'minus', result: 5 })).toEqual([5]);
    expect(hintCrossedOutDots({ first: 5, second: 0, operation: 'minus', result: 5 })).toBe(0);
    expect(hintDotGroups({ first: 0, second: 0, operation: 'minus', result: 0 })).toEqual([]);
  });
});

describe('AC6: při „+ −“ se sčítání a odčítání střídají', () => {
  it('za mnoho příkladů přijde sčítání i odčítání', () => {
    const random = seededRandom();
    const operations = new Set(
      Array.from({ length: 200 }, () =>
        createProblem({ maxNumber: 10, operations: 'mixed' }, random),
      ).map((problem) => problem.operation),
    );

    expect(operations).toEqual(new Set(['plus', 'minus']));
  });

  it('při „+“ přijde jen sčítání a při „−“ jen odčítání', () => {
    const random = seededRandom();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(createProblem({ maxNumber: 10, operations: 'plus' }, random).operation).toBe('plus');
      expect(createProblem({ maxNumber: 10, operations: 'minus' }, random).operation).toBe('minus');
    }
  });
});

describe('AC7: číselník odpovídá rozsahu a nic se nepřekrývá', () => {
  it('číselník má čísla 0–5, 0–10 nebo 0–20', () => {
    expect(answerChoices(5)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(answerChoices(10)).toHaveLength(11);
    expect(answerChoices(20)).toEqual(Array.from({ length: 21 }, (_, index) => index));
  });

  it('číslo mimo zvolený rozsah se ignoruje', () => {
    const round = createAnswerRound({ maxNumber: 5, operations: 'plus' }, seededRandom());

    expect(tapAnswer(round, 6).outcome).toBe('ignored');
    expect(tapAnswer(round, 20).outcome).toBe('ignored');
  });

  it.each(MAX_NUMBER_OPTIONS)('rozsah do %i: tlačítek je tolik, kolik čísel', (max) => {
    expect(layoutFor(max).answerButtons).toHaveLength(max + 1);
  });

  it.each(MAX_NUMBER_OPTIONS)('rozsah do %i: čísla jdou zleva doprava a shora dolů', (max) => {
    const readingOrder = layoutFor(max)
      .answerButtons.map((button, index) => ({ button, number: index }))
      .sort((a, b) => a.button.y - b.button.y || a.button.x - b.button.x)
      .map(({ number }) => number);

    expect(readingOrder).toEqual(answerChoices(max));
  });

  it.each(MAX_NUMBER_OPTIONS)('rozsah do %i: tlačítka jsou dost velká na prst', (max) => {
    const minimum = max === 20 ? 116 : 140;
    for (const button of layoutFor(max).answerButtons) {
      expect(button.size).toBeGreaterThanOrEqual(minimum);
    }
  });

  it.each(MAX_NUMBER_OPTIONS)('rozsah do %i: vše je na obrazovce a nic se nepřekrývá', (max) => {
    const boxes = fixedBoxes(layoutFor(max));

    for (const [index, a] of boxes.entries()) {
      expect(insideScreen(a)).toBe(true);
      for (const b of boxes.slice(index + 1)) {
        expect(overlaps(a, b)).toBe(false);
      }
    }
  });

  it.each(MAX_NUMBER_OPTIONS)('rozsah do %i: nápověda u žádného příkladu nic nepřekrývá', (max) => {
    const layout = layoutFor(max);
    const others = fixedBoxes(layout);
    const size = layout.hintStyle.dotSize;

    for (const problem of allProblems(max)) {
      const dots = layoutHint(layout, hintDotGroups(problem));
      for (const [index, dot] of dots.entries()) {
        const dotBox = box(dot.x, dot.y, size, size);
        expect(insideScreen(dotBox)).toBe(true);
        for (const other of others) {
          expect(overlaps(dotBox, other)).toBe(false);
        }
        for (const next of dots.slice(index + 1)) {
          expect(Math.hypot(next.x - dot.x, next.y - dot.y)).toBeGreaterThan(size);
        }
      }
    }
  });
});

describe('AC8: nastavení se pamatuje a poškozené se nahradí výchozím', () => {
  it('výchozí nastavení je sčítání do 10', () => {
    expect(DEFAULT_SETTINGS).toEqual({ maxNumber: 10, operations: 'plus' });
  });

  it('uložené nastavení se po novém otevření hry načte', () => {
    const storage = memoryStorage();
    const chosen: GameSettings = { maxNumber: 20, operations: 'mixed' };

    expect(saveSettings(storage, chosen)).toBe(true);
    expect(loadSettings(storage)).toEqual(chosen);
  });

  it('bez uloženého nastavení se použije výchozí', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('poškozený nebo neznámý záznam se nahradí výchozím a hra nespadne', () => {
    for (const saved of ['', 'nesmysl', '{', 'null', '42', '"10"', '[]']) {
      expect(parseSettings(saved)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('neplatná část záznamu se nahradí výchozí hodnotou, platná zůstane', () => {
    expect(parseSettings('{"maxNumber":7,"operations":"minus"}')).toEqual({
      maxNumber: 10,
      operations: 'minus',
    });
    expect(parseSettings('{"maxNumber":5,"operations":"krat"}')).toEqual({
      maxNumber: 5,
      operations: 'plus',
    });
  });

  it('uložení a načtení vrátí stejné nastavení pro všechny kombinace', () => {
    for (const settings of ALL_SETTINGS) {
      expect(parseSettings(serializeSettings(settings))).toEqual(settings);
    }
  });

  it('zakázané úložiště prohlížeče hru nerozbije', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('úložiště zakázáno');
      },
      setItem: () => {
        throw new Error('úložiště plné');
      },
    };

    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(broken, { maxNumber: 5, operations: 'plus' })).toBe(false);
  });
});
