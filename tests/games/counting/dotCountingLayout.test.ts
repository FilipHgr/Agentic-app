import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  hintDotAt,
  hintDotHitArea,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
} from '../../../src/games/counting/logic/screenLayout';
import type { ScreenLayout, WritingLayout } from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';

/**
 * Testy ploch pro ťuknutí na tečky nápovědy (#43, AC7): u rozsahu 5 a 10,
 * s číselníkem i při psaní, má každá tečka plochu aspoň 64 × 64 herních
 * jednotek s tečkou uprostřed. Plochy se smí dotýkat, ale nepřekrývat, jsou
 * celé na obrazovce 1024 × 768 a nepotkají se s příkladem, číselníkem,
 * okénky na psaní ani s hvězdičkami (od #81 společná pravidla).
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;
const MIN_HIT_SIDE = 64;

/** Rozsahy, u kterých jde na tečky ťukat. */
const COUNTING_RANGES: MaxNumber[] = [5, 10];

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

function keypadLayout(maxNumber: MaxNumber): ScreenLayout {
  return layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber + 1, STARS_PER_SET);
}

function writingLayout(maxNumber: MaxNumber): WritingLayout {
  return layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, STARS_PER_SET);
}

interface Variant {
  readonly screen: ScreenLayout | WritingLayout;
}

/** Obě varianty odpovídání (číselník a psaní prstem) pro daný rozsah. */
function variants(maxNumber: MaxNumber): Variant[] {
  const keypad = keypadLayout(maxNumber);
  const writing = writingLayout(maxNumber);
  return [{ screen: keypad }, { screen: writing }];
}

// Že má každá plocha aspoň 64 × 64 px, plochy se nepřekrývají, jsou celé na
// obrazovce a nepotkají se s příkladem, číselníkem, okénky ani hvězdičkami,
// hlídají od #81 společná pravidla v `countingLayoutRules.test.ts`
// (nápověda na iPadu u všech příkladů s tečkami).

describe('AC7: každá tečka má plochu pro ťuknutí', () => {
  it('rozsah 5 a 10: plocha je aspoň tak velká jako tečka a tečka je uprostřed', () => {
    for (const max of COUNTING_RANGES) {
      for (const { screen } of variants(max)) {
        for (const problem of allProblems(max)) {
          const dots = layoutHint(screen, hintDotGroups(problem));
          const where = `rozsah ${max}, ${problem.first} ${problem.operation} ${problem.second}`;
          for (const dot of dots) {
            const area = hintDotHitArea(dot);
            expect(area.size, where).toBeGreaterThanOrEqual(MIN_HIT_SIDE);
            expect(area.size, where).toBeGreaterThanOrEqual(screen.hintStyle.dotSize);
            expect(area.x, where).toBe(dot.x);
            expect(area.y, where).toBe(dot.y);
          }
        }
      }
    }
  });
});

describe('AC1 a AC3: ťuknutí najde tečku, ťuknutí mimo tečky žádnou', () => {
  const problem: Problem = { first: 3, second: 4, operation: 'plus', result: 7 };

  it('rozsah 5 a 10: ťuknutí do plochy tečky najde právě tu tečku', () => {
    for (const max of COUNTING_RANGES) {
      for (const { screen } of variants(max)) {
        const dots = layoutHint(screen, hintDotGroups(problem));
        for (const [index, dot] of dots.entries()) {
          const half = hintDotHitArea(dot).size / 2;
          const where = `rozsah ${max}, tečka ${index + 1}`;
          expect(hintDotAt(dots, { x: dot.x, y: dot.y }), where).toBe(index);
          // Kousek od okraje plochy, mimo samotnou tečku 50 px.
          expect(hintDotAt(dots, { x: dot.x + half - 2, y: dot.y - half + 2 }), where).toBe(index);
        }
      }
    }
  });

  it('rozsah 5 a 10: ťuknutí mimo tečky nenajde žádnou', () => {
    for (const max of COUNTING_RANGES) {
      for (const { screen } of variants(max)) {
        const dots = layoutHint(screen, hintDotGroups(problem));
        const where = `rozsah ${max}`;

        expect(hintDotAt(dots, { x: 0, y: 0 }), where).toBeNull();
        expect(hintDotAt(dots, { x: SCREEN_WIDTH - 1, y: SCREEN_HEIGHT - 1 }), where).toBeNull();
        expect(hintDotAt(dots, screen.problem), where).toBeNull();
        // Mezera mezi skupinkami 3 a 4: uprostřed mezi poslední tečkou první a první druhé.
        const lastOfFirst = dots[2];
        const firstOfSecond = dots[3];
        expect(lastOfFirst, where).toBeDefined();
        expect(firstOfSecond, where).toBeDefined();
        if (lastOfFirst && firstOfSecond) {
          const gapX = (lastOfFirst.x + firstOfSecond.x) / 2;
          expect(hintDotAt(dots, { x: gapX, y: lastOfFirst.y }), where).toBeNull();
        }
      }
    }
  });

  it('když nápověda nemá žádné tečky (0 + 0), ťuknutí nenajde nic', () => {
    const layout = keypadLayout(5);
    const empty = layoutHint(layout, []);

    expect(empty).toEqual([]);
    expect(hintDotAt(empty, layout.problem)).toBeNull();
  });
});
