import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import type { Problem } from '../src/logic/problems';
import {
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  STAR_SIZE,
  hintDotAt,
  hintDotHitArea,
  layoutHintDots,
  layoutScreen,
  layoutWritingScreen,
} from '../src/logic/screenLayout';
import type { ButtonSlot, ScreenLayout, WritingLayout } from '../src/logic/screenLayout';
import type { MaxNumber } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';

/**
 * Testy ploch pro ťuknutí na tečky nápovědy (#43, AC7): u rozsahu 5 a 10,
 * s číselníkem i při psaní, má každá tečka plochu aspoň 64 × 64 px. Plochy
 * se smí dotýkat, ale nepřekrývat, jsou celé na obrazovce 1024 × 768
 * a nepotkají se s příkladem, číselníkem, okénky na psaní, postavičkou
 * (i s tancem a skokem) ani s hvězdičkami.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;
const MIN_HIT_SIDE = 64;

/** Rozsahy, u kterých jde na tečky ťukat. */
const COUNTING_RANGES: MaxNumber[] = [5, 10];

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function slotBox(slot: ButtonSlot): Box {
  return box(slot.x, slot.y, slot.size, slot.size);
}

/** Překryv bez dotyku: plochy, které se jen dotýkají hranou, se nepřekrývají. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= SCREEN_WIDTH && b.bottom <= SCREEN_HEIGHT;
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

type Top = Omit<ScreenLayout, 'answerButtons'>;

/** Postavička i se skokem a tancem, příklad a hvězdičky. */
function topBoxes(layout: Top): Box[] {
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
  ];
}

function keypadLayout(maxNumber: MaxNumber): ScreenLayout {
  return layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber + 1, STARS_PER_SET);
}

function writingLayout(maxNumber: MaxNumber): WritingLayout {
  return layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, STARS_PER_SET);
}

function keypadBoxes(layout: ScreenLayout): Box[] {
  return [...topBoxes(layout), ...layout.answerButtons.map(slotBox)];
}

function writingBoxes(layout: WritingLayout): Box[] {
  return [
    ...topBoxes(layout),
    ...layout.writingAreas.map((area) => box(area.x, area.y, area.width, area.height)),
    slotBox(layout.confirmButton),
    slotBox(layout.clearButton),
  ];
}

interface Variant {
  readonly others: Box[];
  readonly layoutHint: Top;
}

/** Obě varianty odpovídání (číselník a psaní prstem) pro daný rozsah. */
function variants(maxNumber: MaxNumber): Variant[] {
  const keypad = keypadLayout(maxNumber);
  const writing = writingLayout(maxNumber);
  return [
    { others: keypadBoxes(keypad), layoutHint: keypad },
    { others: writingBoxes(writing), layoutHint: writing },
  ];
}

function hitAreasFor(problem: Problem, layout: Top): ButtonSlot[] {
  return layoutHintDots(hintDotGroups(problem), layout.hint, layout.hintStyle).map(hintDotHitArea);
}

describe('AC7: každá tečka má plochu pro ťuknutí aspoň 64 × 64 px', () => {
  it.each(COUNTING_RANGES)('rozsah %i: plocha je aspoň 64 × 64 px a tečka je uprostřed', (max) => {
    for (const { layoutHint } of variants(max)) {
      for (const problem of allProblems(max)) {
        const dots = layoutHintDots(hintDotGroups(problem), layoutHint.hint, layoutHint.hintStyle);
        for (const dot of dots) {
          const area = hintDotHitArea(dot);
          expect(area.size).toBeGreaterThanOrEqual(MIN_HIT_SIDE);
          expect(area.size).toBeGreaterThanOrEqual(layoutHint.hintStyle.dotSize);
          expect(area.x).toBe(dot.x);
          expect(area.y).toBe(dot.y);
        }
      }
    }
  });

  it.each(COUNTING_RANGES)(
    'rozsah %i: plochy teček se nepřekrývají a jsou celé na obrazovce',
    (max) => {
      for (const { layoutHint } of variants(max)) {
        for (const problem of allProblems(max)) {
          const areas = hitAreasFor(problem, layoutHint).map(slotBox);
          for (const [index, a] of areas.entries()) {
            expect(insideScreen(a)).toBe(true);
            for (const b of areas.slice(index + 1)) {
              expect(overlaps(a, b)).toBe(false);
            }
          }
        }
      }
    },
  );

  it.each(COUNTING_RANGES)(
    'rozsah %i: plochy teček se nepotkají s příkladem, číselníkem ani okénky, postavičkou a hvězdičkami',
    (max) => {
      for (const { layoutHint, others } of variants(max)) {
        for (const problem of allProblems(max)) {
          for (const area of hitAreasFor(problem, layoutHint).map(slotBox)) {
            for (const other of others) {
              expect(overlaps(area, other)).toBe(false);
            }
          }
        }
      }
    },
  );
});

describe('AC1 a AC3: ťuknutí najde tečku, ťuknutí mimo tečky žádnou', () => {
  const problem: Problem = { first: 3, second: 4, operation: 'plus', result: 7 };

  it.each(COUNTING_RANGES)('rozsah %i: ťuknutí do plochy tečky najde právě tu tečku', (max) => {
    for (const { layoutHint } of variants(max)) {
      const dots = layoutHintDots(hintDotGroups(problem), layoutHint.hint, layoutHint.hintStyle);
      for (const [index, dot] of dots.entries()) {
        const half = hintDotHitArea(dot).size / 2;
        expect(hintDotAt(dots, { x: dot.x, y: dot.y })).toBe(index);
        // Kousek od okraje plochy, mimo samotnou tečku 50 px.
        expect(hintDotAt(dots, { x: dot.x + half - 2, y: dot.y - half + 2 })).toBe(index);
      }
    }
  });

  it.each(COUNTING_RANGES)('rozsah %i: ťuknutí mimo tečky nenajde žádnou', (max) => {
    for (const { layoutHint } of variants(max)) {
      const dots = layoutHintDots(hintDotGroups(problem), layoutHint.hint, layoutHint.hintStyle);

      expect(hintDotAt(dots, { x: 0, y: 0 })).toBeNull();
      expect(hintDotAt(dots, { x: SCREEN_WIDTH - 1, y: SCREEN_HEIGHT - 1 })).toBeNull();
      expect(hintDotAt(dots, layoutHint.problem)).toBeNull();
      // Mezera mezi skupinkami 3 a 4: uprostřed mezi poslední tečkou první a první druhé.
      const lastOfFirst = dots[2];
      const firstOfSecond = dots[3];
      expect(lastOfFirst).toBeDefined();
      expect(firstOfSecond).toBeDefined();
      if (lastOfFirst && firstOfSecond) {
        const gapX = (lastOfFirst.x + firstOfSecond.x) / 2;
        expect(hintDotAt(dots, { x: gapX, y: lastOfFirst.y })).toBeNull();
      }
    }
  });

  it('když nápověda nemá žádné tečky (0 + 0), ťuknutí nenajde nic', () => {
    const empty = layoutHintDots([], keypadLayout(5).hint);

    expect(hintDotAt(empty, keypadLayout(5).hint)).toBeNull();
  });
});
