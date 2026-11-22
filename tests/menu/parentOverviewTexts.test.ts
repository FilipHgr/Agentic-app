import { describe, expect, it } from 'vitest';

import { overviewTexts } from '../../src/menu/logic/menuTexts';
import { frequentMistakeLine, operationShareLine } from '../../src/menu/logic/overviewLines';
import type { MistakenProblem } from '../../src/shared/logic/mistakeActivity';
import { equationKey } from '../../src/shared/logic/overviewProblems';
import type { OverviewOperation } from '../../src/shared/logic/overviewProblems';

/**
 * Texty řádků přehledu pro rodiče (#184), od #192 v menu: podíl napoprvé
 * a řádek časté chyby česky i anglicky.
 */

function mistaken(
  first: number,
  second: number,
  operation: OverviewOperation,
  mistakes: number,
): MistakenProblem {
  return { problem: equationKey(first, operation, second), mistakes };
}

function csLine(mistake: MistakenProblem): string {
  return frequentMistakeLine(overviewTexts('cs').frequentItem, mistake.problem, mistake.mistakes);
}

describe('#184 AC2: podíl příkladů napoprvé zvlášť pro sčítání a odčítání', () => {
  it('řádek podílu česky „Sčítání: 75 % (3/4)“, anglicky „Addition: 75% (3/4)“', () => {
    const share = { operation: 'plus', solved: 4, firstTry: 3, percent: 75 } as const;
    const cs = overviewTexts('cs');
    const en = overviewTexts('en');
    expect(operationShareLine(cs.addition, share, 'cs')).toBe('Sčítání: 75 % (3/4)');
    expect(operationShareLine(en.addition, share, 'en')).toBe('Addition: 75% (3/4)');
    expect(cs.subtraction).toBe('Odčítání');
    expect(en.subtraction).toBe('Subtraction');
  });
});

describe('#184 AC3: řádek časté chyby nevypadá jako výpočet', () => {
  it('česky i anglicky je to příklad a počet chyb v závorce: „8 + 5 (4×)“', () => {
    const mistake = mistaken(8, 5, 'plus', 4);
    const subtraction = mistaken(9, 3, 'minus', 2);
    for (const language of ['cs', 'en'] as const) {
      const template = overviewTexts(language).frequentItem;
      expect(frequentMistakeLine(template, mistake.problem, mistake.mistakes), language).toBe(
        '8 + 5 (4×)',
      );
      expect(
        frequentMistakeLine(template, subtraction.problem, subtraction.mistakes),
        language,
      ).toBe('9 − 3 (2×)');
    }
  });

  it('v řádku není pomlčka ani rovnítko, které by se četly jako počítání', () => {
    const line = csLine(mistaken(9, 3, 'minus', 2));
    expect(line).not.toMatch(/[–=]/);
    expect(line.match(/−/g)).toHaveLength(1);
  });
});

describe('#184 AC4: bez častých chyb rodič vidí „Bez častých chyb“', () => {
  it('nápis je česky „Bez častých chyb“ a anglicky „No frequent mistakes“', () => {
    expect(overviewTexts('cs').noFrequent).toBe('Bez častých chyb');
    expect(overviewTexts('en').noFrequent).toBe('No frequent mistakes');
  });
});
