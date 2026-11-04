import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import type { Problem } from '../src/logic/problems';
import {
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  STAR_SIZE,
  layoutHintDots,
  layoutWritingScreen,
} from '../src/logic/screenLayout';
import type { WritingLayout } from '../src/logic/screenLayout';
import { STARS_PER_SET } from '../src/logic/stars';

/**
 * Testy k #41, AC7 (jen to, co jde ověřit v logice rozložení): plocha na
 * psaní aspoň 320 × 320 px na 1024 × 768, ✓ a smazání aspoň 64 × 64 px,
 * vše na obrazovce a nic se nepřekrývá. Vzhled vyblednutí, plynulost
 * a poznámka v nastavení se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const MIN_WRITING_SIDE = 320;
const MIN_BUTTON_SIDE = 64;

/** Rozsahy, ve kterých se odpovídá psaním. */
const WRITING_RANGES = [5, 10] as const;

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

function layoutFor(maxNumber: 5 | 10): WritingLayout {
  return layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, STARS_PER_SET);
}

/** Plocha na psaní, ✓ a smazání. */
function writingBoxes(layout: WritingLayout): Box[] {
  const { writingArea, confirmButton, clearButton } = layout;
  return [
    box(writingArea.x, writingArea.y, writingArea.width, writingArea.height),
    box(confirmButton.x, confirmButton.y, confirmButton.size, confirmButton.size),
    box(clearButton.x, clearButton.y, clearButton.size, clearButton.size),
  ];
}

/** Vše na herní ploše kromě nápovědy: postavička i se skokem a tancem, příklad, hvězdičky, psaní. */
function fixedBoxes(layout: WritingLayout): Box[] {
  const { mascot, problem } = layout;
  return [
    {
      left: mascot.x - MASCOT_SIZE / 2 - MASCOT_DANCE_SWAY,
      right: mascot.x + MASCOT_SIZE / 2 + MASCOT_DANCE_SWAY,
      top: mascot.y - MASCOT_SIZE / 2 - MASCOT_JUMP_HEIGHT,
      bottom: mascot.y + MASCOT_SIZE / 2,
    },
    box(problem.x, problem.y, layout.problemSize.width, layout.problemSize.height),
    ...layout.stars.map((star) => box(star.x, star.y, STAR_SIZE, STAR_SIZE)),
    ...writingBoxes(layout),
  ];
}

/** Všechny příklady s výsledkem 0–9, které při psaní v rozsahu mohou přijít. */
function writingProblems(maxNumber: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; first + second <= Math.min(maxNumber, 9); second += 1) {
      problems.push({ first, second, operation: 'plus', result: first + second });
    }
    for (let second = 0; second <= first; second += 1) {
      if (first - second <= 9) {
        problems.push({ first, second, operation: 'minus', result: first - second });
      }
    }
  }
  return problems;
}

describe('AC7: plocha na psaní a tlačítka jsou dost velké na dětský prst', () => {
  it.each(WRITING_RANGES)('psaní do %i: plocha na psaní má aspoň 320 × 320 px', (max) => {
    const { writingArea } = layoutFor(max);

    expect(writingArea.width).toBeGreaterThanOrEqual(MIN_WRITING_SIDE);
    expect(writingArea.height).toBeGreaterThanOrEqual(MIN_WRITING_SIDE);
  });

  it.each(WRITING_RANGES)('psaní do %i: ✓ a smazání mají aspoň 64 × 64 px', (max) => {
    const layout = layoutFor(max);

    expect(layout.confirmButton.size).toBeGreaterThanOrEqual(MIN_BUTTON_SIDE);
    expect(layout.clearButton.size).toBeGreaterThanOrEqual(MIN_BUTTON_SIDE);
  });

  it.each(WRITING_RANGES)('psaní do %i: vše je na obrazovce a nic se nepřekrývá', (max) => {
    const boxes = fixedBoxes(layoutFor(max));

    for (const [index, a] of boxes.entries()) {
      expect(insideScreen(a)).toBe(true);
      for (const b of boxes.slice(index + 1)) {
        expect(overlaps(a, b)).toBe(false);
      }
    }
  });

  it.each(WRITING_RANGES)(
    'psaní do %i: nápověda s tečkami nepřekryje plochu ani tlačítka',
    (max) => {
      const layout = layoutFor(max);
      const others = fixedBoxes(layout);
      const size = layout.hintStyle.dotSize;

      for (const problem of writingProblems(max)) {
        for (const dot of layoutHintDots(hintDotGroups(problem), layout.hint, layout.hintStyle)) {
          const dotBox = box(dot.x, dot.y, size, size);
          expect(insideScreen(dotBox)).toBe(true);
          for (const other of others) {
            expect(overlaps(dotBox, other)).toBe(false);
          }
        }
      }
    },
  );
});
