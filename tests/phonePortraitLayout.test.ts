import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import {
  gameAreaFor,
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
  layoutPhonePortraitHint,
  layoutPhonePortraitScreen,
  layoutPhonePortraitWritingScreen,
  settingsGearFor,
} from '../src/logic/deviceLayout';
import type {
  GameArea,
  PhonePortraitScreenLayout,
  PhonePortraitWritingLayout,
} from '../src/logic/deviceLayout';
import type { Problem } from '../src/logic/problems';
import { layoutScreen, writingAreaAt } from '../src/logic/screenLayout';
import type { ButtonSlot, HintDot, WritingAreaSlot } from '../src/logic/screenLayout';
import type { MaxNumber, OperationMode } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';
import {
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  SMALLEST_PHONE_PORTRAIT,
  box,
  boundsOf,
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  toCss,
  viewportOf,
  widthOf,
} from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/**
 * Testy k #56 (hra na telefonu na výšku, rozložení P2), AC2 až AC6.
 * Kdy se rozložení na výšku použije (AC1), hlídá `deviceLayout.test.ts`,
 * rozpoznávání ve vysokém okénku (AC6) `phonePortraitRecognition.test.ts`
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
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const OPERATIONS: OperationMode[] = ['plus', 'minus', 'mixed'];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

/** Prázdná řada hvězdiček i plná řada při oslavě po deseti. */
const STAR_COUNTS = [0, STARS_PER_SET];

/** Kolečko nastavení (#55): plocha pro prst a odsazení od rohu volné plochy, v CSS px. */
const GEAR_HIT_SIZE = 64;
const GEAR_EDGE_OFFSET = 8;

/** AC2 v CSS px. */
const MIN_STARS_TO_GEAR_GAP = 4;
const MIN_EDGE_DISTANCE = 4;
const MIN_CONTROLS_BOTTOM_GAP = 8;
const MAX_CONTROLS_BOTTOM_GAP = 24;

/** AC3 v CSS px. */
const MIN_BUTTON_SIDE = 64;
const MIN_BUTTON_GAP = 8;
const MIN_STAR_SIZE = 24;
const MIN_MASCOT_SIZE = 64;
const MIN_PROBLEM_FONT_SIZE = 40;

/** AC5 v CSS px. */
const MIN_DOT_HIT_SIDE = 48;
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

interface Element {
  readonly name: string;
  readonly css: Box;
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

/** Postavička i se skokem nahoru a tancem do stran (viz src/scenes/Mascot.ts). */
function mascotCss(variant: PortraitVariant): Box {
  const { mascot, mascotSize, mascotJumpHeight, mascotDanceSway } = variant.layout;
  return css(variant, {
    left: mascot.x - mascotSize / 2 - mascotDanceSway,
    right: mascot.x + mascotSize / 2 + mascotDanceSway,
    top: mascot.y - mascotSize / 2 - mascotJumpHeight,
    bottom: mascot.y + mascotSize / 2,
  });
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

/** Všechno, co je na obrazovce kromě teček nápovědy, i s kolečkem. */
function fixedElements(variant: PortraitVariant): Element[] {
  const { layout } = variant;
  const elements: Element[] = [
    { name: 'kolečko', css: gearHitCss(variant.window) },
    ...starsCss(variant).map((css, index) => ({ name: `hvězdička ${index + 1}`, css })),
    { name: 'postavička i se skokem a tancem', css: mascotCss(variant) },
    { name: 'příklad', css: problemCss(variant) },
    { name: 'místo pro nápovědu', css: hintRegionCss(variant) },
  ];
  if (isWriting(layout)) {
    layout.writingAreas.forEach((area, index) =>
      elements.push({ name: `okénko ${index + 1}`, css: areaCss(variant, area) }),
    );
    elements.push({ name: 'smazání', css: slotCss(variant, layout.clearButton) });
    elements.push({ name: '✓', css: slotCss(variant, layout.confirmButton) });
  } else {
    layout.answerButtons.forEach((slot, index) =>
      elements.push({ name: `tlačítko ${index}`, css: slotCss(variant, slot) }),
    );
  }
  return elements;
}

/** Volná plocha zmenšená o povinný odstup 4 px od okraje (AC2). */
function safeInnerArea(window: TestWindow): Box {
  const free = freeAreaOf(window);
  return {
    left: free.left + MIN_EDGE_DISTANCE,
    right: free.right - MIN_EDGE_DISTANCE,
    top: free.top + MIN_EDGE_DISTANCE,
    bottom: free.bottom - MIN_EDGE_DISTANCE,
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

function expectNoOverlaps(elements: readonly Element[], where: string): void {
  elements.forEach((first, i) => {
    elements.slice(i + 1).forEach((second) => {
      expect(overlaps(first.css, second.css), `${where}, ${first.name} a ${second.name}`).toBe(
        false,
      );
    });
  });
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
    mascot: layout.mascot,
    mascotSize: layout.mascotSize,
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

type Case = [string, MaxNumber, Mode, TestWindow];

const ALL_CASES: Case[] = PORTRAIT_WINDOWS.flatMap((window) =>
  RANGES.flatMap((maxNumber) => MODES.map((mode): Case => [window.name, maxNumber, mode, window])),
);

const KEYPAD_CASES = ALL_CASES.filter(([, , mode]) => mode === 'číselník');
const WRITING_CASES = ALL_CASES.filter(([, , mode]) => mode === 'psaní');

/** Číselník do 5 a do 10 a psaní do 5: na tečky jde ťukat (#43). */
function hasTappableDots(maxNumber: MaxNumber, mode: Mode): boolean {
  return mode === 'číselník' ? maxNumber !== 20 : maxNumber === 5;
}

const TAPPABLE_CASES = ALL_CASES.filter(([, maxNumber, mode]) => hasTappableDots(maxNumber, mode));
const LOOK_ONLY_CASES = ALL_CASES.filter(
  ([, maxNumber, mode]) => !hasTappableDots(maxNumber, mode),
);

/** Okno, rozsah, způsob odpovídání a druh příkladů pro testy nápovědy. */
type HintCase = [string, MaxNumber, Mode, OperationMode, TestWindow];

const HINT_CASES: HintCase[] = ALL_CASES.flatMap(([name, maxNumber, mode, window]) =>
  OPERATIONS.map((operations): HintCase => [name, maxNumber, mode, operations, window]),
);

// ---------------------------------------------------------------------------

describe('vzorek nápověd pokrývá nejvyšší nápovědu', () => {
  it.each(
    RANGES.flatMap((maxNumber) =>
      MODES.flatMap((mode) =>
        OPERATIONS.map((operations): [MaxNumber, Mode, OperationMode] => [
          maxNumber,
          mode,
          operations,
        ]),
      ),
    ),
  )(
    '360×620, rozsah %i, %s, %s: nejvyšší nápověda ze vzorku je stejně vysoká jako ze všech příkladů',
    (maxNumber, mode, operations) => {
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
    },
  );
});

describe('AC1: scéna na telefonu na výšku dostane rozložení P2', () => {
  it.each(PORTRAIT_WINDOWS)('$name: herní plocha je v režimu telefonu na výšku', (window) => {
    expect(gameAreaFor(viewportOf(window)).mode).toBe('phonePortrait');
  });

  it.each(PORTRAIT_WINDOWS)(
    '$name: rozložení pro scénu (číselník, psaní, nápověda) je rozložení na výšku',
    (window) => {
      const area = gameAreaFor(viewportOf(window));
      const settings = { maxNumber: 10 as const, operations: 'plus' as const };
      const groups = hintDotGroups(plus(7, 3));

      const keypad = layoutDeviceScreen(area, 11, 3, [], 'plus');
      expect(keypad).toEqual(layoutPhonePortraitScreen(area, settings, 3));
      expect(layoutDeviceHint(keypad, groups)).toEqual(
        layoutPhonePortraitHint(layoutPhonePortraitScreen(area, settings, 3), groups),
      );

      const writing = layoutDeviceWritingScreen(area, 10, 3, [], 'plus');
      expect(writing).toEqual(layoutPhonePortraitWritingScreen(area, settings, 3));
      expect(layoutDeviceHint(writing, groups)).toEqual(
        layoutPhonePortraitHint(layoutPhonePortraitWritingScreen(area, settings, 3), groups),
      );
    },
  );
});

describe('AC2: rozložení P2 shora dolů', () => {
  it.each(PORTRAIT_WINDOWS)(
    '$name: plocha pro prst u kolečka má 64 × 64 px a je 8 px od horního a pravého okraje volné plochy',
    (window) => {
      const free = freeAreaOf(window);
      const hit = gearHitCss(window);

      expect(widthOf(hit)).toBe(GEAR_HIT_SIZE);
      expect(heightOf(hit)).toBe(GEAR_HIT_SIZE);
      expect(hit.top - free.top).toBeCloseTo(GEAR_EDGE_OFFSET, 5);
      expect(free.right - hit.right).toBeCloseTo(GEAR_EDGE_OFFSET, 5);
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): všech deset hvězdiček je v jedné řadě vlevo od kolečka, aspoň 4 px od něj',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const stars = starsCss(variant);
      const gear = gearHitCss(window);

      expect(stars, label(variant)).toHaveLength(STARS_PER_SET);
      expect(new Set(variant.layout.stars.map((star) => star.y)).size, label(variant)).toBe(1);
      expect(boundsOf(stars).right, label(variant)).toBeLessThanOrEqual(
        gear.left - MIN_STARS_TO_GEAR_GAP + TOLERANCE,
      );
      stars.forEach((star, index) => {
        const next = stars[index + 1];
        if (next) {
          expect(star.right, label(variant, `, hvězdička ${index + 1}`)).toBeLessThanOrEqual(
            next.left + TOLERANCE,
          );
        }
      });
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): řada hvězdiček je svisle ve výšce středu kolečka',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const stars = boundsOf(starsCss(variant));

      expect(
        Math.abs(centerY(stars) - centerY(gearHitCss(window))),
        label(variant),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): postavička je pod hvězdičkami vlevo od příkladu, ve výšce příkladu',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const stars = boundsOf(starsCss(variant));
      const mascot = mascotCss(variant);
      const problem = problemCss(variant);
      const drawnMascotY = variant.area.offsetY + variant.layout.mascot.y * variant.area.scale;

      expect(mascot.top, label(variant, ', postavička pod hvězdičkami')).toBeGreaterThanOrEqual(
        stars.bottom - TOLERANCE,
      );
      expect(problem.top, label(variant, ', příklad pod hvězdičkami')).toBeGreaterThanOrEqual(
        stars.bottom - TOLERANCE,
      );
      expect(mascot.right, label(variant, ', postavička vlevo od příkladu')).toBeLessThanOrEqual(
        problem.left + TOLERANCE,
      );
      expect(drawnMascotY, label(variant, ', postavička ve výšce příkladu')).toBeGreaterThanOrEqual(
        problem.top - TOLERANCE,
      );
      expect(drawnMascotY, label(variant, ', postavička ve výšce příkladu')).toBeLessThanOrEqual(
        problem.bottom + TOLERANCE,
      );
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): postavička s příkladem jsou jako dvojice vodorovně uprostřed',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const pair = { ...problemCss(variant), left: mascotCss(variant).left };

      expect(
        Math.abs(centerX(pair) - centerX(freeAreaOf(window))),
        label(variant),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): pod příkladem je místo pro nápovědu a pod ním ovládání',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const problem = problemCss(variant);
      const mascot = mascotCss(variant);
      const hint = hintRegionCss(variant);
      const controls = boundsOf(controlsCss(variant));

      expect(heightOf(hint), label(variant, ', místo pro nápovědu')).toBeGreaterThan(0);
      expect(hint.top, label(variant, ', nápověda pod příkladem')).toBeGreaterThanOrEqual(
        problem.bottom - TOLERANCE,
      );
      expect(controls.top, label(variant, ', ovládání pod nápovědou')).toBeGreaterThanOrEqual(
        hint.bottom - TOLERANCE,
      );
      expect(controls.top, label(variant, ', ovládání pod postavičkou')).toBeGreaterThanOrEqual(
        mascot.bottom - TOLERANCE,
      );
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): spodní okraj ovládání je 8 až 24 px nad spodním okrajem volné plochy',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const gap = freeAreaOf(window).bottom - boundsOf(controlsCss(variant)).bottom;

      expect(gap, label(variant)).toBeGreaterThanOrEqual(MIN_CONTROLS_BOTTOM_GAP - TOLERANCE);
      expect(gap, label(variant)).toBeLessThanOrEqual(MAX_CONTROLS_BOTTOM_GAP + TOLERANCE);
    },
  );

  for (const starCount of STAR_COUNTS) {
    it.each(ALL_CASES)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: nic se nepřekrývá, ani postavička při skoku a tanci`,
      (_, maxNumber, mode, window) => {
        const variant = portraitVariant(window, maxNumber, mode, 'mixed', starCount);
        expectNoOverlaps(fixedElements(variant), label(variant));
      },
    );

    it.each(ALL_CASES)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: nic nevyčnívá, není pod výřezem ani lištou a je aspoň 4 px od okraje`,
      (_, maxNumber, mode, window) => {
        const variant = portraitVariant(window, maxNumber, mode, 'mixed', starCount);
        const inner = safeInnerArea(window);

        for (const element of fixedElements(variant)) {
          expect(isInside(element.css, inner), label(variant, `, ${element.name}`)).toBe(true);
        }
      },
    );
  }

  it.each(HINT_CASES)(
    '%s, rozsah %i (%s, %s): s nápovědou se nic nepřekrývá a tečky jsou aspoň 4 px od okraje',
    (_, maxNumber, mode, operations, window) => {
      const variant = portraitVariant(window, maxNumber, mode, operations);
      const inner = safeInnerArea(window);
      const others = fixedElements(variant).filter(
        (element) => element.name !== 'místo pro nápovědu',
      );

      for (const screen of sampleHintScreens(variant)) {
        const dots: Element[] = screen.dots.map((dot, index) => ({
          name: `tečka ${index + 1}`,
          css: dotFootprintCss(variant, dot),
        }));
        expectNoOverlaps([...others, ...dots], hintLabel(screen));
        for (const dot of dots) {
          expect(isInside(dot.css, inner), hintLabel(screen, `, ${dot.name}`)).toBe(true);
        }
      }
    },
  );
});

describe('AC3: velikosti na telefonu na výšku', () => {
  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): tlačítka mají aspoň 64 × 64 px a mezi sousedními je aspoň 8 px',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const buttons = buttonsCss(variant);

      buttons.forEach((first, i) => {
        expectMinSide(first, MIN_BUTTON_SIDE, label(variant, `, tlačítko ${i}`));
        buttons.slice(i + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            label(variant, `, tlačítka ${i} a ${i + offset + 1}`),
          ).toBeGreaterThanOrEqual(MIN_BUTTON_GAP - TOLERANCE);
        });
      });
    },
  );

  it('na číselníku je každé číslo od 0 do rozsahu právě jednou', () => {
    for (const window of PORTRAIT_WINDOWS) {
      for (const maxNumber of RANGES) {
        const variant = portraitVariant(window, maxNumber, 'číselník');
        expect(buttonsOf(variant), label(variant)).toHaveLength(maxNumber + 1);
      }
    }
  });

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): hvězdička má aspoň 24 px',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);

      for (const star of starsCss(variant)) {
        expectMinSide(star, MIN_STAR_SIZE, label(variant));
      }
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): postavička má aspoň 64 px, i když je vidět nápověda',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const size = (layout: PortraitLayout): number => layout.mascotSize * variant.area.scale;

      expect(size(variant.layout), label(variant)).toBeGreaterThanOrEqual(
        MIN_MASCOT_SIZE - TOLERANCE,
      );
      for (const screen of sampleHintScreens(variant)) {
        expect(size(screen.variant.layout), hintLabel(screen)).toBeGreaterThanOrEqual(
          MIN_MASCOT_SIZE - TOLERANCE,
        );
      }
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): písmo příkladu má aspoň 40 px a vejde se i nejdelší vyřešený příklad',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const { layout } = variant;

      expect(layout.problemFontSize * variant.area.scale, label(variant)).toBeGreaterThanOrEqual(
        MIN_PROBLEM_FONT_SIZE - TOLERANCE,
      );
      // Místo pro příklad je stejné jako na iPadu: odhad šířky nejdelšího příkladu při tomto písmu.
      const ipad = layoutScreen(1024, 768, maxNumber + 1);
      expect(
        layout.problemSize.width / layout.problemFontSize,
        label(variant),
      ).toBeGreaterThanOrEqual(ipad.problemSize.width / ipad.problemFontSize - TOLERANCE);
    },
  );
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

  it.each(KEYPAD_CASES)(
    '%s, rozsah %i (%s): čísla jdou od 0 zleva doprava a shora dolů (do 5 3 × 2, do 10 3 × 4, do 20 5 × 5)',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const rows = numberRows(variant).map((row) => row.map((button) => button.number));

      expect(rows, label(variant)).toEqual(KEYPAD_ROWS[maxNumber]);
    },
  );

  it.each(KEYPAD_CASES.filter(([, maxNumber]) => maxNumber !== 5))(
    '%s, rozsah %i (%s): neúplná poslední řada je vodorovně uprostřed číselníku',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const keypad = boundsOf(buttonsCss(variant));
      const lastRow = numberRows(variant).at(-1) ?? [];
      const lastRowCss = boundsOf(
        lastRow.map((button) => slotCss(variant, buttonsOf(variant)[button.number] as ButtonSlot)),
      );

      expect(Math.abs(centerX(lastRowCss) - centerX(keypad)), label(variant)).toBeLessThanOrEqual(
        CENTER_TOLERANCE,
      );
    },
  );

  it.each(KEYPAD_CASES)(
    '%s, rozsah %i (%s): číselník je při všech příkladech na stejném místě a stejně velký',
    (_, maxNumber, mode, window) => {
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
        expect(layout.answerButtons, `${window.name}, ${starCount} hvězdiček`).toEqual(
          expected.answerButtons,
        );
      }
    },
  );
});

describe('AC5: nápověda po 2. chybě nic neposune', () => {
  it.each(HINT_CASES)(
    '%s, rozsah %i (%s, %s): po ukázání nápovědy zůstane všechno na místě a stejně velké',
    (_, maxNumber, mode, operations, window) => {
      const variant = portraitVariant(window, maxNumber, mode, operations);
      const before = placementOf(variant.layout);

      for (const screen of sampleHintScreens(variant)) {
        expect(placementOf(screen.variant.layout), hintLabel(screen)).toEqual(before);
      }
      const fresh = layoutFor(variant.area, maxNumber, mode, operations, STARS_PER_SET);
      expect(placementOf(fresh), label(variant, ', znovu spočítané rozložení')).toEqual(before);
    },
  );

  it.each(ALL_CASES)(
    '%s, rozsah %i (%s): mezi příklady se rozložení nezmění, přibude jen hvězdička',
    (_, maxNumber, mode, window) => {
      const full = portraitVariant(window, maxNumber, mode, 'mixed', STARS_PER_SET).layout;

      for (let starCount = 0; starCount < STARS_PER_SET; starCount += 1) {
        const layout = portraitVariant(window, maxNumber, mode, 'mixed', starCount).layout;
        const where = `${window.name}, rozsah ${maxNumber}, ${mode}, ${starCount} hvězdiček`;

        expect(placementOf(layout), where).toEqual(placementOf(full));
        expect(layout.stars, where).toEqual(full.stars.slice(0, starCount));
      }
    },
  );

  it.each(HINT_CASES)(
    '%s, rozsah %i (%s, %s): tečky každé nápovědy z nastavení se vejdou do vyhrazeného místa',
    (_, maxNumber, mode, operations, window) => {
      const variant = portraitVariant(window, maxNumber, mode, operations);
      const region = hintRegionCss(variant);

      for (const groups of allHintGroups(maxNumber, operations)) {
        const dots = layoutPhonePortraitHint(variant.layout, groups);
        const where = label(variant, `, nápověda [${groups.join(', ')}]`);

        expect(dots, where).toHaveLength(groups.reduce((sum, count) => sum + count, 0));
        for (const dot of dots) {
          expect(isInside(dotFootprintCss(variant, dot), region), where).toBe(true);
        }
      }
    },
  );

  it.each(HINT_CASES)(
    '%s, rozsah %i (%s, %s): vyhrazené místo odpovídá nejvyšší nápovědě z nastavení',
    (_, maxNumber, mode, operations, window) => {
      const variant = portraitVariant(window, maxNumber, mode, operations);
      const tallest = Math.max(
        ...sampleHintScreens(variant).map((screen) =>
          heightOf(boundsOf(screen.dots.map((dot) => dotFootprintCss(variant, dot)))),
        ),
      );

      // Místo není vyšší, než potřebuje nejvyšší nápověda (s rezervou jedné řady teček).
      expect(heightOf(hintRegionCss(variant)), label(variant)).toBeLessThanOrEqual(
        tallest + dotCellCss(variant) + TOLERANCE,
      );
    },
  );

  it.each(HINT_CASES)(
    '%s, rozsah %i (%s, %s): tečky jsou po pěti v řadě, jen poslední řada skupinky smí mít méně',
    (_, maxNumber, mode, operations, window) => {
      for (const screen of sampleHintScreens(
        portraitVariant(window, maxNumber, mode, operations),
      )) {
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
    },
  );

  it.each(HINT_CASES)(
    '%s, rozsah %i (%s, %s): skupinky jsou vedle sebe, pod sebou jen když se vedle sebe nevejdou',
    (_, maxNumber, mode, operations, window) => {
      const variant = portraitVariant(window, maxNumber, mode, operations);
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
    },
  );

  it.each(TAPPABLE_CASES)(
    '%s, rozsah %i (%s): na tečky jde ťukat a každá má plochu pro prst aspoň 48 × 48 px',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);

      expect(canTapDots(variant), label(variant)).toBe(true);
      for (const screen of sampleHintScreens(variant)) {
        const hits = screen.dots.map((dot) => dotHitCss(variant, dot));
        const controls = controlsCss(variant);
        const gear = gearHitCss(window);

        hits.forEach((hit, i) => {
          const where = hintLabel(screen, `, plocha tečky ${i + 1}`);
          expectMinSide(hit, MIN_DOT_HIT_SIDE, where);
          expect(overlaps(hit, gear), where).toBe(false);
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

  it.each(LOOK_ONLY_CASES)(
    '%s, rozsah %i (%s): tečky jsou jen k dívání a mají aspoň 20 px',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);

      expect(canTapDots(variant), label(variant)).toBe(false);
      expect(
        variant.layout.hintStyle.dotSize * variant.area.scale,
        label(variant),
      ).toBeGreaterThanOrEqual(MIN_LOOK_ONLY_DOT_SIZE - TOLERANCE);
    },
  );
});

describe('AC6: psaní prstem na telefonu na výšku', () => {
  function writingLayoutOf(variant: PortraitVariant): PhonePortraitWritingLayout {
    return variant.layout as PhonePortraitWritingLayout;
  }

  it.each(WRITING_CASES.filter(([, maxNumber]) => maxNumber === 5))(
    '%s, rozsah %i (%s): jediné okénko má aspoň 200 × 200 px',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const boxes = writingBoxesCss(variant);

      expect(boxes, label(variant)).toHaveLength(1);
      expectMinSide(boxes[0] as Box, MIN_SINGLE_BOX_SIDE, label(variant));
    },
  );

  it.each(WRITING_CASES.filter(([, maxNumber]) => maxNumber !== 5))(
    '%s, rozsah %i (%s): dvě okénka vedle sebe, každé aspoň 160 × 160 px, mezi nimi aspoň 12 px',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
      const boxes = writingBoxesCss(variant);

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
    },
  );

  it.each(WRITING_CASES)(
    '%s, rozsah %i (%s): okénko smí být vyšší než široké nejvýš 1,6×',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);

      for (const area of writingBoxesCss(variant)) {
        expect(heightOf(area) / widthOf(area), label(variant)).toBeLessThanOrEqual(
          MAX_BOX_HEIGHT_RATIO + TOLERANCE,
        );
      }
    },
  );

  it.each(WRITING_CASES)(
    '%s, rozsah %i (%s): pod okénky aspoň 12 px od nich je vlevo smazání a vpravo ✓',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
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
    },
  );

  it.each(WRITING_CASES)(
    '%s, rozsah %i (%s): dotyk mimo okénka se nezapočítá jako tah, dotyk v okénku ano',
    (_, maxNumber, mode, window) => {
      const variant = portraitVariant(window, maxNumber, mode);
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

      for (const point of [
        layout.clearButton,
        layout.confirmButton,
        layout.problem,
        layout.mascot,
      ]) {
        expect(writingAreaAt(layout, point), label(variant, ', dotyk mimo okénka')).toBeNull();
      }
    },
  );

  it.each(WRITING_CASES.filter(([, maxNumber]) => maxNumber !== 5))(
    '%s, rozsah %i (%s): dotyk v mezeře mezi okénky se nezapočítá jako tah',
    (_, maxNumber, mode, window) => {
      const layout = writingLayoutOf(portraitVariant(window, maxNumber, mode));
      const [tens, ones] = layout.writingAreas as [WritingAreaSlot, WritingAreaSlot];
      const gapMiddle = (tens.x + tens.width / 2 + (ones.x - ones.width / 2)) / 2;

      expect(writingAreaAt(layout, { x: gapMiddle, y: tens.y }), window.name).toBeNull();
    },
  );
});
