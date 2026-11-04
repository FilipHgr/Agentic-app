import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import type { Problem } from '../src/logic/problems';
import { CHECK_BUTTON_COLOR, buttonCornerRadius, checkButtonStyle } from '../src/logic/checkButton';
import {
  ANSWER_BUTTON_SIZE,
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  SMALL_ANSWER_BUTTON_SIZE,
  STAR_SIZE,
  WRITING_BUTTON_SIZE,
  hintDotHitArea,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
  writingAreaAt,
} from '../src/logic/screenLayout';
import type {
  ButtonSlot,
  HintDot,
  ScreenLayout,
  WritingAreaSlot,
  WritingLayout,
} from '../src/logic/screenLayout';
import type { MaxNumber } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';

/**
 * Testy k #46 (větší mezery a jednotný vzhled ovládání) na herní ploše
 * 1024 × 768: mezery v číselníku (AC1, AC2), rozložení okének a tlačítek
 * při psaní (AC3, AC4), zaoblení tlačítek podle velikosti (AC5) a okrajové
 * případy ve všech šesti kombinacích (AC6). Barva, vzhled a zřetelné
 * oddělení na iPadu a telefonu (AC5, AC7) se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const RANGES: MaxNumber[] = [5, 10, 20];
const TWO_BOX_RANGES: MaxNumber[] = [10, 20];

/** Rozsahy, u kterých jde na tečky ťukat (#43). */
const COUNTING_RANGES: MaxNumber[] = [5, 10];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

const ALL_VARIANTS: Array<[MaxNumber, Mode]> = RANGES.flatMap((maxNumber) =>
  MODES.map((mode): [MaxNumber, Mode] => [maxNumber, mode]),
);

/** Okrajové počty hvězdiček z AC6: žádná a plná řada před oslavou. */
const STAR_COUNTS = [0, STARS_PER_SET];

const BOTTOM_MARGIN = 24;

/** Spodní hrana číslic příkladu je 0,36 × velikost písma pod jeho středem (#44). */
const GLYPH_BOTTOM_RATIO = 0.36;

/** Nejmenší mezera nad i pod nápovědou z #44 (AC1). */
const MIN_HINT_GAP: Record<MaxNumber, Record<Mode, number>> = {
  5: { číselník: 140, psaní: 50 },
  10: { číselník: 40, psaní: 50 },
  20: { číselník: 28, psaní: 75 },
};

/** Výjimka z #44 u rozsahu 20 s číselníkem: nápověda na dvě řady pod postavičkou. */
const EXCEPTION_MIN_GAP_BELOW = 16;

/** Tolerance ±1 px u zaoblení a tloušťky fajfky (upřesnění AC5). */
const STYLE_TOLERANCE = 1;

/** O kolik se správné tlačítko zvětší, když zezelená (upřesnění AC7). */
const CORRECT_BUTTON_SCALE = 1.2;

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function slotBox(slot: ButtonSlot, scale = 1): Box {
  return box(slot.x, slot.y, slot.size * scale, slot.size * scale);
}

function areaBox(area: WritingAreaSlot): Box {
  return box(area.x, area.y, area.width, area.height);
}

/** Překryv bez dotyku: plochy, které se jen dotýkají hranou, se nepřekrývají. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= SCREEN_WIDTH && b.bottom <= SCREEN_HEIGHT;
}

function keypadFor(maxNumber: MaxNumber, starCount = STARS_PER_SET): ScreenLayout {
  return layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber + 1, starCount);
}

function writingFor(maxNumber: MaxNumber, starCount = STARS_PER_SET): WritingLayout {
  return layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, starCount);
}

/** Tlačítka číselníku rozdělená do řad shora dolů, každá řada zleva doprava. */
function keypadRows(layout: ScreenLayout): ButtonSlot[][] {
  const rowYs = [...new Set(layout.answerButtons.map((button) => button.y))].sort((a, b) => a - b);
  return rowYs.map((y) =>
    layout.answerButtons.filter((button) => button.y === y).sort((a, b) => a.x - b.x),
  );
}

/** Mezery mezi sousedními tlačítky v řadě. */
function gapsInRow(row: readonly ButtonSlot[]): number[] {
  return row.slice(1).map((button, index) => {
    const previous = row[index];
    return slotBox(button).left - (previous ? slotBox(previous).right : 0);
  });
}

/** Obdélník kolem celé řady tlačítek. */
function rowBounds(row: readonly ButtonSlot[]): Box {
  const boxes = row.map((button) => slotBox(button));
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
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

function onlyArea(layout: WritingLayout): WritingAreaSlot {
  const [only] = layout.writingAreas;
  expect(layout.writingAreas).toHaveLength(1);
  if (!only) {
    throw new Error('Rozložení nemá okénko');
  }
  return only;
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

/** Všechny příklady, které v rozsahu mohou přijít (sčítání i odčítání). */
function allProblems(maxNumber: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; first + second <= maxNumber; second += 1) {
      problems.push(plus(first, second));
    }
    for (let second = 0; second <= first; second += 1) {
      problems.push({ first, second, operation: 'minus', result: first - second });
    }
  }
  return problems.filter((problem) => hintDotGroups(problem).length > 0);
}

function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

type AnyLayout = ScreenLayout | WritingLayout;

interface Variant {
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
  readonly layout: AnyLayout;
  /** Tlačítka číselníku, nebo okénka, ✓ a smazání. */
  readonly controls: Box[];
  readonly controlsTop: number;
}

function variantFor(maxNumber: MaxNumber, mode: Mode, starCount: number): Variant {
  if (mode === 'číselník') {
    const layout = keypadFor(maxNumber, starCount);
    const controls = layout.answerButtons.map((button) => slotBox(button));
    return {
      maxNumber,
      mode,
      layout,
      controls,
      controlsTop: Math.min(...controls.map((control) => control.top)),
    };
  }
  const layout = writingFor(maxNumber, starCount);
  const areas = layout.writingAreas.map(areaBox);
  return {
    maxNumber,
    mode,
    layout,
    controls: [...areas, slotBox(layout.confirmButton), slotBox(layout.clearButton)],
    controlsTop: Math.min(...areas.map((area) => area.top)),
  };
}

/** Postavička i se skokem nahoru a tancem do stran. */
function mascotBox(layout: AnyLayout): Box {
  const { mascot } = layout;
  return {
    left: mascot.x - MASCOT_SIZE / 2 - MASCOT_DANCE_SWAY,
    right: mascot.x + MASCOT_SIZE / 2 + MASCOT_DANCE_SWAY,
    top: mascot.y - MASCOT_SIZE / 2 - MASCOT_JUMP_HEIGHT,
    bottom: mascot.y + MASCOT_SIZE / 2,
  };
}

/** Příklad s místem pro nejdelší výsledek (#40). */
function problemBox(layout: AnyLayout): Box {
  return box(
    layout.problem.x,
    layout.problem.y,
    layout.problemSize.width,
    layout.problemSize.height,
  );
}

/** Vše kromě nápovědy: postavička, příklad, hvězdičky a ovládání. */
function fixedBoxes(variant: Variant): Box[] {
  const { layout } = variant;
  return [
    mascotBox(layout),
    problemBox(layout),
    ...layout.stars.map((star) => box(star.x, star.y, STAR_SIZE, STAR_SIZE)),
    ...variant.controls,
  ];
}

function dotBox(dot: HintDot, layout: AnyLayout): Box {
  const size = layout.hintStyle.dotSize;
  return box(dot.x, dot.y, size, size);
}

function hintBounds(dots: readonly HintDot[], layout: AnyLayout): Box {
  const boxes = dots.map((dot) => dotBox(dot, layout));
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

/** Výjimka z #44: u rozsahu 20 s číselníkem nápověda na dvě řady sahající pod postavičku. */
function isUnderMascotException(variant: Variant, dots: readonly HintDot[]): boolean {
  const rows = new Set(dots.map((dot) => dot.y)).size;
  if (variant.maxNumber !== 20 || variant.mode !== 'číselník' || rows < 2) {
    return false;
  }
  return hintBounds(dots, variant.layout).left < mascotBox(variant.layout).right;
}

describe('AC1: číselník do 5 a do 10 má mezi tlačítky v řadě 24 px', () => {
  it.each([5, 10] as MaxNumber[])('do %i mají všechna tlačítka 140 × 140 px', (max) => {
    for (const button of keypadFor(max).answerButtons) {
      expect(button.size).toBe(140);
    }
    expect(ANSWER_BUTTON_SIZE).toBe(140);
  });

  it.each([5, 10] as MaxNumber[])('do %i je mezi sousedními tlačítky v řadě 24 px', (max) => {
    for (const row of keypadRows(keypadFor(max))) {
      for (const gap of gapsInRow(row)) {
        expect(gap).toBeCloseTo(24, 6);
      }
    }
  });

  it.each([5, 10] as MaxNumber[])(
    'do %i má řada se 6 tlačítky 960 px a vlevo i vpravo zbývá 32 px',
    (max) => {
      const [topRow] = keypadRows(keypadFor(max));
      expect(topRow).toHaveLength(6);
      const bounds = rowBounds(topRow ?? []);

      expect(bounds.right - bounds.left).toBeCloseTo(960, 6);
      expect(bounds.left).toBeCloseTo(32, 6);
      expect(SCREEN_WIDTH - bounds.right).toBeCloseTo(32, 6);
    },
  );

  it.each([5, 10] as MaxNumber[])('do %i je každá řada vodorovně na středu', (max) => {
    for (const row of keypadRows(keypadFor(max))) {
      const bounds = rowBounds(row);
      expect(bounds.left).toBeCloseTo(SCREEN_WIDTH - bounds.right, 6);
    }
  });

  it('do 5 je jedna řada s horní hranou na 604 a 24 px nad spodním okrajem', () => {
    const rows = keypadRows(keypadFor(5));
    expect(rows).toHaveLength(1);
    const bounds = rowBounds(rows[0] ?? []);

    expect(bounds.top).toBe(604);
    expect(SCREEN_HEIGHT - bounds.bottom).toBe(BOTTOM_MARGIN);
  });

  it('do 10 začíná horní řada na 444, mezi řadami je 20 px a dole 24 px', () => {
    const rows = keypadRows(keypadFor(10));
    expect(rows.map((row) => row.length)).toEqual([6, 5]);
    const top = rowBounds(rows[0] ?? []);
    const bottom = rowBounds(rows[1] ?? []);

    expect(top.top).toBe(444);
    expect(bottom.top - top.bottom).toBe(20);
    expect(SCREEN_HEIGHT - bottom.bottom).toBe(BOTTOM_MARGIN);
  });

  it('do 10 má spodní řada s 5 tlačítky 796 px a je na středu (114 px po stranách)', () => {
    const bottom = rowBounds(keypadRows(keypadFor(10))[1] ?? []);

    expect(bottom.right - bottom.left).toBeCloseTo(796, 6);
    expect(bottom.left).toBeCloseTo(114, 6);
  });
});

describe('AC2: číselník do 20 má mezi tlačítky v řadě 20 px', () => {
  it('všechna tlačítka mají 116 × 116 px', () => {
    for (const button of keypadFor(20).answerButtons) {
      expect(button.size).toBe(116);
    }
    expect(SMALL_ANSWER_BUTTON_SIZE).toBe(116);
  });

  it('mezi sousedními tlačítky v řadě je 20 px', () => {
    for (const row of keypadRows(keypadFor(20))) {
      for (const gap of gapsInRow(row)) {
        expect(gap).toBeCloseTo(20, 6);
      }
    }
  });

  it('každá řada má 932 px a vlevo i vpravo zbývá 46 px', () => {
    const rows = keypadRows(keypadFor(20));
    expect(rows.map((row) => row.length)).toEqual([7, 7, 7]);

    for (const row of rows) {
      const bounds = rowBounds(row);
      expect(bounds.right - bounds.left).toBeCloseTo(932, 6);
      expect(bounds.left).toBeCloseTo(46, 6);
      expect(SCREEN_WIDTH - bounds.right).toBeCloseTo(46, 6);
    }
  });

  it('středy řad zůstávají ve výškách 426, 556 a 686, mezi řadami 14 px a dole 24 px', () => {
    const rows = keypadRows(keypadFor(20));
    const bounds = rows.map(rowBounds);

    expect(rows.map((row) => row[0]?.y)).toEqual([426, 556, 686]);
    for (let index = 1; index < bounds.length; index += 1) {
      expect((bounds[index]?.top ?? 0) - (bounds[index - 1]?.bottom ?? 0)).toBe(14);
    }
    expect(SCREEN_HEIGHT - (bounds[2]?.bottom ?? 0)).toBe(BOTTOM_MARGIN);
  });
});

describe('AC3: psaní do 10 a do 20 má mezi okénky 32 px', () => {
  it.each(TWO_BOX_RANGES)('do %i mají obě okénka 280 × 280 px', (max) => {
    for (const area of tensAndOnes(writingFor(max))) {
      expect(area.width).toBe(280);
      expect(area.height).toBe(280);
    }
  });

  it.each(TWO_BOX_RANGES)('do %i je mezi okénky desítek a jednotek 32 px', (max) => {
    const [tens, ones] = tensAndOnes(writingFor(max));

    expect(areaBox(ones).left - areaBox(tens).right).toBeCloseTo(32, 6);
  });

  it.each(TWO_BOX_RANGES)(
    'do %i mají ✓ a smazání 140 × 140 px jako číselník (dosud 120)',
    (max) => {
      const layout = writingFor(max);

      expect(layout.confirmButton.size).toBe(140);
      expect(layout.clearButton.size).toBe(140);
      expect(WRITING_BUTTON_SIZE).toBe(ANSWER_BUTTON_SIZE);
    },
  );

  it.each(TWO_BOX_RANGES)(
    'do %i je smazání vlevo a ✓ vpravo, obě 32 px od okének a svisle na jejich středu',
    (max) => {
      const layout = writingFor(max);
      const [tens, ones] = tensAndOnes(layout);
      const clear = slotBox(layout.clearButton);
      const confirm = slotBox(layout.confirmButton);

      expect(areaBox(tens).left - clear.right).toBeCloseTo(32, 6);
      expect(confirm.left - areaBox(ones).right).toBeCloseTo(32, 6);
      expect(layout.clearButton.y).toBe(tens.y);
      expect(layout.confirmButton.y).toBe(ones.y);
    },
  );

  it.each(TWO_BOX_RANGES)('do %i má celek 936 px a vlevo i vpravo zbývá 44 px', (max) => {
    const layout = writingFor(max);
    const left = slotBox(layout.clearButton).left;
    const right = slotBox(layout.confirmButton).right;

    expect(right - left).toBeCloseTo(936, 6);
    expect(left).toBeCloseTo(44, 6);
    expect(SCREEN_WIDTH - right).toBeCloseTo(44, 6);
  });

  it.each(TWO_BOX_RANGES)('do %i jsou okénka 24 px nad spodním okrajem', (max) => {
    for (const area of tensAndOnes(writingFor(max))) {
      expect(SCREEN_HEIGHT - areaBox(area).bottom).toBe(BOTTOM_MARGIN);
    }
  });

  it.each(TWO_BOX_RANGES)('do %i dotyk kdekoli v mezeře mezi okénky nezačne tah', (max) => {
    const layout = writingFor(max);
    const [tens, ones] = tensAndOnes(layout);
    const gapLeft = areaBox(tens).right;
    const gapRight = areaBox(ones).left;

    for (const x of [gapLeft + 1, (gapLeft + gapRight) / 2, gapRight - 1]) {
      for (const y of [areaBox(tens).top + 1, tens.y, areaBox(tens).bottom - 1]) {
        expect(writingAreaAt(layout, { x, y }), `${x}, ${y}`).toBeNull();
      }
    }
    // Hned vedle mezery už tah začne ve správném okénku.
    expect(writingAreaAt(layout, { x: gapLeft - 1, y: tens.y })).toBe('tens');
    expect(writingAreaAt(layout, { x: gapRight + 1, y: ones.y })).toBe('ones');
  });
});

describe('AC4: psaní do 5 má velké okénko a ✓ a smazání 140 px', () => {
  it('okénko zůstává 320 × 320 px a je 24 px nad spodním okrajem', () => {
    const area = onlyArea(writingFor(5));

    expect(area.width).toBe(320);
    expect(area.height).toBe(320);
    expect(SCREEN_HEIGHT - areaBox(area).bottom).toBe(BOTTOM_MARGIN);
  });

  it('✓ a smazání mají 140 × 140 px', () => {
    const layout = writingFor(5);

    expect(layout.confirmButton.size).toBe(140);
    expect(layout.clearButton.size).toBe(140);
  });

  it('smazání je vlevo a ✓ vpravo, obě 48 px od okénka a svisle na jeho středu', () => {
    const layout = writingFor(5);
    const area = onlyArea(layout);

    expect(areaBox(area).left - slotBox(layout.clearButton).right).toBeCloseTo(48, 6);
    expect(slotBox(layout.confirmButton).left - areaBox(area).right).toBeCloseTo(48, 6);
    expect(layout.clearButton.y).toBe(area.y);
    expect(layout.confirmButton.y).toBe(area.y);
  });

  it('celek má 696 px a je na středu (164 px po stranách)', () => {
    const layout = writingFor(5);
    const left = slotBox(layout.clearButton).left;
    const right = slotBox(layout.confirmButton).right;

    expect(right - left).toBeCloseTo(696, 6);
    expect(left).toBeCloseTo(164, 6);
    expect(SCREEN_WIDTH - right).toBeCloseTo(164, 6);
  });
});

describe('AC5: tlačítka mají zaoblení podle své velikosti', () => {
  it('tlačítko 140 px (číselník do 5 a 10, ✓ a smazání) má zaoblení 25 px', () => {
    expect(buttonCornerRadius(140)).toBe(25);
  });

  it('tlačítko 116 px (číselník do 20) má zaoblení 21 px', () => {
    expect(buttonCornerRadius(116)).toBe(21);
  });

  it('zaoblení je 0,18 × strana zaokrouhlené na celé px i u jiných velikostí', () => {
    for (const size of [64, 100, 116, 120, 140, 150, 200]) {
      const radius = buttonCornerRadius(size);
      expect(Number.isInteger(radius), `${size}`).toBe(true);
      expect(Math.abs(radius - 0.18 * size), `${size}`).toBeLessThanOrEqual(0.5);
    }
  });

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): každé tlačítko ve hře má podle své velikosti zaoblení 25 nebo 21 px',
    (maxNumber, mode) => {
      const buttons =
        mode === 'číselník'
          ? keypadFor(maxNumber).answerButtons
          : [writingFor(maxNumber).confirmButton, writingFor(maxNumber).clearButton];
      const expected = mode === 'číselník' && maxNumber === 20 ? 21 : 25;

      for (const button of buttons) {
        expect(buttonCornerRadius(button.size)).toBe(expected);
      }
    },
  );

  it.each(RANGES)(
    'psaní do %i: ✓ má zaoblení 25 px a fajfku tlustou 0,13 × velikost (18,2 px)',
    (max) => {
      const style = checkButtonStyle(writingFor(max).confirmButton.size);

      expect(Math.abs(style.cornerRadius - 25)).toBeLessThanOrEqual(STYLE_TOLERANCE);
      expect(Math.abs(style.tickWidth - 18.2)).toBeLessThanOrEqual(STYLE_TOLERANCE);
    },
  );

  it('✓ ve hře i ostatní tlačítka používají stejné pravidlo zaoblení jako ✓ v nastavení', () => {
    for (const size of [116, 140, 150]) {
      expect(
        Math.abs(checkButtonStyle(size).cornerRadius - buttonCornerRadius(size)),
      ).toBeLessThanOrEqual(STYLE_TOLERANCE);
    }
  });

  it('✓ při psaní má stejnou zelenou jako dosud', () => {
    expect(CHECK_BUTTON_COLOR).toBe(0x8be04e);
  });
});

describe('AC6: okrajové případy ve všech šesti kombinacích', () => {
  for (const starCount of STAR_COUNTS) {
    it.each(ALL_VARIANTS)(
      `rozsah %i (%s), ${starCount} hvězdiček: vše je celé na herní ploše a nic se nepřekrývá`,
      (maxNumber, mode) => {
        const boxes = fixedBoxes(variantFor(maxNumber, mode, starCount));

        for (const [index, a] of boxes.entries()) {
          expect(insideScreen(a), `prvek ${index}`).toBe(true);
          for (const [offset, b] of boxes.slice(index + 1).entries()) {
            expect(overlaps(a, b), `prvky ${index} a ${index + 1 + offset}`).toBe(false);
          }
        }
      },
    );

    it.each(ALL_VARIANTS)(
      `rozsah %i (%s), ${starCount} hvězdiček: nápověda u každého příkladu je celá na ploše a nic nepřekryje`,
      (maxNumber, mode) => {
        const variant = variantFor(maxNumber, mode, starCount);
        const others = fixedBoxes(variant);

        for (const problem of allProblems(maxNumber)) {
          for (const dot of layoutHint(variant.layout, hintDotGroups(problem))) {
            const own = dotBox(dot, variant.layout);
            expect(insideScreen(own), problemName(problem)).toBe(true);
            for (const other of others) {
              expect(overlaps(own, other), problemName(problem)).toBe(false);
            }
          }
        }
      },
    );

    it.each(ALL_VARIANTS)(
      `rozsah %i (%s), ${starCount} hvězdiček: nad nápovědou i pod ní zůstává nejmenší mezera z #44`,
      (maxNumber, mode) => {
        const variant = variantFor(maxNumber, mode, starCount);
        const minimum = MIN_HINT_GAP[maxNumber][mode];
        const glyphBottom =
          variant.layout.problem.y + GLYPH_BOTTOM_RATIO * variant.layout.problemFontSize;

        for (const problem of allProblems(maxNumber)) {
          const dots = layoutHint(variant.layout, hintDotGroups(problem));
          const bounds = hintBounds(dots, variant.layout);
          const gapBelow = variant.controlsTop - bounds.bottom;
          const label = `${problemName(problem)}: pod ${gapBelow}`;

          if (isUnderMascotException(variant, dots)) {
            // Výjimka z #44: nápověda začíná pod postavičkou a nepřekryje ji.
            expect(bounds.top, label).toBeGreaterThanOrEqual(
              variant.layout.mascot.y + MASCOT_SIZE / 2 - 1,
            );
            expect(overlaps(bounds, mascotBox(variant.layout)), label).toBe(false);
            expect(gapBelow, label).toBeGreaterThanOrEqual(EXCEPTION_MIN_GAP_BELOW);
            continue;
          }
          expect(bounds.top - glyphBottom, label).toBeGreaterThanOrEqual(minimum);
          expect(gapBelow, label).toBeGreaterThanOrEqual(minimum);
        }
      },
    );
  }

  for (const starCount of STAR_COUNTS) {
    it.each(
      COUNTING_RANGES.flatMap((maxNumber) =>
        MODES.map((mode): [MaxNumber, Mode] => [maxNumber, mode]),
      ),
    )(
      `rozsah %i (%s), ${starCount} hvězdiček: plochy pro ťuknutí na tečky se nepotkají s ovládáním`,
      (maxNumber, mode) => {
        const variant = variantFor(maxNumber, mode, starCount);

        for (const problem of allProblems(maxNumber)) {
          for (const dot of layoutHint(variant.layout, hintDotGroups(problem))) {
            const hit = slotBox(hintDotHitArea(dot));
            for (const control of variant.controls) {
              expect(overlaps(hit, control), problemName(problem)).toBe(false);
            }
          }
        }
      },
    );
  }

  it('po změně rozsahu nebo způsobu odpovídání se objeví rozložení té kombinace', () => {
    const fresh = new Map(
      ALL_VARIANTS.map(([maxNumber, mode]) => [
        `${maxNumber}-${mode}`,
        structuredClone(variantFor(maxNumber, mode, STARS_PER_SET).layout),
      ]),
    );
    // Hráč (rodič) přepíná sem a tam mezi všemi kombinacemi.
    const switches = [...ALL_VARIANTS, ...[...ALL_VARIANTS].reverse(), ...ALL_VARIANTS];

    for (const [maxNumber, mode] of switches) {
      const key = `${maxNumber}-${mode}`;
      expect(variantFor(maxNumber, mode, STARS_PER_SET).layout, key).toEqual(fresh.get(key));
    }
  });

  it('každá kombinace má své vlastní ovládání', () => {
    expect(keypadFor(5).answerButtons).toHaveLength(6);
    expect(keypadFor(10).answerButtons).toHaveLength(11);
    expect(keypadFor(20).answerButtons).toHaveLength(21);
    expect(writingFor(5).writingAreas).toHaveLength(1);
    expect(writingFor(10).writingAreas).toHaveLength(2);
    expect(writingFor(20).writingAreas).toHaveLength(2);
  });
});

describe('AC7: zvětšené zelené tlačítko nepřekryje sousední', () => {
  it.each(RANGES)(
    'číselník do %i: tlačítko zvětšené 1,2× nepřekryje žádné jiné a zůstane na ploše',
    (max) => {
      const buttons = keypadFor(max).answerButtons;

      for (const [index, button] of buttons.entries()) {
        const grown = slotBox(button, CORRECT_BUTTON_SCALE);
        expect(insideScreen(grown), `${index}`).toBe(true);
        for (const [other, neighbour] of buttons.entries()) {
          if (other !== index) {
            expect(overlaps(grown, slotBox(neighbour)), `${index} a ${other}`).toBe(false);
          }
        }
      }
    },
  );

  it.each(RANGES)('psaní do %i: ✓ zvětšené 1,2× nepřekryje okénko a zůstane na ploše', (max) => {
    const layout = writingFor(max);
    const grown = slotBox(layout.confirmButton, CORRECT_BUTTON_SCALE);

    expect(insideScreen(grown)).toBe(true);
    for (const area of layout.writingAreas) {
      expect(overlaps(grown, areaBox(area))).toBe(false);
    }
  });
});
