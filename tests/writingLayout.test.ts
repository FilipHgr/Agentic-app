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
  writingAreaAt,
} from '../src/logic/screenLayout';
import type { WritingAreaSlot, WritingLayout } from '../src/logic/screenLayout';
import { writingBoxCount } from '../src/logic/settings';
import type { MaxNumber } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';

/**
 * Testy rozložení při psaní (#41 a #42, AC7, jen to, co jde ověřit v logice
 * rozložení): při rozsahu 5 jedno okénko 320 × 320 px, při 10 a 20 dvě
 * okénka vedle sebe aspoň 280 × 280 px s mezerou aspoň 24 px, ✓ a smazání
 * aspoň 64 × 64 px, vše na obrazovce 1024 × 768 a nic se nepřekrývá.
 * Zřetelné oddělení okének, plynulost a telefon se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const SINGLE_BOX_SIDE = 320;
const MIN_BOX_SIDE = 280;
const MIN_BOX_GAP = 24;
const MIN_BUTTON_SIDE = 64;

/** Všechny rozsahy; při psaní se teď píše ve všech (#42, AC1). */
const WRITING_RANGES: MaxNumber[] = [5, 10, 20];

/** Rozsahy se dvěma okénky (desítky a jednotky). */
const TWO_BOX_RANGES: MaxNumber[] = [10, 20];

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function areaBox(area: WritingAreaSlot): Box {
  return box(area.x, area.y, area.width, area.height);
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= SCREEN_WIDTH && b.bottom <= SCREEN_HEIGHT;
}

function layoutFor(maxNumber: MaxNumber): WritingLayout {
  return layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, STARS_PER_SET);
}

/** Okénko desítek a jednotek (jen u rozsahu 10 a 20). */
function tensAndOnes(layout: WritingLayout): [WritingAreaSlot, WritingAreaSlot] {
  const [tens, ones] = layout.writingAreas;
  expect(tens).toBeDefined();
  expect(ones).toBeDefined();
  if (!tens || !ones) {
    throw new Error('Rozložení nemá dvě okénka');
  }
  return [tens, ones];
}

/** Okénka, ✓ a smazání. */
function writingBoxes(layout: WritingLayout): Box[] {
  const { writingAreas, confirmButton, clearButton } = layout;
  return [
    ...writingAreas.map(areaBox),
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

/** Všechny příklady, které v rozsahu mohou přijít (při psaní stejné jako s číselníkem). */
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

describe('AC1: při rozsahu 10 a 20 jsou dvě okénka, při rozsahu 5 jedno', () => {
  it('při rozsahu 5 je jedno okénko jako dřív', () => {
    expect(writingBoxCount(5)).toBe(1);
    expect(layoutFor(5).writingAreas).toHaveLength(1);
  });

  it.each(TWO_BOX_RANGES)('při rozsahu %i jsou dvě okénka', (max) => {
    expect(writingBoxCount(max)).toBe(2);
    expect(layoutFor(max).writingAreas).toHaveLength(2);
  });

  it.each(TWO_BOX_RANGES)(
    'při rozsahu %i jsou okénka vedle sebe, vlevo desítky a vpravo jednotky',
    (max) => {
      const [tens, ones] = tensAndOnes(layoutFor(max));
      const tensBox = areaBox(tens);
      const onesBox = areaBox(ones);

      expect(tensBox.right).toBeLessThanOrEqual(onesBox.left);
      // Vedle sebe: obě okénka jsou ve stejné výšce.
      expect(tens.y).toBe(ones.y);
    },
  );
});

describe('AC2: tah patří okénku, ve kterém začal', () => {
  it.each(TWO_BOX_RANGES)('při rozsahu %i: ťuknutí do okénka najde to správné', (max) => {
    const layout = layoutFor(max);
    const [tens, ones] = tensAndOnes(layout);

    expect(writingAreaAt(layout, { x: tens.x, y: tens.y })).toBe('tens');
    expect(writingAreaAt(layout, { x: ones.x, y: ones.y })).toBe('ones');
    expect(writingAreaAt(layout, { x: tens.x - tens.width / 2 + 2, y: tens.y })).toBe('tens');
    expect(writingAreaAt(layout, { x: ones.x + ones.width / 2 - 2, y: ones.y })).toBe('ones');
  });

  it.each(TWO_BOX_RANGES)('při rozsahu %i: dotyk v mezeře nebo mimo okénka nezačne tah', (max) => {
    const layout = layoutFor(max);
    const [tens, ones] = tensAndOnes(layout);
    const gapX = (tens.x + tens.width / 2 + (ones.x - ones.width / 2)) / 2;

    expect(writingAreaAt(layout, { x: gapX, y: tens.y })).toBeNull();
    expect(writingAreaAt(layout, { x: tens.x, y: tens.y - tens.height / 2 - 10 })).toBeNull();
    expect(writingAreaAt(layout, { x: 0, y: 0 })).toBeNull();
  });

  it('při rozsahu 5 dotyk v okénku najde jediné okénko, mimo něj žádné', () => {
    const layout = layoutFor(5);
    const [only] = layout.writingAreas;
    expect(only).toBeDefined();

    expect(writingAreaAt(layout, { x: only?.x ?? 0, y: only?.y ?? 0 })).not.toBeNull();
    expect(writingAreaAt(layout, { x: 0, y: 0 })).toBeNull();
  });
});

describe('AC7: okénka a tlačítka jsou dost velké na dětský prst', () => {
  it('při rozsahu 5 má okénko aspoň 320 × 320 px jako v #41', () => {
    const [only] = layoutFor(5).writingAreas;

    expect(only?.width).toBeGreaterThanOrEqual(SINGLE_BOX_SIDE);
    expect(only?.height).toBeGreaterThanOrEqual(SINGLE_BOX_SIDE);
  });

  it.each(TWO_BOX_RANGES)('při rozsahu %i má každé okénko aspoň 280 × 280 px', (max) => {
    for (const area of tensAndOnes(layoutFor(max))) {
      expect(area.width).toBeGreaterThanOrEqual(MIN_BOX_SIDE);
      expect(area.height).toBeGreaterThanOrEqual(MIN_BOX_SIDE);
    }
  });

  it.each(TWO_BOX_RANGES)('při rozsahu %i je mezi okénky aspoň 24 px', (max) => {
    const [tens, ones] = tensAndOnes(layoutFor(max));

    expect(areaBox(ones).left - areaBox(tens).right).toBeGreaterThanOrEqual(MIN_BOX_GAP);
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
    'psaní do %i: nápověda s tečkami pro všechny možné příklady nepřekryje nic jiného',
    (max) => {
      const layout = layoutFor(max);
      const others = fixedBoxes(layout);
      const size = layout.hintStyle.dotSize;

      for (const problem of allProblems(max)) {
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
