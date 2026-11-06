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
  slotWidth,
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
  gearCornerOf,
  heightOf,
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
 * #68 (návrh C, rozhodnutí vlastníka po obrázcích) vědomě mění AC2 a AC3:
 * nahoře je pás s příkladem, tečkami nápovědy hned vedle (nebo pod ním,
 * když se vedle nevejdou) a hvězdičkami ve 2 řadách po 5 u kolečka, mezi
 * rohem domečku a rohem kolečka. Dole je číselník přes celou šířku se
 * širokými tlačítky (do 20 už ne vpravo od příkladu), nebo okénka na psaní.
 * Tečky jdou souvisle po pěti v řadě, druhé číslo pokračuje v řadě prvního.
 * Ostatní pravidla #54 (64 px, 8 px, 48 px ťukací tečky, hvězdička 24 px,
 * písmo 32 px, nic v rohu ani mimo volnou plochu) platí dál.
 *
 * Rozložení s nápovědou: `layoutPhoneScreen` a `layoutPhoneWritingScreen`
 * dostanou skupinky teček nápovědy (prázdné = bez nápovědy) a smí pro ně
 * udělat místo, třeba zmenšit tlačítka na 64 px nebo posunout příklad.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const TWO_BOX_RANGES: MaxNumber[] = [10, 20];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

/** AC3 v CSS px. */
const MIN_STAR_SIZE = 24;
const MIN_PROBLEM_FONT_SIZE = 32;

/** AC4 v CSS px (nové znění po rozhodnutí vlastníka v #54: jedno okénko 180 px). */
const MIN_SINGLE_BOX_SIDE = 180;
const MIN_TWO_BOX_SIDE = 150;

/** Nejmenší tečka nápovědy jen k dívání (AC2), v CSS px. */
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

/** Tlačítko; číselník na šířku má od #68 široká tlačítka (`width`). */
function slotCss(variant: PhoneVariant, slot: ButtonSlot): Box {
  return css(variant, box(slot.x, slot.y, slotWidth(slot), slot.size));
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

function dotCss(variant: PhoneVariant, dot: HintDot): Box {
  const size = variant.layout.hintStyle.dotSize;
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

/** Ovládání je pod hvězdičkami a pod příkladem, ve všech rozsazích (#68, C). */
function expectControlsBelowStarsAndProblem(variant: PhoneVariant, where: string): void {
  const controls = boundsOf(controlsCss(variant));
  const stars = boundsOf(starsCss(variant));
  const problem = problemCss(variant);

  expect(controls.top, `${where}: ovládání pod hvězdičkami`).toBeGreaterThanOrEqual(
    stars.bottom - TOLERANCE,
  );
  expect(controls.top, `${where}: ovládání pod příkladem`).toBeGreaterThanOrEqual(
    problem.bottom - TOLERANCE,
  );
}

/** Roh domečku vlevo nahoře na šířku (#68): 88 × 88 px u levého horního okraje volné plochy. */
const HOME_CORNER_SIZE = 88;

function homeCornerRight(window: TestWindow): number {
  return freeAreaOf(window).left + HOME_CORNER_SIZE;
}

/** Všechny kombinace okna, rozsahu a způsobu odpovídání. */
interface Case {
  readonly window: TestWindow;
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
}

const ALL_VARIANTS: Case[] = PHONE_WINDOWS.flatMap((window) =>
  RANGES.flatMap((maxNumber) => MODES.map((mode): Case => ({ window, maxNumber, mode }))),
);

const WRITING_VARIANTS = ALL_VARIANTS.filter(({ mode }) => mode === 'psaní');
const KEYPAD_VARIANTS = ALL_VARIANTS.filter(({ mode }) => mode === 'číselník');

/**
 * Číselník do 5 a do 10: na tečky jde ťukat. Do 20 a psaní do 10: tečky
 * jsou jen k dívání. Psaní do 5 tu zadání neurčuje (`null`).
 */
function hasTappableDots({ maxNumber, mode }: Case): boolean | null {
  if (mode === 'číselník') {
    return maxNumber !== 20;
  }
  return maxNumber === 5 ? null : false;
}

function variantOf({ window, maxNumber, mode }: Case, starCount = STARS_PER_SET): PhoneVariant {
  return phoneVariant(window, maxNumber, mode, starCount);
}

function hintScreensOf({ window, maxNumber, mode }: Case): HintScreen[] {
  return sampleHintScreens(window, maxNumber, mode);
}

// Že tlačítka mají 64 px s mezerou 8 px (AC1, i s nápovědou), ťukací tečky
// 48 px (AC2), roh 88 × 88 px s kolečkem zůstane prázdný a nic se
// nepřekrývá, nevyčnívá ani není pod výřezem a lištou (AC2), hlídají
// společná pravidla v `countingLayoutRules.test.ts`.

describe('vzorek příkladů s nápovědou pokrývá okrajové případy', () => {
  it('v každém rozsahu obsahuje vzorek nejmenší nápovědu, nejvíc teček, největší skupinku, nejvíc řad a obě pořadí skupinek', () => {
    for (const maxNumber of RANGES) {
      const all = problemsWithDots(maxNumber);
      const sample = sampleHintProblems(maxNumber);
      const sampleMax = (measure: (problem: Problem) => number): number =>
        Math.max(...sample.map(measure));
      const allMax = (measure: (problem: Problem) => number): number =>
        Math.max(...all.map(measure));
      const where = `rozsah ${maxNumber}`;

      expect(Math.min(...sample.map(totalHintDots)), `${where}: jediná tečka`).toBe(1);
      expect(sampleMax(totalHintDots), `${where}: nejvíc teček celkem`).toBe(allMax(totalHintDots));
      expect(sampleMax(largestHintGroup), `${where}: největší skupinka`).toBe(
        allMax(largestHintGroup),
      );
      expect(sampleMax(totalHintRows), `${where}: nejvíc řad teček`).toBe(allMax(totalHintRows));
      const sampleNames = sample.map(problemName);
      for (const name of ['1 + 0', `0 + ${maxNumber}`, `${maxNumber} + 0`, '1 + 1']) {
        expect(sampleNames, `${where}: ${name}`).toContain(name);
      }
      expect(sampleNames, `${where}: malá skupinka vlevo i vpravo`).toEqual(
        expect.arrayContaining([`1 + ${maxNumber - 1}`, `${maxNumber - 1} + 1`]),
      );
      expect(sample.length, `${where}: vzorek je výrazně menší než všechny příklady`).toBeLessThan(
        all.length,
      );
    }
  });
});

describe('AC1: číselník na telefonu na šířku', () => {
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
  it('hvězdičky jsou v horním pásu vlevo vedle kolečka (#68)', () => {
    for (const testCase of ALL_VARIANTS) {
      const variant = variantOf(testCase);
      const free = freeAreaOf(testCase.window);
      const gear = gearCornerOf(testCase.window);
      const stars = boundsOf(starsCss(variant));

      expect(stars.right, label(variant)).toBeLessThanOrEqual(gear.left + TOLERANCE);
      expect(gear.left - stars.right, label(variant)).toBeLessThanOrEqual(8);
      expect(stars.top, label(variant)).toBeGreaterThanOrEqual(free.top + 4 - TOLERANCE);
      expect(stars.bottom, label(variant)).toBeLessThanOrEqual(gear.bottom + TOLERANCE);
    }
  });

  it('příklad je v horním pásu uprostřed mezi rohem domečku a hvězdičkami (#68)', () => {
    for (const testCase of ALL_VARIANTS) {
      const { window } = testCase;
      const variant = variantOf(testCase);
      const gear = gearCornerOf(window);
      const stars = boundsOf(starsCss(variantOf(testCase, STARS_PER_SET)));
      const problem = problemCss(variant);
      const placeCenter = (homeCornerRight(window) + stars.left) / 2;

      expect(problem.left, label(variant, ', vpravo od rohu domečku')).toBeGreaterThanOrEqual(
        homeCornerRight(window) - TOLERANCE,
      );
      expect(problem.right, label(variant, ', vlevo od hvězdiček')).toBeLessThanOrEqual(
        stars.left + TOLERANCE,
      );
      expect(problem.top, label(variant, ', v horním pásu')).toBeLessThan(gear.bottom);
      expect(Math.abs(centerX(problem) - placeCenter), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
    }
  });

  it('ovládání je pod hvězdičkami i pod příkladem, bez nápovědy i s ní (ovládání dole u palce)', () => {
    for (const testCase of ALL_VARIANTS) {
      const variant = variantOf(testCase);
      expectControlsBelowStarsAndProblem(variant, label(variant));
      for (const screen of hintScreensOf(testCase)) {
        expectControlsBelowStarsAndProblem(screen.variant, hintLabel(screen));
      }
    }
  });

  it('číselník je vodorovně uprostřed (od #68 i do 20)', () => {
    for (const testCase of KEYPAD_VARIANTS) {
      const variant = variantOf(testCase);
      const free = freeAreaOf(testCase.window);
      const keypad = boundsOf(controlsCss(variant));

      expect(Math.abs(centerX(keypad) - centerX(free)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
    }
  });

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

  it('čísla na číselníku jdou po řadách zleva doprava od 0 (do 5 jedna řada, do 10 6 + 5, do 20 3 × 7)', () => {
    for (const testCase of KEYPAD_VARIANTS) {
      const variant = variantOf(testCase);
      const buttons = (variant.layout as PhoneScreenLayout).answerButtons.map((slot, number) => ({
        number,
        x: slot.x,
        y: slot.y,
      }));
      const rows = rowsByY(buttons).map((row) =>
        [...row].sort((a, b) => a.x - b.x).map((button) => button.number),
      );

      expect(rows, label(variant)).toEqual(KEYPAD_ROWS[testCase.maxNumber]);
    }
  });

  it('nápověda po 2. chybě je vpravo vedle příkladu, nebo pod ním (#68), a ukáže všechny tečky', () => {
    for (const testCase of ALL_VARIANTS) {
      for (const screen of hintScreensOf(testCase)) {
        const dots = boundsOf(screen.dots.map((dot) => dotCss(screen.variant, dot)));
        const problem = problemCss(screen.variant);

        expect(screen.dots.length, hintLabel(screen)).toBe(
          hintDotGroups(screen.problem).reduce((a, b) => a + b, 0),
        );
        const beside = dots.left >= problem.right - TOLERANCE;
        const below = dots.top >= problem.bottom - TOLERANCE;
        expect(beside || below, hintLabel(screen)).toBe(true);
      }
    }
  });

  it('tečky nápovědy jdou souvisle po pěti v řadě, druhé číslo pokračuje v řadě prvního (#68)', () => {
    for (const testCase of ALL_VARIANTS) {
      for (const screen of hintScreensOf(testCase)) {
        const where = hintLabel(screen);
        const rows = rowsByY(screen.dots);
        const counts = rows.map((row) => row.length);
        const perRow = counts[0] ?? 0;

        const fullRow = Math.min(totalHintDots(screen.problem), DOTS_PER_ROW);
        // Dvě pětice vedle sebe jen v nouzi (do 20 s víc než 15 tečkami na nejnižších telefonech).
        expect([fullRow, 2 * DOTS_PER_ROW], where).toContain(perRow);
        if (perRow === 2 * DOTS_PER_ROW) {
          expect(testCase.maxNumber, where).toBe(20);
          expect(totalHintDots(screen.problem), where).toBeGreaterThan(3 * DOTS_PER_ROW);
        }
        counts.slice(0, -1).forEach((count) => {
          expect(count, where).toBe(perRow);
        });
        expect(counts[counts.length - 1], where).toBeLessThanOrEqual(perRow);
        // Pořadí čtení (řady shora, v řadě zleva) je pořadí teček: nejdřív první číslo, pak druhé.
        const reading = rows.flatMap((row) => [...row].sort((a, b) => a.x - b.x));
        expect(reading, where).toEqual(screen.dots);
      }
    }
  });

  it('na tečky nápovědy jde ťukat u číselníku do 5 a do 10, do 20 a u psaní do 10 jsou jen k dívání, tečka k dívání má aspoň 20 px', () => {
    for (const testCase of ALL_VARIANTS) {
      const variant = variantOf(testCase);
      const tappable = hasTappableDots(testCase);

      if (tappable !== null) {
        expect(canTapDots(variant), label(variant)).toBe(tappable);
      }
      for (const screen of hintScreensOf(testCase)) {
        if (canTapDots(screen.variant)) {
          continue;
        }
        const dotSize = screen.variant.layout.hintStyle.dotSize * screen.variant.area.scale;
        expect(dotSize, hintLabel(screen)).toBeGreaterThanOrEqual(
          MIN_LOOK_ONLY_DOT_SIZE - TOLERANCE,
        );
      }
    }
  });
});

describe('AC3: hvězdičky a příklad jsou na telefonu dobře vidět', () => {
  it('hvězdička má aspoň 24 px a deset jich je ve 2 řadách po 5 (#68, C)', () => {
    for (const testCase of ALL_VARIANTS) {
      const variant = variantOf(testCase, STARS_PER_SET);
      const stars = starsCss(variant);

      expect(stars, label(variant)).toHaveLength(STARS_PER_SET);
      for (const star of stars) {
        expect(widthOf(star), label(variant)).toBeGreaterThanOrEqual(MIN_STAR_SIZE - TOLERANCE);
      }
      const rows = [stars.slice(0, 5), stars.slice(5)];
      expect(new Set(variant.layout.stars.map((star) => star.y)).size, label(variant)).toBe(2);
      for (const row of rows) {
        expect(new Set(row.map((star) => star.top)).size, label(variant)).toBe(1);
        row.forEach((star, index) => {
          const next = row[index + 1];
          if (next) {
            expect(star.right, label(variant)).toBeLessThanOrEqual(next.left + TOLERANCE);
          }
        });
      }
      const [top, bottom] = rows.map((row) => boundsOf(row));
      expect(top && bottom && top.bottom <= bottom.top + TOLERANCE, label(variant)).toBe(true);
    }
  });

  it('písmo příkladu má bez nápovědy i s ní aspoň 32 px a vejde se i nejdelší příklad', () => {
    for (const testCase of ALL_VARIANTS) {
      const variant = variantOf(testCase);
      const { layout } = variant;

      expect(layout.problemFontSize * variant.area.scale, label(variant)).toBeGreaterThanOrEqual(
        MIN_PROBLEM_FONT_SIZE - TOLERANCE,
      );
      // Místo pro příklad je stejné jako na iPadu: odhad šířky nejdelšího příkladu při tomto písmu.
      const ipad = layoutScreen(1024, 768, testCase.maxNumber + 1);
      const widthPerFontSize = ipad.problemSize.width / ipad.problemFontSize;
      expect(
        layout.problemSize.width / layout.problemFontSize,
        label(variant),
      ).toBeGreaterThanOrEqual(widthPerFontSize - TOLERANCE);
      for (const screen of hintScreensOf(testCase)) {
        const { layout: withHint, area } = screen.variant;
        expect(withHint.problemFontSize * area.scale, hintLabel(screen)).toBeGreaterThanOrEqual(
          MIN_PROBLEM_FONT_SIZE - TOLERANCE,
        );
      }
    }
  });
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

/** Horní pás (hvězdičky a příklad vedle sebe, #68) a okénka seřazené shora dolů. */
function writingOrderTopToBottom(variant: PhoneVariant): string[] {
  const parts: Element[] = [
    { name: 'pás', css: boundsOf([...starsCss(variant), problemCss(variant)]) },
    { name: 'okénka', css: boundsOf(writingBoxesCss(variant)) },
  ];
  return [...parts].sort((a, b) => a.css.top - b.css.top).map((part) => part.name);
}

/** Hvězdičky a příklad jsou v pásu celé nad okénky. */
function expectStarsProblemBoxesStacked(variant: PhoneVariant, where: string): void {
  const stars = boundsOf(starsCss(variant));
  const problem = problemCss(variant);
  const boxes = boundsOf(writingBoxesCss(variant));
  expect(boxes.top, `${where}: okénka pod hvězdičkami`).toBeGreaterThanOrEqual(
    stars.bottom - TOLERANCE,
  );
  expect(boxes.top, `${where}: okénka pod příkladem`).toBeGreaterThanOrEqual(
    problem.bottom - TOLERANCE,
  );
}

describe('AC4: psaní prstem na telefonu na šířku', () => {
  /**
   * Výjimka z #54 (rozhodnutí vlastníka): jediné okénko do 5 smí mít na
   * nejnižších telefonech 180 px místo 200 px. Dvě okénka mají aspoň 150 px.
   */
  it('do 5 je jediné okénko aspoň 180 × 180 px, do 10 a 20 dvě aspoň 150 × 150 px, desítky vlevo, a s nápovědou zůstanou stejně velká', () => {
    for (const testCase of WRITING_VARIANTS) {
      const variant = variantOf(testCase);
      const layout = variant.layout as PhoneWritingLayout;
      const twoBoxes = TWO_BOX_RANGES.includes(testCase.maxNumber);

      expect(layout.writingAreas, label(variant)).toHaveLength(twoBoxes ? 2 : 1);
      expectWritingBoxSizes(variant, label(variant));
      if (twoBoxes) {
        const [tens, ones] = writingBoxesCss(variant) as [Box, Box];
        expect(overlaps(tens, ones), label(variant)).toBe(false);
        expect(tens.right, label(variant, ': desítky jsou vlevo')).toBeLessThanOrEqual(
          ones.left + TOLERANCE,
        );
      }
      for (const screen of hintScreensOf(testCase)) {
        expectWritingBoxSizes(screen.variant, hintLabel(screen));
      }
    }
  });

  it('po ukázání nápovědy rozložení nepřeskočí, pás s hvězdičkami a příkladem zůstane nad okénky', () => {
    for (const testCase of WRITING_VARIANTS) {
      const withoutHint = variantOf(testCase);
      const expectedOrder = writingOrderTopToBottom(withoutHint);

      expect(expectedOrder, label(withoutHint)).toEqual(['pás', 'okénka']);
      expectStarsProblemBoxesStacked(withoutHint, label(withoutHint));
      for (const screen of hintScreensOf(testCase)) {
        expect(writingOrderTopToBottom(screen.variant), hintLabel(screen)).toEqual(expectedOrder);
        expectStarsProblemBoxesStacked(screen.variant, hintLabel(screen));
      }
    }
  });

  it('okénka jsou vodorovně uprostřed pod příkladem', () => {
    for (const testCase of WRITING_VARIANTS) {
      const variant = variantOf(testCase);
      const free = freeAreaOf(testCase.window);
      const boxes = boundsOf(writingBoxesCss(variant));

      expect(Math.abs(centerX(boxes) - centerX(free)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
      expect(boxes.top, label(variant)).toBeGreaterThanOrEqual(
        problemCss(variant).bottom - TOLERANCE,
      );
    }
  });

  it('smazání je vlevo od okének a ✓ vpravo, obojí ve výšce středu okének', () => {
    for (const testCase of WRITING_VARIANTS) {
      const variant = variantOf(testCase);
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
    }
  });

  it('dotyk v okénku se započítá jako tah, dotyk mimo okénka a v mezeře mezi nimi ne', () => {
    for (const testCase of WRITING_VARIANTS) {
      const variant = variantOf(testCase);
      const layout = variant.layout as PhoneWritingLayout;
      const step = 1;

      layout.writingAreas.forEach((area, index) => {
        const expected = layout.writingAreas.length === 2 && index === 0 ? 'tens' : 'ones';
        const halfWidth = area.width / 2;
        const halfHeight = area.height / 2;

        expect(writingAreaAt(layout, area), label(variant)).toBe(expected);
        expect(
          writingAreaAt(layout, { x: area.x - halfWidth + step, y: area.y - halfHeight + step }),
          label(variant, `, roh okénka ${index + 1}`),
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
      if (TWO_BOX_RANGES.includes(testCase.maxNumber)) {
        const [tens, ones] = layout.writingAreas as [WritingAreaSlot, WritingAreaSlot];
        const gapMiddle = (tens.x + tens.width / 2 + (ones.x - ones.width / 2)) / 2;
        expect(
          writingAreaAt(layout, { x: gapMiddle, y: tens.y }),
          label(variant, ', mezera mezi okénky'),
        ).toBeNull();
      }
    }
  });
});

describe('AC6: okno těsně pod a nad hranicí 500 px', () => {
  it('932×499 dostane telefonní rozložení a 932×500 dnešní rozložení iPadu (tlačítka a mezery hlídají společná pravidla)', () => {
    for (const window of PHONE_WINDOWS.filter((candidate) => candidate.height === 499)) {
      for (const maxNumber of RANGES) {
        for (const mode of MODES) {
          const variant = phoneVariant(window, maxNumber, mode);
          expect(variant.area.mode, label(variant)).toBe('phoneLandscape');
        }
      }
    }
    expect(gameAreaFor(viewportOf(JUST_ABOVE_LIMIT)).mode, JUST_ABOVE_LIMIT.name).toBe('tablet');
  });
});
