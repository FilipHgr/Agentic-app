import { describe, expect, it } from 'vitest';

import { hintDotGroups, isHintVisible, tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import type { Problem } from '../src/logic/problems';
import {
  STAR_SIZE,
  hintDotHitArea,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
} from '../src/logic/screenLayout';
import type { HintDot, ScreenLayout, WritingLayout } from '../src/logic/screenLayout';
import type { MaxNumber } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';

/**
 * Testy vyváženého rozložení herní obrazovky (#44) na herní ploše 1024 × 768:
 * nápověda svisle uprostřed mezi příkladem a ovládáním podle skutečného počtu
 * řad teček, skupinky teček zarovnané nahoře, nápověda vodorovně pod středem
 * příkladu, hvězdičky 37 px od horního okraje (od #52) a větší tečky
 * u rozsahu 5. Od #63 je vedle příkladu volno: příklad je větší
 * a uprostřed a nápověda se počítá od spodku boxu textu příkladu.
 * Vyrovnaný dojem na iPadu a telefonu (AC7) se kontroluje ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const RANGES: MaxNumber[] = [5, 10, 20];

/** Rozsahy, u kterých jde na tečky ťukat (#43). */
const COUNTING_RANGES: MaxNumber[] = [5, 10];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

/** Box textu příkladu je vysoký 1,2 × písmo, spodek je tedy 0,6 × písmo pod středem (#63). */
const TEXT_BOTTOM_RATIO = 0.6;

/**
 * Nejmenší mezera nad i pod nápovědou. Od #63 se měří od spodku boxu textu
 * příkladu; hodnoty jsou kontrolní výpočet z #63 AC2 pro nejvyšší nápovědu
 * v rozsahu (dolů zaokrouhlené), nižší nápověda má mezery větší.
 */
const MIN_GAP: Record<MaxNumber, Record<Mode, number>> = {
  5: { číselník: 116, psaní: 26 },
  10: { číselník: 20, psaní: 30 },
  20: { číselník: 14, psaní: 62 },
};

/** Jak moc se smí lišit mezera nad a pod nápovědou. */
const GAP_TOLERANCE = 2;

/** Okraj příkladu i nápovědy od levé a pravé hrany herní plochy (#63, AC2). */
const MIN_SIDE_MARGIN = 24;

/**
 * Horní okraj hvězdiček od horního okraje herní plochy. Od #52 jsou
 * hvězdičky 30 px a střed řady zůstává ve výšce 52 px, proto 52 − 15 = 37.
 */
const STARS_TOP = 37;

/** Pravý horní roh, kam se nesmí dostat žádný herní prvek (kolečko nastavení). */
const SETTINGS_CORNER: Box = { left: 982, right: 1024, top: 11, bottom: 82 };

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

/** Překryv bez dotyku: plochy, které se jen dotýkají hranou, se nepřekrývají. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= SCREEN_WIDTH && b.bottom <= SCREEN_HEIGHT;
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Všechny příklady, které v rozsahu mohou přijít (sčítání i odčítání). */
function allProblems(maxNumber: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; first + second <= maxNumber; second += 1) {
      problems.push(plus(first, second));
    }
    for (let second = 0; second <= first; second += 1) {
      problems.push(minus(first, second));
    }
  }
  return problems;
}

/** Příklady, u kterých se ukáže aspoň jedna tečka. */
function problemsWithDots(maxNumber: number): Problem[] {
  return allProblems(maxNumber).filter((problem) => hintDotGroups(problem).length > 0);
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
  /** Horní hrana ovládání: horní řada číselníku nebo okénka na psaní. */
  readonly controlsTop: number;
  /** Plochy ovládání (tlačítka číselníku, nebo okénka, ✓ a smazání). */
  readonly controls: Box[];
}

function keypadVariant(maxNumber: MaxNumber, starCount: number): Variant {
  const layout = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber + 1, starCount);
  const controls = layout.answerButtons.map((button) =>
    box(button.x, button.y, button.size, button.size),
  );
  return {
    maxNumber,
    mode: 'číselník',
    layout,
    controlsTop: Math.min(...controls.map((control) => control.top)),
    controls,
  };
}

function writingVariant(maxNumber: MaxNumber, starCount: number): Variant {
  const layout = layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, starCount);
  const areas = layout.writingAreas.map((area) => box(area.x, area.y, area.width, area.height));
  const { confirmButton, clearButton } = layout;
  return {
    maxNumber,
    mode: 'psaní',
    layout,
    controlsTop: Math.min(...areas.map((area) => area.top)),
    controls: [
      ...areas,
      box(confirmButton.x, confirmButton.y, confirmButton.size, confirmButton.size),
      box(clearButton.x, clearButton.y, clearButton.size, clearButton.size),
    ],
  };
}

function variantFor(maxNumber: MaxNumber, mode: Mode, starCount = STARS_PER_SET): Variant {
  return mode === 'číselník'
    ? keypadVariant(maxNumber, starCount)
    : writingVariant(maxNumber, starCount);
}

/** Všechny kombinace rozsahu a způsobu odpovídání pro `it.each`. */
const ALL_VARIANTS: Array<[MaxNumber, Mode]> = RANGES.flatMap((maxNumber) =>
  MODES.map((mode): [MaxNumber, Mode] => [maxNumber, mode]),
);

/** Celá výška textu příkladu i s rezervou (místo pro nejdelší příklad). */
function problemBox(layout: AnyLayout): Box {
  return box(
    layout.problem.x,
    layout.problem.y,
    layout.problemSize.width,
    layout.problemSize.height,
  );
}

function starBoxes(layout: AnyLayout): Box[] {
  return layout.stars.map((star) => box(star.x, star.y, STAR_SIZE, STAR_SIZE));
}

/** Spodní hrana boxu textu příkladu (1,2 × písmo vysokého), od které se měří nápověda. */
function textBottom(layout: AnyLayout): number {
  return layout.problem.y + TEXT_BOTTOM_RATIO * layout.problemFontSize;
}

function dotBox(dot: HintDot, layout: AnyLayout): Box {
  const size = layout.hintStyle.dotSize;
  return box(dot.x, dot.y, size, size);
}

/** Obdélník kolem všech teček nápovědy (okraje teček, ne středy). */
function hintBounds(dots: readonly HintDot[], layout: AnyLayout): Box {
  const boxes = dots.map((dot) => dotBox(dot, layout));
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

function hintFor(variant: Variant, problem: Problem): HintDot[] {
  return layoutHint(variant.layout, hintDotGroups(problem));
}

/** Počet řad teček v nápovědě (podle různých výšek středů). */
function rowCount(dots: readonly HintDot[]): number {
  return new Set(dots.map((dot) => dot.y)).size;
}

describe('AC1: nápověda je svisle uprostřed mezi příkladem a ovládáním', () => {
  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): u každého příkladu je nad i pod nápovědou stejně místa a dost místa',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const minimum = MIN_GAP[maxNumber][mode];

      for (const problem of problemsWithDots(maxNumber)) {
        const dots = hintFor(variant, problem);
        const bounds = hintBounds(dots, variant.layout);
        const gapAbove = bounds.top - textBottom(variant.layout);
        const gapBelow = variant.controlsTop - bounds.bottom;
        const label = `${problemName(problem)}: nad ${gapAbove}, pod ${gapBelow}`;

        expect(Math.abs(gapAbove - gapBelow), label).toBeLessThanOrEqual(GAP_TOLERANCE);
        expect(gapAbove, label).toBeGreaterThanOrEqual(minimum);
        expect(gapBelow, label).toBeGreaterThanOrEqual(minimum);
      }
    },
  );

  it('rozsah 20 s číselníkem: i široká nápověda na dvě řady je uprostřed, žádná výjimka (#63)', () => {
    const variant = variantFor(20, 'číselník');
    let wideTwoRows = 0;

    for (const problem of problemsWithDots(20)) {
      const dots = hintFor(variant, problem);
      if (rowCount(dots) < 2) {
        continue;
      }
      wideTwoRows += 1;
      const bounds = hintBounds(dots, variant.layout);
      const gapAbove = bounds.top - textBottom(variant.layout);
      const gapBelow = variant.controlsTop - bounds.bottom;
      const label = `${problemName(problem)}: nad ${gapAbove}, pod ${gapBelow}`;

      expect(Math.abs(gapAbove - gapBelow), label).toBeLessThanOrEqual(GAP_TOLERANCE);
      expect(gapAbove, label).toBeGreaterThanOrEqual(MIN_GAP[20]['číselník']);
    }

    // Široké nápovědy na dvě řady opravdu nastávají (třeba 20 teček nebo 10 + 10).
    expect(wideTwoRows).toBeGreaterThan(0);
  });

  it('nápověda na jednu řadu je níž než nápověda na dvě řady (sedí podle skutečného počtu řad)', () => {
    const variant = variantFor(10, 'číselník');
    const oneRow = hintBounds(hintFor(variant, plus(3, 2)), variant.layout);
    const twoRows = hintBounds(hintFor(variant, plus(7, 3)), variant.layout);

    expect(oneRow.top).toBeGreaterThan(twoRows.top);
    // Střed nápovědy je v obou případech na stejném místě.
    const oneRowCenter = (oneRow.top + oneRow.bottom) / 2;
    const twoRowsCenter = (twoRows.top + twoRows.bottom) / 2;
    expect(Math.abs(oneRowCenter - twoRowsCenter)).toBeLessThanOrEqual(GAP_TOLERANCE);
  });
});

describe('AC2: skupinky teček mají horní řadu ve stejné výšce', () => {
  it('u 7 + 3 jsou horní žluté i modré tečky v jedné řadě a 2 žluté pod žlutými', () => {
    const variant = variantFor(10, 'číselník');
    const dots = hintFor(variant, plus(7, 3));
    const rowYs = [...new Set(dots.map((dot) => dot.y))].sort((a, b) => a - b);
    const [topY, secondY] = rowYs;
    const yellow = dots.filter((dot) => dot.group === 0);
    const blue = dots.filter((dot) => dot.group === 1);
    const secondRow = dots.filter((dot) => dot.y === secondY);

    expect(rowYs).toHaveLength(2);
    expect(yellow.filter((dot) => dot.y === topY)).toHaveLength(5);
    expect(blue.filter((dot) => dot.y === topY)).toHaveLength(3);
    expect(secondRow).toHaveLength(2);
    expect(secondRow.every((dot) => dot.group === 0)).toBe(true);
    const yellowRight = Math.max(...yellow.map((dot) => dot.x));
    const blueLeft = Math.min(...blue.map((dot) => dot.x));
    for (const dot of secondRow) {
      expect(dot.x).toBeLessThanOrEqual(yellowRight);
      expect(dot.x).toBeLessThan(blueLeft);
    }
  });

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): u každého příkladu začínají všechny skupinky ve stejné výšce',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);

      for (const problem of problemsWithDots(maxNumber)) {
        const dots = hintFor(variant, problem);
        const groupCount = hintDotGroups(problem).length;
        const groupTops = new Set(
          Array.from({ length: groupCount }, (_, group) =>
            Math.min(...dots.filter((dot) => dot.group === group).map((dot) => dot.y)),
          ),
        );

        expect(groupTops.size, problemName(problem)).toBe(1);
      }
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): další řady skupinky jsou jen pod její horní řadou',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);

      for (const problem of problemsWithDots(maxNumber)) {
        const dots = hintFor(variant, problem);
        hintDotGroups(problem).forEach((_, group) => {
          const own = dots.filter((dot) => dot.group === group);
          const topY = Math.min(...own.map((dot) => dot.y));
          const topRow = own.filter((dot) => dot.y === topY).map((dot) => dot.x);
          for (const dot of own) {
            expect(dot.x, problemName(problem)).toBeGreaterThanOrEqual(Math.min(...topRow));
            expect(dot.x, problemName(problem)).toBeLessThanOrEqual(Math.max(...topRow));
          }
        });
      }
    },
  );

  it.each(MODES)('rozsah 5 a 10 (%s): v řadě skupinky je nejvýš 5 teček', (mode) => {
    for (const maxNumber of COUNTING_RANGES) {
      const variant = variantFor(maxNumber, mode);
      for (const problem of problemsWithDots(maxNumber)) {
        const dots = hintFor(variant, problem);
        const rows = new Map<string, number>();
        for (const dot of dots) {
          const key = `${dot.group}:${dot.y}`;
          rows.set(key, (rows.get(key) ?? 0) + 1);
        }
        expect(Math.max(...rows.values()), problemName(problem)).toBeLessThanOrEqual(5);
      }
    }
  });

  it.each(MODES)('rozsah 10 (%s): 10 teček je řada 5 a pod ní řada 5', (mode) => {
    const dots = hintFor(variantFor(10, mode), plus(10, 0));
    const rowYs = [...new Set(dots.map((dot) => dot.y))];

    expect(rowYs).toHaveLength(2);
    for (const y of rowYs) {
      expect(dots.filter((dot) => dot.y === y)).toHaveLength(5);
    }
  });

  it.each(MODES)('rozsah 20 (%s): tečky jsou po 10 v řadě s mezerou za pětkou', (mode) => {
    const dots = hintFor(variantFor(20, mode), plus(20, 0));
    const rowYs = [...new Set(dots.map((dot) => dot.y))].sort((a, b) => a - b);

    expect(rowYs).toHaveLength(2);
    for (const y of rowYs) {
      const xs = dots
        .filter((dot) => dot.y === y)
        .map((dot) => dot.x)
        .sort((a, b) => a - b);
      expect(xs).toHaveLength(10);
      const steps = xs.slice(1).map((x, index) => x - (xs[index] ?? 0));
      const afterFive = steps[4] ?? 0;
      const usual = steps[0] ?? 0;
      expect(afterFive).toBeGreaterThan(usual);
      for (const [index, step] of steps.entries()) {
        if (index !== 4) {
          expect(step).toBeCloseTo(usual, 6);
        }
      }
    }
  });
});

describe('AC3: nápověda je vodorovně pod středem příkladu a nic není v rohu s kolečkem', () => {
  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): u každého příkladu je střed nápovědy přesně pod středem příkladu',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);

      for (const problem of problemsWithDots(maxNumber)) {
        const bounds = hintBounds(hintFor(variant, problem), variant.layout);

        expect((bounds.left + bounds.right) / 2, problemName(problem)).toBeCloseTo(
          variant.layout.problem.x,
          6,
        );
      }
    },
  );

  it.each(ALL_VARIANTS)('rozsah %i (%s): každá tečka je celá na herní ploše', (maxNumber, mode) => {
    const variant = variantFor(maxNumber, mode);

    for (const problem of problemsWithDots(maxNumber)) {
      for (const dot of hintFor(variant, problem)) {
        expect(insideScreen(dotBox(dot, variant.layout)), problemName(problem)).toBe(true);
      }
    }
  });

  it.each(MODES)('rozsah 20 (%s): i nejširší nápověda 10 + 10 je celá na herní ploše', (mode) => {
    const variant = variantFor(20, mode);
    const dots = hintFor(variant, plus(10, 10));

    expect(dots).toHaveLength(20);
    expect(insideScreen(hintBounds(dots, variant.layout))).toBe(true);
  });

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): do pravého horního rohu s kolečkem nezasahuje žádný herní prvek',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const { layout } = variant;
      const fixed = [problemBox(layout), ...starBoxes(layout), ...variant.controls];

      for (const element of fixed) {
        expect(overlaps(element, SETTINGS_CORNER)).toBe(false);
      }
      for (const problem of problemsWithDots(maxNumber)) {
        for (const dot of hintFor(variant, problem)) {
          expect(overlaps(dotBox(dot, layout), SETTINGS_CORNER), problemName(problem)).toBe(false);
          if (COUNTING_RANGES.includes(maxNumber)) {
            const area = hintDotHitArea(dot);
            const hitBox = box(area.x, area.y, area.size, area.size);
            expect(overlaps(hitBox, SETTINGS_CORNER), problemName(problem)).toBe(false);
          }
        }
      }
    },
  );
});

describe('AC4: příklad je ve stejné výšce jako dřív a hvězdičky 37 px od horního okraje (#52: střed řady 52 px)', () => {
  it.each(COUNTING_RANGES.flatMap((maxNumber) => MODES.map((mode) => [maxNumber, mode] as const)))(
    'rozsah %i (%s): příklad má střed na y 199,68 (0,26 výšky plochy)',
    (maxNumber, mode) => {
      const { layout } = variantFor(maxNumber, mode);

      expect(layout.problem.y).toBeCloseTo(199.68, 6);
    },
  );

  it.each(MODES)('rozsah 20 (%s): příklad má střed na y 194', (mode) => {
    const { layout } = variantFor(20, mode);

    expect(layout.problem.y).toBe(194);
  });

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): příklad je vodorovně uprostřed herní plochy (#63)',
    (maxNumber, mode) => {
      const { layout } = variantFor(maxNumber, mode);

      expect(Math.abs(layout.problem.x - SCREEN_WIDTH / 2)).toBeLessThanOrEqual(1);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): hvězdičky mají horní okraj 37 px při jakémkoli počtu',
    (maxNumber, mode) => {
      for (let starCount = 1; starCount <= STARS_PER_SET; starCount += 1) {
        const { layout } = variantFor(maxNumber, mode, starCount);
        expect(layout.stars).toHaveLength(starCount);
        for (const star of starBoxes(layout)) {
          expect(star.top, `${starCount} hvězdiček`).toBe(STARS_TOP);
        }
      }
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): plná řada 10 hvězdiček nepřekrývá příklad',
    (maxNumber, mode) => {
      const { layout } = variantFor(maxNumber, mode);

      for (const star of starBoxes(layout)) {
        expect(overlaps(star, problemBox(layout))).toBe(false);
      }
    },
  );
});

describe('AC5: u rozsahu 5 je příklad i tečky větší', () => {
  it.each(MODES)('rozsah 5 (%s): příklad má písmo 184 (od #63, dřív 160)', (mode) => {
    expect(variantFor(5, mode).layout.problemFontSize).toBe(184);
  });

  it.each(MODES)(
    'rozsah 5 (%s): tečky mají průměr 60 px a rozestup 76 px, mezera mezi skupinkami zůstává',
    (mode) => {
      expect(variantFor(5, mode).layout.hintStyle).toEqual({
        dotSize: 60,
        spacing: 76,
        dotsPerRow: 5,
        fiveGap: 0,
        groupGap: 60,
      });
    },
  );

  it.each(MODES)('rozsah 5 (%s): sousední tečky mají středy 76 px od sebe', (mode) => {
    const dots = hintFor(variantFor(5, mode), plus(3, 2));
    const first = dots.filter((dot) => dot.group === 0).map((dot) => dot.x);
    const second = dots.filter((dot) => dot.group === 1).map((dot) => dot.x);

    expect((first[1] ?? 0) - (first[0] ?? 0)).toBeCloseTo(76, 6);
    // Mezi skupinkami je běžný rozestup a navíc stejná mezera jako dosud (60 px).
    expect(Math.min(...second) - Math.max(...first)).toBeCloseTo(76 + 60, 6);
  });

  it.each(MODES)(
    'rozsah 5 (%s): nejdelší vyřešený příklad se vejde s okrajem aspoň 24 na každé straně a nepřekryje hvězdičky',
    (mode) => {
      const { layout } = variantFor(5, mode);
      const problem = problemBox(layout);

      expect(problem.left).toBeGreaterThanOrEqual(MIN_SIDE_MARGIN);
      expect(problem.right).toBeLessThanOrEqual(SCREEN_WIDTH - MIN_SIDE_MARGIN);
      for (const star of starBoxes(layout)) {
        expect(overlaps(problem, star)).toBe(false);
      }
    },
  );

  it.each(MODES)(
    'rozsah 10 (%s): písmo je 150 (od #63, dřív 130) a tečky zůstávají jako dosud',
    (mode) => {
      const { layout } = variantFor(10, mode);

      expect(layout.problemFontSize).toBe(150);
      expect(layout.hintStyle).toEqual({
        dotSize: 50,
        spacing: 64,
        dotsPerRow: 5,
        fiveGap: 0,
        groupGap: 60,
      });
    },
  );

  it.each(MODES)(
    'rozsah 20 (%s): písmo je 116 (od #63, dřív 110) a tečky zůstávají jako dosud',
    (mode) => {
      const { layout } = variantFor(20, mode);

      expect(layout.problemFontSize).toBe(116);
      expect(layout.hintStyle).toEqual({
        dotSize: 34,
        spacing: 42,
        dotsPerRow: 10,
        fiveGap: 10,
        groupGap: 40,
      });
    },
  );
});

/** Kolo s pevným příkladem, aby testy nezávisely na náhodě. */
function roundFor(problem: Problem, maxNumber: MaxNumber): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 0, solved: false };
}

/** Rozložení bez nápovědy: příklad, ovládání a výška hvězdiček. */
function fixedPart(variant: Variant): unknown {
  const { layout } = variant;
  return {
    problem: layout.problem,
    problemFontSize: layout.problemFontSize,
    problemSize: layout.problemSize,
    hintStyle: layout.hintStyle,
    controls: variant.controls,
    starTops: [...new Set(starBoxes(layout).map((star) => star.top))],
  };
}

describe('AC6: okrajové případy a návaznosti', () => {
  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): s přibývajícími hvězdičkami až po oslavu zůstává vše na místě',
    (maxNumber, mode) => {
      const first = fixedPart(variantFor(maxNumber, mode, 1));

      for (let starCount = 2; starCount <= STARS_PER_SET; starCount += 1) {
        expect(fixedPart(variantFor(maxNumber, mode, starCount)), `${starCount}`).toEqual(first);
      }
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): nápověda je u daného příkladu na stejném místě při jakémkoli počtu hvězdiček',
    (maxNumber, mode) => {
      const problem = maxNumber === 5 ? plus(3, 2) : plus(7, 3);
      const expected = hintFor(variantFor(maxNumber, mode, 0), problem);

      for (let starCount = 1; starCount <= STARS_PER_SET; starCount += 1) {
        expect(hintFor(variantFor(maxNumber, mode, starCount), problem)).toEqual(expected);
      }
    },
  );

  it.each(RANGES)(
    'rozsah %i: po špatných odpovědích se rozložení nezmění a po 2. chybě se nápověda ukáže podle AC1 až AC3',
    (maxNumber) => {
      const problem = plus(2, 3);
      const variant = variantFor(maxNumber, 'číselník');
      const before = structuredClone(variant.layout);
      let round = roundFor(problem, maxNumber);
      round = tapAnswer(round, 0).round;
      round = tapAnswer(round, 1).round;

      expect(isHintVisible(round)).toBe(true);
      expect(variantFor(maxNumber, 'číselník').layout).toEqual(before);
      const dots = layoutHint(variant.layout, hintDotGroups(round.problem));
      const bounds = hintBounds(dots, variant.layout);
      const gapAbove = bounds.top - textBottom(variant.layout);
      const gapBelow = variant.controlsTop - bounds.bottom;
      expect(dots).toHaveLength(5);
      expect(Math.abs(gapAbove - gapBelow)).toBeLessThanOrEqual(GAP_TOLERANCE);
      expect((bounds.left + bounds.right) / 2).toBeCloseTo(variant.layout.problem.x, 6);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): příklad bez teček nic nevykreslí a zbytek rozložení zůstane stejný',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const before = structuredClone(variant.layout);

      // 5 − 5 má podle #30 pět přeškrtnutých teček, bez teček je jen 0 + 0 a 0 − 0.
      for (const problem of [plus(0, 0), minus(0, 0)]) {
        expect(hintDotGroups(problem)).toEqual([]);
        expect(layoutHint(variant.layout, hintDotGroups(problem))).toEqual([]);
      }
      expect(variant.layout).toEqual(before);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): tečky nápovědy nepřekrývají příklad, ovládání ani hvězdičky',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const others = [
        problemBox(variant.layout),
        ...starBoxes(variant.layout),
        ...variant.controls,
      ];

      for (const problem of problemsWithDots(maxNumber)) {
        const dots = hintFor(variant, problem);
        for (const [index, dot] of dots.entries()) {
          const own = dotBox(dot, variant.layout);
          for (const other of others) {
            expect(overlaps(own, other), problemName(problem)).toBe(false);
          }
          for (const next of dots.slice(index + 1)) {
            expect(overlaps(own, dotBox(next, variant.layout)), problemName(problem)).toBe(false);
          }
        }
      }
    },
  );

  it('u 7 + 3 jdou tečky po skupinkách jako dosud (kvůli barvám a přeškrtávání): nejdřív žluté, potom modré', () => {
    const dots = hintFor(variantFor(10, 'číselník'), plus(7, 3));

    expect(dots.map((dot) => dot.group)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
  });
});
