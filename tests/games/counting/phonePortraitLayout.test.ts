import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
  layoutPhonePortraitHint,
  layoutPhonePortraitScreen,
  layoutPhonePortraitWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type {
  PhonePortraitScreenLayout,
  PhonePortraitWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { layoutScreen, writingAreaAt } from '../../../src/games/counting/logic/screenLayout';
import type {
  ButtonSlot,
  HintDot,
  WritingAreaSlot,
} from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber, OperationMode } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  SMALLEST_PHONE_PORTRAIT,
  box,
  boundsOf,
  freeAreaOf,
  heightOf,
  isInside,
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #56 (hra na telefonu na výšku, rozložení P2), AC2 až AC6.
 * Kdy se rozložení na výšku použije (AC1), hlídá `deviceLayout.test.ts`,
 * rozpoznávání ve vysokém okénku (AC6) `phonePortraitRecognition.slow.test.ts`
 * a otočení telefonu (AC7) `phonePortraitResize.test.ts`.
 *
 * Všechny velikosti se přepočítají z herních jednotek na CSS px (px na
 * skutečném displeji) a ověří na zkušebních oknech z issue (390×844 s
 * výřezem, 390×664, 360×780, 375×667, 430×932 s výřezem, 360×620),
 * na okně 499×932 a úzkém iPadu 375×1180, pro rozsahy 5, 10 a 20,
 * s číselníkem i s psaním, s prázdnou i plnou řadou hvězdiček (oslava).
 *
 * Navržené rozhraní: `layoutPhonePortraitScreen(area, settings, starCount)`
 * a `layoutPhonePortraitWritingScreen(area, settings, starCount)` dostanou
 * rozsah a druh příkladů, ne nápovědu: místo pro nápovědu (`hintRegion`,
 * v herních jednotkách) je vyhrazené vždy, pro nejvyšší nápovědu z nastavení
 * (AC5). Tečky pro konkrétní příklad vrátí `layoutPhonePortraitHint`.
 * Nápověda se ověřuje na vzorku okrajových a typických příkladů jako v #54
 * (viz `sampleHintProblems`), vyhrazené místo na všech příkladech.
 *
 * #68 AC4 vědomě mění AC2: vlevo nahoře přibyl domeček zrcadlově ke
 * kolečku a hvězdičky jsou místo jedné řady ve 2 řadách po 5 mezi nimi
 * (schválený obrázek A). Domeček je mezi pevnými prvky, se kterými se nic
 * nesmí překrývat. Ostatní kritéria #56 zůstávají beze změny.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const OPERATIONS: OperationMode[] = ['plus', 'minus', 'mixed'];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

/** Kolečko nastavení (#55): plocha pro prst a odsazení od rohu volné plochy, v CSS px. */
const GEAR_HIT_SIZE = 64;
const GEAR_EDGE_OFFSET = 8;

/** AC2 v CSS px; od #68 platí odstup 4 px i od domečku. */
const MIN_STARS_TO_GEAR_GAP = 4;

/** #68 AC4, schválený obrázek A: 2 řady po 5 hvězdičkách 24 px s rozestupem 32 px. */
const STARS_PER_ROW = 5;
const STAR_SIZE_68 = 24;
const STAR_SPACING_68 = 32;
const MIN_EDGE_DISTANCE = 4;
const MIN_CONTROLS_BOTTOM_GAP = 8;
const MAX_CONTROLS_BOTTOM_GAP = 24;

/** AC3 v CSS px. */
const MIN_STAR_SIZE = 24;
const MIN_PROBLEM_FONT_SIZE = 40;

/** AC5 v CSS px. */
const MIN_LOOK_ONLY_DOT_SIZE = 20;
const DOTS_PER_ROW = 5;

/** AC6 v CSS px. */
const MIN_SINGLE_BOX_SIDE = 200;
const MIN_TWO_BOX_SIDE = 160;
const MIN_BOX_GAP = 12;
const MAX_BOX_HEIGHT_RATIO = 1.6;
const MIN_BOXES_TO_BUTTONS_GAP = 12;

/** Tolerance na zaokrouhlení a pro „uprostřed“ v CSS px. */
const TOLERANCE = 0.01;
const CENTER_TOLERANCE = 1;

/** Všechna okna, která dostanou telefonní rozložení na výšku. */
const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

type PortraitLayout = PhonePortraitScreenLayout | PhonePortraitWritingLayout;

interface PortraitVariant {
  readonly window: TestWindow;
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
  readonly operations: OperationMode;
  readonly area: GameArea;
  readonly layout: PortraitLayout;
}

// ---------------------------------------------------------------------------
// Příklady a vzorek nápověd
// ---------------------------------------------------------------------------

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

function includesPlus(operations: OperationMode): boolean {
  return operations !== 'minus';
}

function includesMinus(operations: OperationMode): boolean {
  return operations !== 'plus';
}

/** Všechny příklady, které v rozsahu a s druhem příkladů mohou přijít. */
function allProblems(maxNumber: number, operations: OperationMode): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    if (includesPlus(operations)) {
      for (let second = 0; first + second <= maxNumber; second += 1) {
        problems.push(plus(first, second));
      }
    }
    if (includesMinus(operations)) {
      for (let second = 0; second <= first; second += 1) {
        problems.push(minus(first, second));
      }
    }
  }
  return problems;
}

function groupsKey(groups: readonly number[]): string {
  return groups.join('+');
}

/** Různé nápovědy (skupinky teček), které se v nastavení mohou ukázat. */
function allHintGroups(maxNumber: number, operations: OperationMode): number[][] {
  const unique = new Map<string, number[]>();
  for (const problem of allProblems(maxNumber, operations)) {
    const groups = hintDotGroups(problem);
    if (groups.length > 0) {
      unique.set(groupsKey(groups), groups);
    }
  }
  return [...unique.values()];
}

function rowsOfGroup(dots: number): number {
  return Math.ceil(dots / DOTS_PER_ROW);
}

function totalHintRows(problem: Problem): number {
  return hintDotGroups(problem).reduce((rows, dots) => rows + rowsOfGroup(dots), 0);
}

/** Sčítání se dvěma skupinkami, u kterého nápověda zabere nejvíc řad (první a poslední takové). */
function mostRowsProblems(maxNumber: number): Problem[] {
  const twoGroups = allProblems(maxNumber, 'plus').filter(
    (problem) => hintDotGroups(problem).length === 2,
  );
  const mostRows = Math.max(...twoGroups.map(totalHintRows));
  const withMostRows = twoGroups.filter((problem) => totalHintRows(problem) === mostRows);
  return [withMostRows[0], withMostRows[withMostRows.length - 1]].filter(
    (problem): problem is Problem => problem !== undefined,
  );
}

/**
 * Okrajové a typické příklady s nápovědou jako v #54: nejmenší nápověda,
 * jedna velká skupinka, dvě skupinky, největší součet nerovnoměrně i napůl,
 * celá řada pěti teček a jedna navíc, nejvíc řad. Navíc dvě skupinky, které
 * se na úzkém telefonu vedle sebe nevejdou (6 + 4, 4 + 6, 7 + 3), a odčítání.
 */
function sampleHintProblems(maxNumber: MaxNumber, operations: OperationMode): Problem[] {
  const half = Math.floor(maxNumber / 2);
  const plusCandidates = [
    plus(1, 0),
    plus(0, maxNumber),
    plus(maxNumber, 0),
    plus(1, 1),
    plus(1, maxNumber - 1),
    plus(maxNumber - 1, 1),
    plus(half, maxNumber - half),
    plus(DOTS_PER_ROW, 0),
    plus(DOTS_PER_ROW + 1, 0),
    plus(DOTS_PER_ROW, DOTS_PER_ROW),
    plus(6, 4),
    plus(4, 6),
    plus(7, 3),
    ...mostRowsProblems(maxNumber),
  ];
  const minusCandidates = [
    minus(1, 0),
    minus(1, 1),
    minus(DOTS_PER_ROW, 0),
    minus(DOTS_PER_ROW + 1, 2),
    minus(maxNumber, 1),
    minus(maxNumber, maxNumber),
  ];
  const candidates = [
    ...(includesPlus(operations) ? plusCandidates : []),
    ...(includesMinus(operations) ? minusCandidates : []),
  ];
  const inRange = candidates.filter(
    (problem) =>
      problem.first <= maxNumber &&
      problem.second >= 0 &&
      (problem.operation === 'minus' || problem.first + problem.second <= maxNumber),
  );
  const unique = new Map(inRange.map((problem) => [problemName(problem), problem]));
  return [...unique.values()];
}

function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

// ---------------------------------------------------------------------------
// Rozložení a jeho prvky v CSS px
// ---------------------------------------------------------------------------

function layoutFor(
  area: GameArea,
  maxNumber: MaxNumber,
  mode: Mode,
  operations: OperationMode,
  starCount: number,
): PortraitLayout {
  const settings = { maxNumber, operations };
  return mode === 'číselník'
    ? layoutPhonePortraitScreen(area, settings, starCount)
    : layoutPhonePortraitWritingScreen(area, settings, starCount);
}

const variantCache = new Map<string, PortraitVariant>();

/**
 * Rozložení telefonu na výšku. Stejné zadání dává podle AC5 vždy stejné
 * rozložení, proto se pro rychlost spočítá jednou; že je opravdu pokaždé
 * stejné, ověřují testy AC4 a AC5 zvlášť.
 */
function portraitVariant(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  operations: OperationMode = 'mixed',
  starCount = STARS_PER_SET,
): PortraitVariant {
  const key = [window.name, maxNumber, mode, operations, starCount].join('|');
  const cached = variantCache.get(key);
  if (cached) {
    return cached;
  }
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutFor(area, maxNumber, mode, operations, starCount);
  const variant = { window, maxNumber, mode, operations, area, layout };
  variantCache.set(key, variant);
  return variant;
}

function isWriting(layout: PortraitLayout): layout is PhonePortraitWritingLayout {
  return 'writingAreas' in layout;
}

function css(variant: PortraitVariant, b: Box): Box {
  return toCss(b, variant.area);
}

function slotCss(variant: PortraitVariant, slot: ButtonSlot): Box {
  return css(variant, box(slot.x, slot.y, slot.size, slot.size));
}

function areaCss(variant: PortraitVariant, area: WritingAreaSlot): Box {
  return css(variant, box(area.x, area.y, area.width, area.height));
}

/** Tlačítka s čísly, nebo smazání a ✓. */
function buttonsOf(variant: PortraitVariant): ButtonSlot[] {
  const { layout } = variant;
  return isWriting(layout) ? [layout.clearButton, layout.confirmButton] : [...layout.answerButtons];
}

function buttonsCss(variant: PortraitVariant): Box[] {
  return buttonsOf(variant).map((slot) => slotCss(variant, slot));
}

/** Místo pro nejdelší vyřešený příklad v rozsahu (#40). */
function problemCss(variant: PortraitVariant): Box {
  const { problem, problemSize } = variant.layout;
  return css(variant, box(problem.x, problem.y, problemSize.width, problemSize.height));
}

function starsCss(variant: PortraitVariant): Box[] {
  const { stars, starSize } = variant.layout;
  return stars.map((star) => css(variant, box(star.x, star.y, starSize, starSize)));
}

/** Vyhrazené místo pro nápovědu. */
function hintRegionCss(variant: PortraitVariant): Box {
  return css(variant, variant.layout.hintRegion);
}

function writingBoxesCss(variant: PortraitVariant): Box[] {
  const { layout } = variant;
  return isWriting(layout) ? layout.writingAreas.map((a) => areaCss(variant, a)) : [];
}

/** Ovládání dole u palce: číselník, nebo okénka, smazání a ✓. */
function controlsCss(variant: PortraitVariant): Box[] {
  return [...writingBoxesCss(variant), ...buttonsCss(variant)];
}

/** Plocha pro prst u kolečka nastavení v souřadnicích okna (#55). */
function gearHitCss(window: TestWindow): Box {
  const gear = settingsGearFor(viewportOf(window));
  const right = window.width - gear.right;
  return { left: right - gear.hitSize, right, top: gear.top, bottom: gear.top + gear.hitSize };
}

/** Plocha pro prst u domečku v souřadnicích okna (#68). */
function homeHitCss(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

function dotCss(variant: PortraitVariant, dot: HintDot): Box {
  const size = variant.layout.hintStyle.dotSize;
  return css(variant, box(dot.x, dot.y, size, size));
}

function dotHitCss(variant: PortraitVariant, dot: HintDot): Box {
  const size = variant.layout.hintDotHitSize;
  return css(variant, box(dot.x, dot.y, size, size));
}

function canTapDots(variant: PortraitVariant): boolean {
  return variant.layout.hintDotsCountable;
}

/** Co tečka na obrazovce zabere: u ťukacích teček plochu pro prst, jinak samotnou tečku. */
function dotFootprintCss(variant: PortraitVariant, dot: HintDot): Box {
  return canTapDots(variant) ? dotHitCss(variant, dot) : dotCss(variant, dot);
}

/** Vzdálenost sousedních teček v řadě v CSS px. */
function dotCellCss(variant: PortraitVariant): number {
  const { layout, area } = variant;
  const cell = canTapDots(variant) ? layout.hintDotHitSize : layout.hintStyle.spacing;
  return cell * area.scale;
}

/** Obrazovka po 2. chybě u příkladu `problem`. */
interface HintScreen {
  readonly groups: readonly number[];
  readonly name: string;
  readonly variant: PortraitVariant;
  readonly dots: HintDot[];
}

function hintScreen(variant: PortraitVariant, groups: readonly number[], name: string): HintScreen {
  return { groups, name, variant, dots: layoutPhonePortraitHint(variant.layout, groups) };
}

function sampleHintScreens(variant: PortraitVariant): HintScreen[] {
  return sampleHintProblems(variant.maxNumber, variant.operations).map((problem) =>
    hintScreen(variant, hintDotGroups(problem), problemName(problem)),
  );
}

function label(variant: PortraitVariant, detail = ''): string {
  return `${variant.window.name}, rozsah ${variant.maxNumber}, ${variant.mode}, ${variant.operations}${detail}`;
}

function hintLabel(screen: HintScreen, detail = ''): string {
  return label(screen.variant, `, nápověda ${screen.name}${detail}`);
}

function centerX(b: Box): number {
  return (b.left + b.right) / 2;
}

function centerY(b: Box): number {
  return (b.top + b.bottom) / 2;
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

function expectMinSide(b: Box, minSide: number, where: string): void {
  expect(widthOf(b), where).toBeGreaterThanOrEqual(minSide - TOLERANCE);
  expect(heightOf(b), where).toBeGreaterThanOrEqual(minSide - TOLERANCE);
}

/**
 * Poloha a velikost všeho, co hráč vidí (kromě hvězdiček, kterých přibývá),
 * aby šlo porovnat rozložení před nápovědou a po ní a mezi příklady.
 */
function placementOf(layout: PortraitLayout): unknown {
  const common = {
    starSize: layout.starSize,
    problem: layout.problem,
    problemSize: layout.problemSize,
    problemFontSize: layout.problemFontSize,
    hintRegion: layout.hintRegion,
    hintStyle: layout.hintStyle,
    hintDotHitSize: layout.hintDotHitSize,
    hintDotsCountable: layout.hintDotsCountable,
  };
  const controls = isWriting(layout)
    ? {
        writingAreas: layout.writingAreas,
        clearButton: layout.clearButton,
        confirmButton: layout.confirmButton,
      }
    : { answerButtons: layout.answerButtons };
  return structuredClone({ ...common, ...controls });
}

// ---------------------------------------------------------------------------
// Kombinace oken, rozsahů a způsobu odpovídání
// ---------------------------------------------------------------------------

interface Case {
  readonly window: TestWindow;
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
}

const ALL_CASES: Case[] = PORTRAIT_WINDOWS.flatMap((window) =>
  RANGES.flatMap((maxNumber) => MODES.map((mode): Case => ({ window, maxNumber, mode }))),
);

const KEYPAD_CASES = ALL_CASES.filter(({ mode }) => mode === 'číselník');
const WRITING_CASES = ALL_CASES.filter(({ mode }) => mode === 'psaní');

/** Číselník do 5 a do 10 a psaní do 5: na tečky jde ťukat (#43). */
function hasTappableDots(maxNumber: MaxNumber, mode: Mode): boolean {
  return mode === 'číselník' ? maxNumber !== 20 : maxNumber === 5;
}

/** Okno, rozsah, způsob odpovídání a druh příkladů pro testy nápovědy. */
interface HintCase extends Case {
  readonly operations: OperationMode;
}

const HINT_CASES: HintCase[] = ALL_CASES.flatMap((testCase) =>
  OPERATIONS.map((operations): HintCase => ({ ...testCase, operations })),
);

function variantOf(testCase: Case | HintCase, starCount = STARS_PER_SET): PortraitVariant {
  const operations = 'operations' in testCase ? testCase.operations : 'mixed';
  return portraitVariant(testCase.window, testCase.maxNumber, testCase.mode, operations, starCount);
}

// Že se nic nepřekrývá, nic nevyčnívá ani není pod výřezem a lištou, je aspoň
// 4 px od okraje, tlačítka mají 64 px s mezerou 8 px a ťukací tečky 48 px
// (AC2, AC3, AC5), hlídají společná pravidla v `countingLayoutRules.test.ts`.

// ---------------------------------------------------------------------------

describe('vzorek nápověd pokrývá nejvyšší nápovědu', () => {
  it('360×620: nejvyšší nápověda ze vzorku je v každém rozsahu, ovládání a druhu příkladů stejně vysoká jako ze všech příkladů', () => {
    for (const maxNumber of RANGES) {
      for (const mode of MODES) {
        for (const operations of OPERATIONS) {
          const variant = portraitVariant(SMALLEST_PHONE_PORTRAIT, maxNumber, mode, operations);
          const heightOfHint = (groups: readonly number[]): number =>
            heightOf(
              boundsOf(
                layoutPhonePortraitHint(variant.layout, groups).map((dot) =>
                  dotFootprintCss(variant, dot),
                ),
              ),
            );
          const sampleTallest = Math.max(
            ...sampleHintProblems(maxNumber, operations).map((problem) =>
              heightOfHint(hintDotGroups(problem)),
            ),
          );
          const allTallest = Math.max(...allHintGroups(maxNumber, operations).map(heightOfHint));

          expect(sampleTallest, label(variant)).toBeCloseTo(allTallest, 3);
        }
      }
    }
  });
});

describe('AC1: scéna na telefonu na výšku dostane rozložení P2', () => {
  it('herní plocha je v režimu telefonu na výšku a scéna dostane pro číselník, psaní i nápovědu rozložení na výšku', () => {
    for (const window of PORTRAIT_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const settings = { maxNumber: 10 as const, operations: 'plus' as const };
      const groups = hintDotGroups(plus(7, 3));

      expect(area.mode, window.name).toBe('phonePortrait');
      const keypad = layoutDeviceScreen(area, 11, 3, [], 'plus');
      expect(keypad, window.name).toEqual(layoutPhonePortraitScreen(area, settings, 3));
      expect(layoutDeviceHint(keypad, groups), window.name).toEqual(
        layoutPhonePortraitHint(layoutPhonePortraitScreen(area, settings, 3), groups),
      );

      const writing = layoutDeviceWritingScreen(area, 10, 3, [], 'plus');
      expect(writing, window.name).toEqual(layoutPhonePortraitWritingScreen(area, settings, 3));
      expect(layoutDeviceHint(writing, groups), window.name).toEqual(
        layoutPhonePortraitHint(layoutPhonePortraitWritingScreen(area, settings, 3), groups),
      );
    }
  });
});

describe('AC2: rozložení P2 shora dolů', () => {
  it('plocha pro prst u kolečka má 64 × 64 px a je 8 px od horního a pravého okraje volné plochy', () => {
    for (const window of PORTRAIT_WINDOWS) {
      const free = freeAreaOf(window);
      const hit = gearHitCss(window);

      expect(widthOf(hit), window.name).toBe(GEAR_HIT_SIZE);
      expect(heightOf(hit), window.name).toBe(GEAR_HIT_SIZE);
      expect(hit.top - free.top, window.name).toBeCloseTo(GEAR_EDGE_OFFSET, 5);
      expect(free.right - hit.right, window.name).toBeCloseTo(GEAR_EDGE_OFFSET, 5);
    }
  });

  /**
   * #68 AC4 (otázka 1, schválený obrázek A): mezi domečkem a kolečkem se 10
   * hvězdiček do jedné řady nevejde, proto jsou ve 2 řadách po 5 v horním
   * pásu 72 px. Nejdřív se plní horní řada. Hvězdička 24 px, rozestup
   * 32 px, řady 14–38 a 42–66 px od horního okraje volné plochy.
   */
  it('hvězdičky jsou ve 2 řadách po 5 mezi domečkem a kolečkem, aspoň 4 px od obou (#68)', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const stars = starsCss(variant);
      const gear = gearHitCss(testCase.window);
      const home = homeHitCss(testCase.window);
      const rows = [stars.slice(0, STARS_PER_ROW), stars.slice(STARS_PER_ROW)];

      expect(stars, label(variant)).toHaveLength(STARS_PER_SET);
      expect(new Set(variant.layout.stars.map((star) => star.y)).size, label(variant)).toBe(2);
      expect(boundsOf(stars).left, label(variant, ', od domečku')).toBeGreaterThanOrEqual(
        home.right + MIN_STARS_TO_GEAR_GAP - TOLERANCE,
      );
      expect(boundsOf(stars).right, label(variant, ', od kolečka')).toBeLessThanOrEqual(
        gear.left - MIN_STARS_TO_GEAR_GAP + TOLERANCE,
      );
      rows.forEach((row, rowIndex) => {
        const where = label(variant, `, řada ${rowIndex + 1}`);
        expect(row, where).toHaveLength(STARS_PER_ROW);
        expect(new Set(row.map((star) => star.top)).size, where).toBe(1);
        row.forEach((star, index) => {
          const next = row[index + 1];
          if (next) {
            expect(star.right, `${where}, hvězdička ${index + 1}`).toBeLessThanOrEqual(
              next.left + TOLERANCE,
            );
          }
        });
      });
      const [top, bottom] = rows.map((row) => boundsOf(row));
      expect(top && bottom && top.bottom <= bottom.top + TOLERANCE, label(variant)).toBe(true);
    }
  });

  it('obě řady hvězdiček jsou v horním pásu domečku a kolečka a uprostřed mezi nimi (#68)', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const stars = boundsOf(starsCss(variant));
      const gear = gearHitCss(testCase.window);
      const home = homeHitCss(testCase.window);
      const free = freeAreaOf(testCase.window);

      expect(stars.top, label(variant)).toBeGreaterThanOrEqual(free.top + MIN_EDGE_DISTANCE);
      expect(stars.bottom, label(variant)).toBeLessThanOrEqual(gear.bottom + TOLERANCE);
      expect(
        Math.abs(centerX(stars) - (home.right + gear.left) / 2),
        label(variant),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    }
  });

  it('hvězdičky mají 24 px, rozestup 32 px a řady jsou 14–38 a 42–66 px od horního okraje volné plochy (#68, obrázek A)', () => {
    for (const window of PORTRAIT_WINDOWS) {
      const variant = portraitVariant(window, 10, 'číselník');
      const free = freeAreaOf(window);
      const stars = starsCss(variant);
      const top = stars.slice(0, STARS_PER_ROW);
      const bottom = stars.slice(STARS_PER_ROW);

      for (const star of stars) {
        expect(widthOf(star), window.name).toBeCloseTo(STAR_SIZE_68, 5);
      }
      expect((top[1]?.left ?? 0) - (top[0]?.left ?? 0), window.name).toBeCloseTo(
        STAR_SPACING_68,
        5,
      );
      expect((top[0]?.top ?? 0) - free.top, window.name).toBeCloseTo(14, 5);
      expect((bottom[0]?.top ?? 0) - free.top, window.name).toBeCloseTo(42, 5);
    }
  });

  it('se 7 hvězdičkami je horní řada plná a ve spodní svítí první dvě (#68)', () => {
    for (const window of PORTRAIT_WINDOWS) {
      const full = portraitVariant(window, 10, 'číselník', 'mixed', STARS_PER_SET).layout;
      const seven = portraitVariant(window, 10, 'číselník', 'mixed', 7).layout;

      expect(seven.stars, window.name).toEqual(full.stars.slice(0, 7));
      const ys = seven.stars.map((star) => star.y);
      expect(
        ys.slice(0, STARS_PER_ROW).every((y) => y === ys[0]),
        window.name,
      ).toBe(true);
      expect(ys[STARS_PER_ROW], window.name).toBeGreaterThan(ys[0] ?? 0);
    }
  });

  it('řada hvězdiček je svisle ve výšce středu kolečka', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const stars = boundsOf(starsCss(variant));

      expect(
        Math.abs(centerY(stars) - centerY(gearHitCss(testCase.window))),
        label(variant),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    }
  });

  it('příklad je pod hvězdičkami', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const stars = boundsOf(starsCss(variant));

      expect(
        problemCss(variant).top,
        label(variant, ', příklad pod hvězdičkami'),
      ).toBeGreaterThanOrEqual(stars.bottom - TOLERANCE);
    }
  });

  it('příklad je vodorovně uprostřed volné plochy, s nápovědou i bez ní (#63)', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const freeCenter = centerX(freeAreaOf(testCase.window));

      expect(
        Math.abs(centerX(problemCss(variant)) - freeCenter),
        label(variant),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      for (const screen of sampleHintScreens(variant)) {
        expect(
          Math.abs(centerX(problemCss(screen.variant)) - freeCenter),
          hintLabel(screen),
        ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      }
    }
  });

  it('pod příkladem je místo pro nápovědu a pod ním ovládání', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const problem = problemCss(variant);
      const hint = hintRegionCss(variant);
      const controls = boundsOf(controlsCss(variant));

      expect(heightOf(hint), label(variant, ', místo pro nápovědu')).toBeGreaterThan(0);
      expect(hint.top, label(variant, ', nápověda pod příkladem')).toBeGreaterThanOrEqual(
        problem.bottom - TOLERANCE,
      );
      expect(controls.top, label(variant, ', ovládání pod nápovědou')).toBeGreaterThanOrEqual(
        hint.bottom - TOLERANCE,
      );
    }
  });

  it('spodní okraj ovládání je 8 až 24 px nad spodním okrajem volné plochy (ovládání u palce)', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const gap = freeAreaOf(testCase.window).bottom - boundsOf(controlsCss(variant)).bottom;

      expect(gap, label(variant)).toBeGreaterThanOrEqual(MIN_CONTROLS_BOTTOM_GAP - TOLERANCE);
      expect(gap, label(variant)).toBeLessThanOrEqual(MAX_CONTROLS_BOTTOM_GAP + TOLERANCE);
    }
  });
});

describe('AC3: velikosti na telefonu na výšku', () => {
  it('na číselníku je každé číslo od 0 do rozsahu právě jednou', () => {
    for (const testCase of KEYPAD_CASES) {
      const variant = variantOf(testCase);
      expect(buttonsOf(variant), label(variant)).toHaveLength(testCase.maxNumber + 1);
    }
  });

  it('hvězdička má aspoň 24 px', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      for (const star of starsCss(variant)) {
        expectMinSide(star, MIN_STAR_SIZE, label(variant));
      }
    }
  });

  it('písmo příkladu má aspoň 40 px a vejde se i nejdelší vyřešený příklad', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const { layout } = variant;

      expect(layout.problemFontSize * variant.area.scale, label(variant)).toBeGreaterThanOrEqual(
        MIN_PROBLEM_FONT_SIZE - TOLERANCE,
      );
      // Místo pro příklad je stejné jako na iPadu: odhad šířky nejdelšího příkladu při tomto písmu.
      const ipad = layoutScreen(1024, 768, testCase.maxNumber + 1);
      expect(
        layout.problemSize.width / layout.problemFontSize,
        label(variant),
      ).toBeGreaterThanOrEqual(ipad.problemSize.width / ipad.problemFontSize - TOLERANCE);
    }
  });
});

describe('AC4: číselník na telefonu na výšku', () => {
  const KEYPAD_ROWS: Record<MaxNumber, number[][]> = {
    5: [
      [0, 1, 2],
      [3, 4, 5],
    ],
    10: [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10],
    ],
    20: [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20]],
  };

  function numberRows(variant: PortraitVariant): Array<Array<{ number: number; x: number }>> {
    const buttons = buttonsOf(variant).map((slot, number) => ({ number, x: slot.x, y: slot.y }));
    return rowsByY(buttons).map((row) => [...row].sort((a, b) => a.x - b.x));
  }

  it('čísla jdou od 0 zleva doprava a shora dolů ve 3 sloupcích (do 5 3 × 2, do 10 3 × 4, do 20 5 × 5)', () => {
    for (const testCase of KEYPAD_CASES) {
      const variant = variantOf(testCase);
      const rows = numberRows(variant).map((row) => row.map((button) => button.number));

      expect(rows, label(variant)).toEqual(KEYPAD_ROWS[testCase.maxNumber]);
    }
  });

  it('neúplná poslední řada je vodorovně uprostřed číselníku', () => {
    for (const testCase of KEYPAD_CASES.filter(({ maxNumber }) => maxNumber !== 5)) {
      const variant = variantOf(testCase);
      const keypad = boundsOf(buttonsCss(variant));
      const lastRow = numberRows(variant).at(-1) ?? [];
      const lastRowCss = boundsOf(
        lastRow.map((button) => slotCss(variant, buttonsOf(variant)[button.number] as ButtonSlot)),
      );

      expect(Math.abs(centerX(lastRowCss) - centerX(keypad)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
    }
  });

  it('číselník je při všech příkladech a počtech hvězdiček na stejném místě a stejně velký', () => {
    for (const { window, maxNumber, mode } of KEYPAD_CASES) {
      const area = gameAreaFor(viewportOf(window));
      const expected = layoutFor(area, maxNumber, mode, 'mixed', 0) as PhonePortraitScreenLayout;

      for (let starCount = 0; starCount <= STARS_PER_SET; starCount += 1) {
        const layout = layoutFor(
          area,
          maxNumber,
          mode,
          'mixed',
          starCount,
        ) as PhonePortraitScreenLayout;
        for (const problem of sampleHintProblems(maxNumber, 'mixed')) {
          layoutPhonePortraitHint(layout, hintDotGroups(problem));
        }
        expect(
          layout.answerButtons,
          `${window.name}, rozsah ${maxNumber}, ${starCount} hvězdiček`,
        ).toEqual(expected.answerButtons);
      }
    }
  });
});

describe('AC5: nápověda po 2. chybě nic neposune', () => {
  it('po ukázání nápovědy zůstane všechno na místě a stejně velké', () => {
    for (const testCase of HINT_CASES) {
      const variant = variantOf(testCase);
      const before = placementOf(variant.layout);

      for (const screen of sampleHintScreens(variant)) {
        expect(placementOf(screen.variant.layout), hintLabel(screen)).toEqual(before);
      }
      const fresh = layoutFor(
        variant.area,
        testCase.maxNumber,
        testCase.mode,
        testCase.operations,
        STARS_PER_SET,
      );
      expect(placementOf(fresh), label(variant, ', znovu spočítané rozložení')).toEqual(before);
    }
  });

  it('mezi příklady se rozložení nezmění, přibude jen hvězdička', () => {
    for (const { window, maxNumber, mode } of ALL_CASES) {
      const full = portraitVariant(window, maxNumber, mode, 'mixed', STARS_PER_SET).layout;

      for (let starCount = 0; starCount < STARS_PER_SET; starCount += 1) {
        const layout = portraitVariant(window, maxNumber, mode, 'mixed', starCount).layout;
        const where = `${window.name}, rozsah ${maxNumber}, ${mode}, ${starCount} hvězdiček`;

        expect(placementOf(layout), where).toEqual(placementOf(full));
        expect(layout.stars, where).toEqual(full.stars.slice(0, starCount));
      }
    }
  });

  it('tečky každé nápovědy z nastavení se vejdou do vyhrazeného místa (#56)', () => {
    for (const testCase of HINT_CASES) {
      const variant = variantOf(testCase);
      const region = hintRegionCss(variant);

      for (const groups of allHintGroups(testCase.maxNumber, testCase.operations)) {
        const dots = layoutPhonePortraitHint(variant.layout, groups);
        const where = label(variant, `, nápověda [${groups.join(', ')}]`);

        expect(dots, where).toHaveLength(groups.reduce((sum, count) => sum + count, 0));
        for (const dot of dots) {
          expect(isInside(dotFootprintCss(variant, dot), region), where).toBe(true);
        }
      }
    }
  });

  it('vyhrazené místo odpovídá nejvyšší nápovědě z nastavení', () => {
    for (const testCase of HINT_CASES) {
      const variant = variantOf(testCase);
      const tallest = Math.max(
        ...sampleHintScreens(variant).map((screen) =>
          heightOf(boundsOf(screen.dots.map((dot) => dotFootprintCss(variant, dot)))),
        ),
      );

      // Místo není vyšší, než potřebuje nejvyšší nápověda (s rezervou jedné řady teček).
      expect(heightOf(hintRegionCss(variant)), label(variant)).toBeLessThanOrEqual(
        tallest + dotCellCss(variant) + TOLERANCE,
      );
    }
  });

  it('tečky jsou po pěti v řadě, jen poslední řada skupinky smí mít méně', () => {
    for (const testCase of HINT_CASES) {
      for (const screen of sampleHintScreens(variantOf(testCase))) {
        for (const group of new Set(screen.dots.map((dot) => dot.group))) {
          const where = hintLabel(screen, `, skupinka ${group}`);
          const counts = rowsByY(screen.dots.filter((dot) => dot.group === group)).map(
            (row) => row.length,
          );
          counts.slice(0, -1).forEach((count) => {
            expect(count, where).toBe(DOTS_PER_ROW);
          });
          expect(counts.at(-1), where).toBeLessThanOrEqual(DOTS_PER_ROW);
        }
      }
    }
  });

  it('skupinky jsou vedle sebe, pod sebou jen když se vedle sebe nevejdou', () => {
    for (const testCase of HINT_CASES) {
      const variant = variantOf(testCase);
      const regionWidth = widthOf(hintRegionCss(variant));
      const cell = dotCellCss(variant);

      for (const screen of sampleHintScreens(variant)) {
        if (screen.groups.length < 2) {
          continue;
        }
        const [first, second] = [0, 1].map((group) =>
          boundsOf(
            screen.dots
              .filter((dot) => dot.group === group)
              .map((dot) => dotFootprintCss(variant, dot)),
          ),
        ) as [Box, Box];
        const sideBySide = second.left >= first.right - TOLERANCE;
        const stacked = second.top >= first.bottom - TOLERANCE;

        expect(sideBySide || stacked, hintLabel(screen)).toBe(true);
        if (!sideBySide) {
          // Vedle sebe by se nevešly ani s mezerou o šířce jedné tečky.
          const widthSideBySide = screen.groups
            .map((count) => Math.min(count, DOTS_PER_ROW) * cell)
            .reduce((sum, width) => sum + width, 0);
          expect(widthSideBySide + cell, hintLabel(screen, ', pod sebou')).toBeGreaterThan(
            regionWidth + TOLERANCE,
          );
        }
      }
    }
  });

  it('na tečky jde ťukat u číselníku do 5 a do 10 a u psaní do 5, jinak jsou jen k dívání a mají aspoň 20 px', () => {
    for (const testCase of ALL_CASES) {
      const variant = variantOf(testCase);
      const tappable = hasTappableDots(testCase.maxNumber, testCase.mode);

      expect(canTapDots(variant), label(variant)).toBe(tappable);
      if (!tappable) {
        expect(
          variant.layout.hintStyle.dotSize * variant.area.scale,
          label(variant),
        ).toBeGreaterThanOrEqual(MIN_LOOK_ONLY_DOT_SIZE - TOLERANCE);
      }
    }
  });
});

describe('AC6: psaní prstem na telefonu na výšku', () => {
  function writingLayoutOf(variant: PortraitVariant): PhonePortraitWritingLayout {
    return variant.layout as PhonePortraitWritingLayout;
  }

  it('do 5 má jediné okénko aspoň 200 × 200 px, do 10 a 20 jsou dvě vedle sebe aspoň 160 × 160 px s mezerou aspoň 12 px', () => {
    for (const testCase of WRITING_CASES) {
      const variant = variantOf(testCase);
      const boxes = writingBoxesCss(variant);

      if (testCase.maxNumber === 5) {
        expect(boxes, label(variant)).toHaveLength(1);
        expectMinSide(boxes[0] as Box, MIN_SINGLE_BOX_SIDE, label(variant));
        continue;
      }
      expect(boxes, label(variant)).toHaveLength(2);
      const [tens, ones] = boxes as [Box, Box];
      expectMinSide(tens, MIN_TWO_BOX_SIDE, label(variant, ', desítky'));
      expectMinSide(ones, MIN_TWO_BOX_SIDE, label(variant, ', jednotky'));
      expect(ones.left - tens.right, label(variant, ', desítky vlevo')).toBeGreaterThanOrEqual(
        MIN_BOX_GAP - TOLERANCE,
      );
      expect(Math.abs(tens.top - ones.top), label(variant, ', vedle sebe')).toBeLessThanOrEqual(
        TOLERANCE,
      );
    }
  });

  it('okénko smí být vyšší než široké nejvýš 1,6×', () => {
    for (const testCase of WRITING_CASES) {
      const variant = variantOf(testCase);
      for (const area of writingBoxesCss(variant)) {
        expect(heightOf(area) / widthOf(area), label(variant)).toBeLessThanOrEqual(
          MAX_BOX_HEIGHT_RATIO + TOLERANCE,
        );
      }
    }
  });

  it('pod okénky aspoň 12 px od nich je vlevo smazání a vpravo ✓', () => {
    for (const testCase of WRITING_CASES) {
      const variant = variantOf(testCase);
      const layout = writingLayoutOf(variant);
      const boxes = boundsOf(writingBoxesCss(variant));
      const clear = slotCss(variant, layout.clearButton);
      const confirm = slotCss(variant, layout.confirmButton);

      for (const [name, button] of [
        ['smazání', clear],
        ['✓', confirm],
      ] as const) {
        expect(
          button.top - boxes.bottom,
          label(variant, `, ${name} pod okénky`),
        ).toBeGreaterThanOrEqual(MIN_BOXES_TO_BUTTONS_GAP - TOLERANCE);
      }
      expect(clear.right, label(variant, ', smazání vlevo od ✓')).toBeLessThanOrEqual(
        confirm.left + TOLERANCE,
      );
      expect(centerX(clear), label(variant, ', smazání vlevo')).toBeLessThan(centerX(boxes));
      expect(centerX(confirm), label(variant, ', ✓ vpravo')).toBeGreaterThan(centerX(boxes));
    }
  });

  it('dotyk v okénku se započítá jako tah, dotyk mimo okénka a v mezeře mezi nimi ne', () => {
    for (const testCase of WRITING_CASES) {
      const variant = variantOf(testCase);
      const layout = writingLayoutOf(variant);
      const step = 1;

      layout.writingAreas.forEach((area, index) => {
        const expected = layout.writingAreas.length === 2 && index === 0 ? 'tens' : 'ones';
        const halfWidth = area.width / 2;
        const halfHeight = area.height / 2;

        expect(writingAreaAt(layout, area), label(variant)).toBe(expected);
        expect(
          writingAreaAt(layout, { x: area.x + halfWidth - step, y: area.y + halfHeight - step }),
          label(variant, ', dolní roh vysokého okénka'),
        ).toBe(expected);
        for (const outside of [
          { x: area.x, y: area.y - halfHeight - step },
          { x: area.x, y: area.y + halfHeight + step },
          { x: area.x - halfWidth - step, y: area.y },
          { x: area.x + halfWidth + step, y: area.y },
        ]) {
          // Dotyk těsně vedle okénka smí patřit jen sousednímu okénku, ne tomuto.
          expect(
            writingAreaAt(layout, outside) === expected,
            label(variant, ` mimo okénko ${index + 1}`),
          ).toBe(false);
        }
      });

      for (const point of [layout.clearButton, layout.confirmButton, layout.problem]) {
        expect(writingAreaAt(layout, point), label(variant, ', dotyk mimo okénka')).toBeNull();
      }
      if (layout.writingAreas.length === 2) {
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
