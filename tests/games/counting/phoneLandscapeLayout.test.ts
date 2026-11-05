import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutPhoneHint,
  layoutPhoneScreen,
  layoutPhoneWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type {
  PhoneScreenLayout,
  PhoneWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  layoutScreen,
  layoutWritingScreen,
  writingAreaAt,
} from '../../../src/games/counting/logic/screenLayout';
import type {
  ButtonSlot,
  HintDot,
  WritingAreaSlot,
} from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  JUST_ABOVE_LIMIT,
  PHONE_WINDOWS,
  box,
  boundsOf,
  freeAreaOf,
  gapBetween,
  gearCornerOf,
  heightOf,
  isInside,
  overlaps,
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #54 (hra na telefonu na šířku), AC1 až AC4 v rozložení V2
 * (poslední komentář issue) a AC6 (okno těsně pod a nad hranicí 500 px).
 * Všechny velikosti se přepočítají z herních jednotek na CSS px (px na
 * skutečném displeji) a ověří na zkušebních oknech 744×296, 800×300,
 * 844×340 (výřez 47/47/21), 932×430 (výřez 59/59/21) a 932×499, pro
 * rozsahy 5, 10 a 20, s číselníkem i s psaním, bez nápovědy i s nápovědou
 * u okrajových a typických příkladů (viz `sampleHintProblems`). Oslava
 * (konfety) se kontroluje i ručně v náhledu na iPhonu a Samsungu. Od #63
 * je příklad bez nikoho vedle (viz `phoneBiggerProblem.test.ts`).
 *
 * Rozložení s nápovědou: `layoutPhoneScreen` a `layoutPhoneWritingScreen`
 * dostanou skupinky teček nápovědy (prázdné = bez nápovědy) a smí pro ně
 * udělat místo, třeba zmenšit tlačítka na 64 px nebo posunout příklad.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const TWO_BOX_RANGES: MaxNumber[] = [10, 20];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

/** Plná řada hvězdiček (oslava po deseti) i prázdná řada. */
const STAR_COUNTS = [0, STARS_PER_SET];

/** Nejmenší tlačítko a nejmenší mezera mezi tlačítky v CSS px (AC1). */
const MIN_BUTTON_SIDE = 64;
const MIN_BUTTON_GAP = 8;

/** AC3 v CSS px. */
const MIN_STAR_SIZE = 24;
const MIN_PROBLEM_FONT_SIZE = 32;

/** AC4 v CSS px (nové znění po rozhodnutí vlastníka v #54: jedno okénko 180 px). */
const MIN_SINGLE_BOX_SIDE = 180;
const MIN_TWO_BOX_SIDE = 150;

/** Ťukací plocha tečky u číselníku do 5 a do 10 a nejmenší tečka jen k dívání (AC2), v CSS px. */
const MIN_DOT_HIT_SIDE = 48;
const MIN_LOOK_ONLY_DOT_SIZE = 20;

/** Tečky nápovědy po pěti v řadě (#30). */
const DOTS_PER_ROW = 5;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Tolerance pro „uprostřed“ v CSS px. */
const CENTER_TOLERANCE = 1;

type PhoneLayout = PhoneScreenLayout | PhoneWritingLayout;

interface PhoneVariant {
  readonly window: TestWindow;
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
  readonly area: GameArea;
  readonly layout: PhoneLayout;
}

interface Element {
  readonly name: string;
  readonly css: Box;
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

/** Příklady, u kterých se po 2. chybě ukáže aspoň jedna tečka. */
function problemsWithDots(maxNumber: number): Problem[] {
  return allProblems(maxNumber).filter((problem) => hintDotGroups(problem).length > 0);
}

/** Kolik řad teček zabere skupinka (po pěti v řadě). */
function rowsOfGroup(dots: number): number {
  return Math.ceil(dots / DOTS_PER_ROW);
}

/** Kolik řad teček zaberou všechny skupinky nápovědy příkladu dohromady. */
function totalHintRows(problem: Problem): number {
  return hintDotGroups(problem).reduce((rows, dots) => rows + rowsOfGroup(dots), 0);
}

/** Nejvíc teček v jedné skupince nápovědy příkladu. */
function largestHintGroup(problem: Problem): number {
  return Math.max(...hintDotGroups(problem));
}

/** Kolik teček ukáže nápověda příkladu celkem. */
function totalHintDots(problem: Problem): number {
  return hintDotGroups(problem).reduce((sum, dots) => sum + dots, 0);
}

/** Sčítání se dvěma skupinkami, u kterého nápověda zabere nejvíc řad (první a poslední takové). */
function mostRowsProblems(maxNumber: number): Problem[] {
  const twoGroups = problemsWithDots(maxNumber).filter(
    (problem) => hintDotGroups(problem).length === 2,
  );
  const mostRows = Math.max(...twoGroups.map(totalHintRows));
  const withMostRows = twoGroups.filter((problem) => totalHintRows(problem) === mostRows);
  return [withMostRows[0], withMostRows[withMostRows.length - 1]].filter(
    (problem): problem is Problem => problem !== undefined,
  );
}

/**
 * Okrajové a typické příklady s nápovědou. Rozložení závisí jen na skupinkách
 * teček, proto stačí vzorek místo všech příkladů: nejmenší nápověda (1 + 0),
 * jedna velká skupinka (0 + n, n + 0, n − n), dvě skupinky (1 + 1), největší
 * součet nerovnoměrně i napůl, celá řada pěti teček a jedna tečka navíc
 * (5 + 0, 6 + 0, 5 + 5) a nejvíc řad teček.
 */
function sampleHintProblems(maxNumber: MaxNumber): Problem[] {
  const half = Math.floor(maxNumber / 2);
  const candidates = [
    plus(1, 0),
    plus(0, maxNumber),
    plus(maxNumber, 0),
    minus(maxNumber, maxNumber),
    plus(1, 1),
    plus(1, maxNumber - 1),
    plus(maxNumber - 1, 1),
    plus(half, maxNumber - half),
    plus(DOTS_PER_ROW, 0),
    plus(DOTS_PER_ROW + 1, 0),
    plus(DOTS_PER_ROW, DOTS_PER_ROW),
    ...mostRowsProblems(maxNumber),
  ];
  const inRange = candidates.filter((problem) => problem.first + problem.second <= maxNumber);
  const unique = new Map(inRange.map((problem) => [problemName(problem), problem]));
  return [...unique.values()];
}

function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

/** Rozložení telefonu; `hintGroups` jsou skupinky teček nápovědy, prázdné = bez nápovědy. */
function phoneVariant(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  starCount = STARS_PER_SET,
  hintGroups: readonly number[] = [],
): PhoneVariant {
  const area = gameAreaFor(viewportOf(window));
  const layout =
    mode === 'číselník'
      ? layoutPhoneScreen(area, maxNumber + 1, starCount, hintGroups)
      : layoutPhoneWritingScreen(area, maxNumber, starCount, hintGroups);
  return { window, maxNumber, mode, area, layout };
}

function isWriting(layout: PhoneLayout): layout is PhoneWritingLayout {
  return 'writingAreas' in layout;
}

function css(variant: PhoneVariant, b: Box): Box {
  return toCss(b, variant.area);
}

function slotCss(variant: PhoneVariant, slot: ButtonSlot): Box {
  return css(variant, box(slot.x, slot.y, slot.size, slot.size));
}

function areaCss(variant: PhoneVariant, area: WritingAreaSlot): Box {
  return css(variant, box(area.x, area.y, area.width, area.height));
}

/** Tlačítka s čísly, nebo smazání a ✓. */
function buttonsOf(variant: PhoneVariant): ButtonSlot[] {
  const { layout } = variant;
  return isWriting(layout)
    ? [layout.clearButton, layout.confirmButton]
    : [...(layout as PhoneScreenLayout).answerButtons];
}

/** Místo pro nejdelší příklad v rozsahu. */
function problemCss(variant: PhoneVariant): Box {
  const { problem, problemSize } = variant.layout;
  return css(variant, box(problem.x, problem.y, problemSize.width, problemSize.height));
}

function starsCss(variant: PhoneVariant): Box[] {
  const { stars, starSize } = variant.layout;
  return stars.map((star) => css(variant, box(star.x, star.y, starSize, starSize)));
}

/** Okénka na psaní (u číselníku žádná). */
function writingBoxesCss(variant: PhoneVariant): Box[] {
  const { layout } = variant;
  return isWriting(layout) ? layout.writingAreas.map((a) => areaCss(variant, a)) : [];
}

/** Ovládání: tlačítka číselníku, nebo okénka, smazání a ✓. */
function controlsCss(variant: PhoneVariant): Box[] {
  return [...writingBoxesCss(variant), ...buttonsOf(variant).map((slot) => slotCss(variant, slot))];
}

/** Všechno, co je na obrazovce kromě nápovědy. */
function fixedElements(variant: PhoneVariant): Element[] {
  const { layout } = variant;
  const elements: Element[] = [
    ...starsCss(variant).map((css, index) => ({ name: `hvězdička ${index + 1}`, css })),
    { name: 'příklad', css: problemCss(variant) },
  ];
  if (isWriting(layout)) {
    layout.writingAreas.forEach((area, index) =>
      elements.push({ name: `okénko ${index + 1}`, css: areaCss(variant, area) }),
    );
    elements.push({ name: 'smazání', css: slotCss(variant, layout.clearButton) });
    elements.push({ name: '✓', css: slotCss(variant, layout.confirmButton) });
  } else {
    (layout as PhoneScreenLayout).answerButtons.forEach((slot, index) =>
      elements.push({ name: `tlačítko ${index}`, css: slotCss(variant, slot) }),
    );
  }
  return elements;
}

function dotCss(variant: PhoneVariant, dot: HintDot): Box {
  const size = variant.layout.hintStyle.dotSize;
  return css(variant, box(dot.x, dot.y, size, size));
}

function dotHitCss(variant: PhoneVariant, dot: HintDot): Box {
  const size = variant.layout.hintDotHitSize;
  return css(variant, box(dot.x, dot.y, size, size));
}

/** Jde na tečky nápovědy v tomto rozložení ťukat a počítat je (#43)? */
function canTapDots(variant: PhoneVariant): boolean {
  return variant.layout.hintDotsCountable;
}

/** Obrazovka po 2. chybě u příkladu `problem`: rozložení s nápovědou a její tečky. */
interface HintScreen {
  readonly problem: Problem;
  readonly variant: PhoneVariant;
  readonly dots: HintDot[];
}

function hintScreen(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  problem: Problem,
): HintScreen {
  const groups = hintDotGroups(problem);
  const variant = phoneVariant(window, maxNumber, mode, STARS_PER_SET, groups);
  return { problem, variant, dots: layoutPhoneHint(variant.layout, groups) };
}

/** Obrazovky s nápovědou pro okrajové a typické příklady v rozsahu. */
function sampleHintScreens(window: TestWindow, maxNumber: MaxNumber, mode: Mode): HintScreen[] {
  return sampleHintProblems(maxNumber).map((problem) =>
    hintScreen(window, maxNumber, mode, problem),
  );
}

function label(variant: PhoneVariant, detail = ''): string {
  return `${variant.window.name}, rozsah ${variant.maxNumber}, ${variant.mode}${detail}`;
}

function hintLabel(screen: HintScreen, detail = ''): string {
  return label(screen.variant, `, nápověda ${problemName(screen.problem)}${detail}`);
}

function centerX(b: Box): number {
  return (b.left + b.right) / 2;
}

/** Hodnoty rozdělené do řad podle svislé souřadnice, řady shora dolů. */
function rowsByY<T extends { readonly y: number }>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y)) {
    const lastRow = rows[rows.length - 1];
    const lastY = lastRow?.[0]?.y;
    if (lastRow && lastY !== undefined && Math.abs(item.y - lastY) < TOLERANCE) {
      lastRow.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows;
}

/** U rozsahu 20 s číselníkem je příklad vlevo od číselníku (výjimka V2). */
function isWideKeypad(maxNumber: MaxNumber, mode: Mode): boolean {
  return maxNumber === 20 && mode === 'číselník';
}

/** Ovládání je pod hvězdičkami a pod příkladem (u rozsahu 20 s číselníkem vpravo od příkladu). */
function expectControlsBelowStarsAndProblem(variant: PhoneVariant, where: string): void {
  const controls = boundsOf(controlsCss(variant));
  const stars = boundsOf(starsCss(variant));
  const problem = problemCss(variant);

  expect(controls.top, `${where}: ovládání pod hvězdičkami`).toBeGreaterThanOrEqual(
    stars.bottom - TOLERANCE,
  );
  if (isWideKeypad(variant.maxNumber, variant.mode)) {
    expect(controls.left, `${where}: číselník vpravo od příkladu`).toBeGreaterThanOrEqual(
      problem.right - TOLERANCE,
    );
  } else {
    expect(controls.top, `${where}: ovládání pod příkladem`).toBeGreaterThanOrEqual(
      problem.bottom - TOLERANCE,
    );
  }
}

function expectNoOverlaps(elements: readonly Element[], where: string): void {
  elements.forEach((first, i) => {
    elements.slice(i + 1).forEach((second) => {
      expect(overlaps(first.css, second.css), `${where}, ${first.name} a ${second.name}`).toBe(
        false,
      );
    });
  });
}

/** Všechny kombinace okna, rozsahu a způsobu odpovídání. */
const ALL_VARIANTS: Array<[string, MaxNumber, Mode, TestWindow]> = PHONE_WINDOWS.flatMap((window) =>
  RANGES.flatMap((maxNumber) =>
    MODES.map((mode): [string, MaxNumber, Mode, TestWindow] => [
      window.name,
      maxNumber,
      mode,
      window,
    ]),
  ),
);

const WRITING_VARIANTS = ALL_VARIANTS.filter(([, , mode]) => mode === 'psaní');
const KEYPAD_VARIANTS = ALL_VARIANTS.filter(([, , mode]) => mode === 'číselník');

/** Číselník do 5 a do 10: na tečky jde ťukat. */
const TAPPABLE_DOT_VARIANTS = KEYPAD_VARIANTS.filter(([, maxNumber]) => maxNumber !== 20);

/** Do 20 a psaní do 10 a do 20: tečky jsou jen k dívání. */
const LOOK_ONLY_DOT_VARIANTS = ALL_VARIANTS.filter(
  ([, maxNumber, mode]) => maxNumber === 20 || (mode === 'psaní' && maxNumber === 10),
);

describe('vzorek příkladů s nápovědou pokrývá okrajové případy', () => {
  it.each(RANGES)(
    'rozsah %i: vzorek obsahuje nejmenší nápovědu, nejvíc teček, největší skupinku, nejvíc řad a obě pořadí skupinek',
    (maxNumber) => {
      const all = problemsWithDots(maxNumber);
      const sample = sampleHintProblems(maxNumber);
      const sampleMax = (measure: (problem: Problem) => number): number =>
        Math.max(...sample.map(measure));
      const allMax = (measure: (problem: Problem) => number): number =>
        Math.max(...all.map(measure));

      expect(Math.min(...sample.map(totalHintDots)), 'jediná tečka').toBe(1);
      expect(sampleMax(totalHintDots), 'nejvíc teček celkem').toBe(allMax(totalHintDots));
      expect(sampleMax(largestHintGroup), 'největší skupinka').toBe(allMax(largestHintGroup));
      expect(sampleMax(totalHintRows), 'nejvíc řad teček').toBe(allMax(totalHintRows));
      const sampleNames = sample.map(problemName);
      for (const name of ['1 + 0', `0 + ${maxNumber}`, `${maxNumber} + 0`, '1 + 1']) {
        expect(sampleNames, name).toContain(name);
      }
      expect(sampleNames, 'malá skupinka vlevo i vpravo').toEqual(
        expect.arrayContaining([`1 + ${maxNumber - 1}`, `${maxNumber - 1} + 1`]),
      );
      expect(sample.length, 'vzorek je výrazně menší než všechny příklady').toBeLessThan(
        all.length,
      );
    },
  );
});

describe('AC1: tlačítka na telefonu na šířku jsou dost velká na prst', () => {
  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): každé tlačítko má aspoň 64 × 64 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);

      for (const slot of buttonsOf(variant)) {
        const button = slotCss(variant, slot);
        expect(widthOf(button), label(variant)).toBeGreaterThanOrEqual(MIN_BUTTON_SIDE - TOLERANCE);
        expect(heightOf(button), label(variant)).toBeGreaterThanOrEqual(
          MIN_BUTTON_SIDE - TOLERANCE,
        );
      }
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): mezi sousedními tlačítky je aspoň 8 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const buttons = buttonsOf(variant).map((slot) => slotCss(variant, slot));

      buttons.forEach((first, i) => {
        buttons.slice(i + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            label(variant, `, tlačítka ${i} a ${i + offset + 1}`),
          ).toBeGreaterThanOrEqual(MIN_BUTTON_GAP - TOLERANCE);
        });
      });
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): s nápovědou se tlačítka zmenší nejvýš na 64 × 64 px a mezi nimi zůstane 8 px',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const { variant } = screen;
        const buttons = buttonsOf(variant).map((slot) => slotCss(variant, slot));

        buttons.forEach((first, i) => {
          expect(widthOf(first), hintLabel(screen)).toBeGreaterThanOrEqual(
            MIN_BUTTON_SIDE - TOLERANCE,
          );
          expect(heightOf(first), hintLabel(screen)).toBeGreaterThanOrEqual(
            MIN_BUTTON_SIDE - TOLERANCE,
          );
          buttons.slice(i + 1).forEach((second) => {
            expect(gapBetween(first, second), hintLabel(screen)).toBeGreaterThanOrEqual(
              MIN_BUTTON_GAP - TOLERANCE,
            );
          });
        });
      }
    },
  );

  it('na číselníku je každé číslo od 0 do rozsahu právě jednou', () => {
    for (const window of PHONE_WINDOWS) {
      for (const maxNumber of RANGES) {
        const layout = layoutPhoneScreen(gameAreaFor(viewportOf(window)), maxNumber + 1);
        expect(layout.answerButtons, `${window.name}, rozsah ${maxNumber}`).toHaveLength(
          maxNumber + 1,
        );
      }
    }
  });
});

describe('AC2: rozložení V2 na telefonu na šířku', () => {
  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): hvězdičky jsou nahoře vodorovně uprostřed',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode, STARS_PER_SET);
      const free = freeAreaOf(window);
      const stars = boundsOf(starsCss(variant));

      expect(Math.abs(centerX(stars) - centerX(free)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
      expect((stars.top + stars.bottom) / 2, label(variant)).toBeLessThan(
        (free.top + free.bottom) / 2,
      );
    },
  );

  it.each(ALL_VARIANTS.filter(([, maxNumber, mode]) => !isWideKeypad(maxNumber, mode)))(
    '%s, rozsah %i (%s): příklad je pod hvězdičkami vodorovně uprostřed (#63)',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const free = freeAreaOf(window);
      const stars = boundsOf(starsCss(variant));
      const problem = problemCss(variant);

      expect(problem.top, label(variant, ', příklad pod hvězdičkami')).toBeGreaterThanOrEqual(
        stars.bottom - TOLERANCE,
      );
      expect(Math.abs(centerX(problem) - centerX(free)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
    },
  );

  it.each(KEYPAD_VARIANTS.filter(([, maxNumber]) => maxNumber === 20))(
    '%s, rozsah %i (%s): příklad je pod hvězdičkami vlevo od číselníku',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const stars = boundsOf(starsCss(variant));
      const keypad = boundsOf(controlsCss(variant));
      const problem = problemCss(variant);

      expect(problem.top, label(variant, ', příklad pod hvězdičkami')).toBeGreaterThanOrEqual(
        stars.bottom - TOLERANCE,
      );
      expect(problem.right, label(variant, ', příklad vlevo od číselníku')).toBeLessThanOrEqual(
        keypad.left + TOLERANCE,
      );
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): ovládání je pod hvězdičkami i pod příkladem',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      expectControlsBelowStarsAndProblem(variant, label(variant));
    },
  );

  it.each(KEYPAD_VARIANTS.filter(([, maxNumber]) => maxNumber !== 20))(
    '%s, rozsah %i (%s): číselník je vodorovně uprostřed',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const free = freeAreaOf(window);
      const keypad = boundsOf(controlsCss(variant));

      expect(Math.abs(centerX(keypad) - centerX(free)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
    },
  );

  const KEYPAD_ROWS: Record<MaxNumber, number[][]> = {
    5: [[0, 1, 2, 3, 4, 5]],
    10: [
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ],
    20: [
      [0, 1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12, 13],
      [14, 15, 16, 17, 18, 19, 20],
    ],
  };

  it.each(KEYPAD_VARIANTS)(
    '%s, rozsah %i (%s): čísla na číselníku jdou po řadách zleva doprava od 0 (do 5 jedna řada, do 10 6 + 5, do 20 3 × 7)',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const buttons = (variant.layout as PhoneScreenLayout).answerButtons.map((slot, number) => ({
        number,
        x: slot.x,
        y: slot.y,
      }));
      const rows = rowsByY(buttons).map((row) =>
        [...row].sort((a, b) => a.x - b.x).map((button) => button.number),
      );

      expect(rows, label(variant)).toEqual(KEYPAD_ROWS[maxNumber]);
    },
  );

  for (const starCount of STAR_COUNTS) {
    it.each(ALL_VARIANTS)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: pravý horní roh 88 × 88 px pro kolečko zůstane prázdný`,
      (_, maxNumber, mode, window) => {
        const variant = phoneVariant(window, maxNumber, mode, starCount);
        const corner = gearCornerOf(window);

        for (const element of fixedElements(variant)) {
          expect(overlaps(element.css, corner), label(variant, `, ${element.name}`)).toBe(false);
        }
      },
    );

    it.each(ALL_VARIANTS)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: nic nevyčnívá z obrazovky ani není pod výřezem a lištou`,
      (_, maxNumber, mode, window) => {
        const variant = phoneVariant(window, maxNumber, mode, starCount);
        const free = freeAreaOf(window);

        for (const element of fixedElements(variant)) {
          expect(isInside(element.css, free), label(variant, `, ${element.name}`)).toBe(true);
        }
      },
    );

    it.each(ALL_VARIANTS)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: hvězdičky, příklad a ovládání se nepřekrývají`,
      (_, maxNumber, mode, window) => {
        const variant = phoneVariant(window, maxNumber, mode, starCount);
        expectNoOverlaps(fixedElements(variant), label(variant));
      },
    );
  }

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): nápověda po 2. chybě je vpravo od příkladu a ukáže všechny tečky',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const dots = screen.dots.map((dot) => dotCss(screen.variant, dot));
        const problem = problemCss(screen.variant);

        expect(dots.length, hintLabel(screen)).toBe(
          hintDotGroups(screen.problem).reduce((a, b) => a + b, 0),
        );
        expect(boundsOf(dots).left, hintLabel(screen)).toBeGreaterThanOrEqual(
          problem.right - TOLERANCE,
        );
      }
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): tečky nápovědy jsou po pěti v řadě, jen poslední řada skupinky smí mít méně',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const groups = new Set(screen.dots.map((dot) => dot.group));

        for (const group of groups) {
          const where = hintLabel(screen, `, skupinka ${group}`);
          const counts = rowsByY(screen.dots.filter((dot) => dot.group === group)).map(
            (row) => row.length,
          );
          counts.slice(0, -1).forEach((count) => {
            expect(count, where).toBe(DOTS_PER_ROW);
          });
          expect(counts[counts.length - 1], where).toBeLessThanOrEqual(DOTS_PER_ROW);
        }
      }
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): s nápovědou se nic nepřekrývá, nic nevyčnívá a roh s kolečkem zůstane prázdný',
    (_, maxNumber, mode, window) => {
      const free = freeAreaOf(window);
      const corner = gearCornerOf(window);

      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const { variant } = screen;
        const dots: Element[] = screen.dots.map((dot, index) => ({
          name: `tečka ${index}`,
          css: dotCss(variant, dot),
        }));
        const elements = [...fixedElements(variant), ...dots];

        expectNoOverlaps(elements, hintLabel(screen));
        for (const element of elements) {
          const where = hintLabel(screen, `, ${element.name}`);
          expect(isInside(element.css, free), where).toBe(true);
          expect(overlaps(element.css, corner), where).toBe(false);
        }
      }
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): s nápovědou zůstane ovládání pod hvězdičkami i pod příkladem',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        expectControlsBelowStarsAndProblem(screen.variant, hintLabel(screen));
      }
    },
  );

  it.each(TAPPABLE_DOT_VARIANTS)(
    '%s, rozsah %i (%s): na tečky nápovědy jde ťukat a počítat je',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      expect(canTapDots(variant), label(variant)).toBe(true);
    },
  );

  it.each(LOOK_ONLY_DOT_VARIANTS)(
    '%s, rozsah %i (%s): tečky nápovědy jsou jen k dívání, ťukání na ně nic nedělá',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      expect(canTapDots(variant), label(variant)).toBe(false);
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): ťukací tečka má vlastní plochu aspoň 48 × 48 px mimo ovládání, na obrazovce a mimo roh s kolečkem',
    (_, maxNumber, mode, window) => {
      const free = freeAreaOf(window);
      const corner = gearCornerOf(window);

      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const { variant } = screen;
        if (!canTapDots(variant)) {
          continue;
        }
        const controls = controlsCss(variant);
        const hits = screen.dots.map((dot) => dotHitCss(variant, dot));

        hits.forEach((hit, i) => {
          const where = hintLabel(screen, `, plocha tečky ${i}`);
          expect(widthOf(hit), where).toBeGreaterThanOrEqual(MIN_DOT_HIT_SIDE - TOLERANCE);
          expect(heightOf(hit), where).toBeGreaterThanOrEqual(MIN_DOT_HIT_SIDE - TOLERANCE);
          expect(isInside(hit, free), where).toBe(true);
          expect(overlaps(hit, corner), where).toBe(false);
          for (const control of controls) {
            expect(overlaps(hit, control), where).toBe(false);
          }
          hits.slice(i + 1).forEach((other) => {
            expect(overlaps(hit, other), where).toBe(false);
          });
        });
      }
    },
  );

  it.each(ALL_VARIANTS.filter(([, maxNumber]) => maxNumber !== 10))(
    '%s, rozsah %i (%s): tečka nápovědy jen k dívání má aspoň 20 px',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const { variant } = screen;
        if (canTapDots(variant)) {
          continue;
        }
        const dotSize = variant.layout.hintStyle.dotSize * variant.area.scale;
        expect(dotSize, hintLabel(screen)).toBeGreaterThanOrEqual(
          MIN_LOOK_ONLY_DOT_SIZE - TOLERANCE,
        );
      }
    },
  );

  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => maxNumber === 10))(
    '%s, rozsah %i (%s): tečka nápovědy jen k dívání má aspoň 20 px',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const { variant } = screen;
        const dotSize = variant.layout.hintStyle.dotSize * variant.area.scale;
        expect(dotSize, hintLabel(screen)).toBeGreaterThanOrEqual(
          MIN_LOOK_ONLY_DOT_SIZE - TOLERANCE,
        );
      }
    },
  );
});

describe('AC3: hvězdičky a příklad jsou na telefonu dobře vidět', () => {
  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): hvězdička má aspoň 24 px a všech deset je v jedné řadě',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode, STARS_PER_SET);
      const stars = starsCss(variant);

      expect(stars).toHaveLength(STARS_PER_SET);
      for (const star of stars) {
        expect(widthOf(star), label(variant)).toBeGreaterThanOrEqual(MIN_STAR_SIZE - TOLERANCE);
      }
      const rowY = new Set(variant.layout.stars.map((star) => star.y));
      expect(rowY.size, label(variant)).toBe(1);
      stars.forEach((star, index) => {
        const next = stars[index + 1];
        if (next) {
          expect(star.right, label(variant)).toBeLessThanOrEqual(next.left + TOLERANCE);
        }
      });
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): s nápovědou má písmo příkladu aspoň 32 px',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        const { layout, area } = screen.variant;

        expect(layout.problemFontSize * area.scale, hintLabel(screen)).toBeGreaterThanOrEqual(
          MIN_PROBLEM_FONT_SIZE - TOLERANCE,
        );
      }
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): písmo příkladu má aspoň 32 px a vejde se i nejdelší příklad',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const { layout } = variant;

      expect(layout.problemFontSize * variant.area.scale, label(variant)).toBeGreaterThanOrEqual(
        MIN_PROBLEM_FONT_SIZE - TOLERANCE,
      );
      // Místo pro příklad je stejné jako na iPadu: odhad šířky nejdelšího příkladu při tomto písmu.
      const ipad = layoutScreen(1024, 768, maxNumber + 1);
      const widthPerFontSize = ipad.problemSize.width / ipad.problemFontSize;
      expect(
        layout.problemSize.width / layout.problemFontSize,
        label(variant),
      ).toBeGreaterThanOrEqual(widthPerFontSize - TOLERANCE);
    },
  );
});

/** Okénka jsou dost velká: jedno aspoň 180 × 180 px, dvě aspoň 150 × 150 px. */
function expectWritingBoxSizes(variant: PhoneVariant, where: string): void {
  const boxes = writingBoxesCss(variant);
  const minSide = boxes.length === 1 ? MIN_SINGLE_BOX_SIDE : MIN_TWO_BOX_SIDE;
  for (const area of boxes) {
    expect(widthOf(area), where).toBeGreaterThanOrEqual(minSide - TOLERANCE);
    expect(heightOf(area), where).toBeGreaterThanOrEqual(minSide - TOLERANCE);
  }
}

/** Hvězdičky, příklad a okénka seřazené shora dolů podle horního okraje. */
function writingOrderTopToBottom(variant: PhoneVariant): string[] {
  const parts: Element[] = [
    { name: 'hvězdičky', css: boundsOf(starsCss(variant)) },
    { name: 'příklad', css: problemCss(variant) },
    { name: 'okénka', css: boundsOf(writingBoxesCss(variant)) },
  ];
  return [...parts].sort((a, b) => a.css.top - b.css.top).map((part) => part.name);
}

/** Hvězdičky jsou celé nad příkladem a příklad celý nad okénky. */
function expectStarsProblemBoxesStacked(variant: PhoneVariant, where: string): void {
  const stars = boundsOf(starsCss(variant));
  const problem = problemCss(variant);
  const boxes = boundsOf(writingBoxesCss(variant));
  expect(problem.top, `${where}: příklad pod hvězdičkami`).toBeGreaterThanOrEqual(
    stars.bottom - TOLERANCE,
  );
  expect(boxes.top, `${where}: okénka pod příkladem`).toBeGreaterThanOrEqual(
    problem.bottom - TOLERANCE,
  );
}

describe('AC4: psaní prstem na telefonu na šířku', () => {
  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => maxNumber === 5))(
    '%s, rozsah %i (%s): jediné okénko má aspoň 180 × 180 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;

      expect(layout.writingAreas).toHaveLength(1);
      expectWritingBoxSizes(variant, label(variant));
    },
  );

  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => TWO_BOX_RANGES.includes(maxNumber)))(
    '%s, rozsah %i (%s): každé ze dvou okének má aspoň 150 × 150 px a nepřekrývají se',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;

      expect(layout.writingAreas).toHaveLength(2);
      expectWritingBoxSizes(variant, label(variant));
      const [tens, ones] = writingBoxesCss(variant) as [Box, Box];
      expect(overlaps(tens, ones), label(variant)).toBe(false);
      expect(tens.right, label(variant, ': desítky jsou vlevo')).toBeLessThanOrEqual(
        ones.left + TOLERANCE,
      );
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): s nápovědou zůstanou okénka stejně velká jako bez ní',
    (_, maxNumber, mode, window) => {
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        expectWritingBoxSizes(screen.variant, hintLabel(screen));
      }
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): po ukázání nápovědy rozložení nepřeskočí, hvězdičky, příklad a okénka zůstanou shora dolů ve stejném pořadí',
    (_, maxNumber, mode, window) => {
      const withoutHint = phoneVariant(window, maxNumber, mode);
      const expectedOrder = writingOrderTopToBottom(withoutHint);

      expect(expectedOrder, label(withoutHint)).toEqual(['hvězdičky', 'příklad', 'okénka']);
      expectStarsProblemBoxesStacked(withoutHint, label(withoutHint));
      for (const screen of sampleHintScreens(window, maxNumber, mode)) {
        expect(writingOrderTopToBottom(screen.variant), hintLabel(screen)).toEqual(expectedOrder);
        expectStarsProblemBoxesStacked(screen.variant, hintLabel(screen));
      }
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): okénka jsou vodorovně uprostřed pod příkladem',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const free = freeAreaOf(window);
      const boxes = boundsOf(writingBoxesCss(variant));

      expect(Math.abs(centerX(boxes) - centerX(free)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
      expect(boxes.top, label(variant)).toBeGreaterThanOrEqual(
        problemCss(variant).bottom - TOLERANCE,
      );
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): smazání je vlevo od okének a ✓ vpravo, obojí ve výšce středu okének',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;
      const boxes = boundsOf(writingBoxesCss(variant));
      const boxesMiddleY = (boxes.top + boxes.bottom) / 2;
      const clear = slotCss(variant, layout.clearButton);
      const confirm = slotCss(variant, layout.confirmButton);

      expect(clear.right, label(variant, ', smazání vlevo')).toBeLessThanOrEqual(
        boxes.left + TOLERANCE,
      );
      expect(confirm.left, label(variant, ', ✓ vpravo')).toBeGreaterThanOrEqual(
        boxes.right - TOLERANCE,
      );
      expect(
        Math.abs((clear.top + clear.bottom) / 2 - boxesMiddleY),
        label(variant, ', smazání ve výšce středu okének'),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      expect(
        Math.abs((confirm.top + confirm.bottom) / 2 - boxesMiddleY),
        label(variant, ', ✓ ve výšce středu okének'),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): dotyk mimo okénka se nezapočítá jako tah, dotyk v okénku ano',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;
      const step = 1;

      layout.writingAreas.forEach((area, index) => {
        const expected = layout.writingAreas.length === 2 && index === 0 ? 'tens' : 'ones';
        const halfWidth = area.width / 2;
        const halfHeight = area.height / 2;

        expect(writingAreaAt(layout, area), label(variant)).toBe(expected);
        expect(
          writingAreaAt(layout, { x: area.x - halfWidth + step, y: area.y - halfHeight + step }),
        ).toBe(expected);
        for (const outside of [
          { x: area.x, y: area.y - halfHeight - step },
          { x: area.x, y: area.y + halfHeight + step },
          { x: area.x - halfWidth - step, y: area.y },
          { x: area.x + halfWidth + step, y: area.y },
        ]) {
          const owner = writingAreaAt(layout, outside);
          // Dotyk těsně vedle okénka smí patřit jen sousednímu okénku, ne tomuto.
          expect(owner === expected, label(variant, ` mimo okénko ${index + 1}`)).toBe(false);
        }
      });

      for (const button of [layout.clearButton, layout.confirmButton]) {
        expect(writingAreaAt(layout, button), label(variant, ', dotyk na tlačítko')).toBeNull();
      }
      expect(
        writingAreaAt(layout, layout.problem),
        label(variant, ', dotyk na příklad'),
      ).toBeNull();
    },
  );

  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => TWO_BOX_RANGES.includes(maxNumber)))(
    '%s, rozsah %i (%s): dotyk v mezeře mezi okénky se nezapočítá jako tah',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;
      const [tens, ones] = layout.writingAreas as [WritingAreaSlot, WritingAreaSlot];
      const gapMiddle = (tens.x + tens.width / 2 + (ones.x - ones.width / 2)) / 2;

      expect(writingAreaAt(layout, { x: gapMiddle, y: tens.y }), label(variant)).toBeNull();
    },
  );
});
describe('AC6: okno těsně pod a nad hranicí 500 px', () => {
  const below = PHONE_WINDOWS.filter((window) => window.height === 499);

  it.each(below)('$name: dostane telefonní rozložení a tlačítka mají aspoň 64 px', (window) => {
    for (const maxNumber of RANGES) {
      for (const mode of MODES) {
        const variant = phoneVariant(window, maxNumber, mode);
        expect(variant.area.mode).toBe('phoneLandscape');
        for (const slot of buttonsOf(variant)) {
          expect(widthOf(slotCss(variant, slot)), label(variant)).toBeGreaterThanOrEqual(
            MIN_BUTTON_SIDE - TOLERANCE,
          );
        }
      }
    }
  });

  it('932×500: dnešní rozložení iPadu má tlačítka aspoň 64 × 64 px a mezery aspoň 8 px', () => {
    const area = gameAreaFor(viewportOf(JUST_ABOVE_LIMIT));
    expect(area.mode).toBe('tablet');

    for (const maxNumber of RANGES) {
      const keypad = layoutScreen(area.width, area.height, maxNumber + 1, STARS_PER_SET);
      const writing = layoutWritingScreen(area.width, area.height, maxNumber, STARS_PER_SET);
      const groups: Array<[string, ButtonSlot[]]> = [
        ['číselník', [...keypad.answerButtons]],
        ['psaní', [writing.clearButton, writing.confirmButton]],
      ];

      for (const [mode, slots] of groups) {
        const where = `rozsah ${maxNumber}, ${mode}`;
        const buttons = slots.map((slot) => toCss(box(slot.x, slot.y, slot.size, slot.size), area));
        for (const button of buttons) {
          expect(widthOf(button), where).toBeGreaterThanOrEqual(MIN_BUTTON_SIDE - TOLERANCE);
        }
        buttons.forEach((first, i) => {
          buttons.slice(i + 1).forEach((second) => {
            expect(gapBetween(first, second), where).toBeGreaterThanOrEqual(
              MIN_BUTTON_GAP - TOLERANCE,
            );
          });
        });
      }
    }
  });
});
