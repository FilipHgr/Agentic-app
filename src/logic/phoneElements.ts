/**
 * Prvky rozložení telefonu (V2, #54) v CSS px: hvězdičky, postavička,
 * příklad a tečky nápovědy. Čistý TypeScript.
 */

import { hintBlockSize, visibleGroups } from './phoneHint';
import type { GroupArrangement, HintGrid, Region } from './phoneHint';
import {
  MIN_MASCOT_SIZE,
  MIN_MASCOT_SIZE_WITH_HINT,
  STAR_ROW_BOTTOM,
  STAR_ROW_TOP,
  STAR_ROW_WIDTH,
  STAR_SIZE,
  STAR_SPACING,
} from './phonePlan';
import type { FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import {
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  problemMaxWidth,
  problemTextHeight,
} from './screenLayout';
import type { Point } from './screenLayout';
import type { MaxNumber } from './settings';

// ---------------------------------------------------------------------------
// Hvězdičky
// ---------------------------------------------------------------------------

/** Hvězdičky nahoře uprostřed; místo je vždy pro celou řadu. */
export function layoutStars(free: FreeSize, starCount: number): Point[] {
  const firstX = (free.width - STAR_ROW_WIDTH) / 2 + STAR_SIZE / 2;
  return Array.from({ length: starCount }, (_, index) => ({
    x: firstX + index * STAR_SPACING,
    y: STAR_ROW_TOP + STAR_SIZE / 2,
  }));
}

export function starRowRect(free: FreeSize): Region {
  const left = (free.width - STAR_ROW_WIDTH) / 2;
  return { left, right: left + STAR_ROW_WIDTH, top: STAR_ROW_TOP, bottom: STAR_ROW_BOTTOM };
}

// ---------------------------------------------------------------------------
// Postavička a příklad
// ---------------------------------------------------------------------------

/** Postavička je zhruba stejně velká jako písmo příkladu. */
const MASCOT_PER_FONT_SIZE = 1.1;

function mascotJump(size: number): number {
  return (size * MASCOT_JUMP_HEIGHT) / MASCOT_SIZE;
}

function mascotSway(size: number): number {
  return (size * MASCOT_DANCE_SWAY) / MASCOT_SIZE;
}

/** Šířka postavičky i s tancem do stran. */
export function mascotWidth(size: number): number {
  return size + 2 * mascotSway(size);
}

/** Výška postavičky i se skokem nahoru. */
export function mascotHeight(size: number): number {
  return size + mascotJump(size);
}

/** Místo, které postavička zabere i při skoku a tanci. */
export function mascotRect(center: Point, size: number): Region {
  return {
    left: center.x - mascotWidth(size) / 2,
    right: center.x + mascotWidth(size) / 2,
    top: center.y - size / 2 - mascotJump(size),
    bottom: center.y + size / 2,
  };
}

/** Střed postavičky, jejíž místo i se skokem začíná nahoře na `top`. */
export function mascotCenterBelow(x: number, top: number, size: number): Point {
  return { x, y: top + mascotJump(size) + size / 2 };
}

/** Místo pro nejdelší příklad v rozsahu (stejný odhad jako na iPadu, s přesností na půl px). */
export function problemBox(font: number, maxNumber: MaxNumber): FreeSize {
  return {
    width: problemMaxWidth(font * 2, maxNumber) / 2,
    height: problemTextHeight(font * 2) / 2,
  };
}

/** Písmo příkladu, místo pro něj a velikost postavičky. */
export interface ProblemAndMascot {
  readonly font: number;
  readonly problem: FreeSize;
  readonly mascotSize: number;
}

/** Možné velikosti písma a postavičky od největších; s nápovědou smí být postavička 48 px. */
export function problemAndMascotOptions(
  fonts: readonly number[],
  maxNumber: MaxNumber,
  withHint: boolean,
): ProblemAndMascot[] {
  return fonts.flatMap((font) => {
    const regular = Math.max(MIN_MASCOT_SIZE, Math.round(font * MASCOT_PER_FONT_SIZE));
    const mascotSizes = withHint ? [regular, MIN_MASCOT_SIZE_WITH_HINT] : [regular];
    const problem = problemBox(font, maxNumber);
    return mascotSizes.map((mascotSize) => ({ font, problem, mascotSize }));
  });
}

// ---------------------------------------------------------------------------
// Tečky nápovědy
// ---------------------------------------------------------------------------

/** Buňky teček, na které se ťuká (aspoň 48 px), a teček jen k dívání (tečka aspoň 20 px). */
const TAPPABLE_DOT_CELLS = [56, 48];
const LOOK_ONLY_DOT_CELLS = [32, 28, 24, 22, 20];
const MIN_LOOK_ONLY_DOT_SIZE = 20;
const LOOK_ONLY_DOT_SPACE = 6;
const TAPPABLE_DOT_RATIO = 0.75;
const DOT_GROUP_GAP = 8;

/** Mřížka teček s velikostí tečky. */
export interface DotGrid extends HintGrid {
  readonly dotSize: number;
  readonly countable: boolean;
}

function dotGrid(cell: number, countable: boolean): DotGrid {
  const dotSize = countable
    ? Math.round(cell * TAPPABLE_DOT_RATIO)
    : Math.max(MIN_LOOK_ONLY_DOT_SIZE, cell - LOOK_ONLY_DOT_SPACE);
  return { cell, dotSize, countable, groupGap: DOT_GROUP_GAP };
}

/**
 * Možné mřížky teček od největší. Na tečky se ťuká u číselníku do 5 a 10;
 * při psaní do 5 se to zkusí, jinak jsou jen k dívání.
 */
export function dotGridsFor(request: PhonePlanRequest): DotGrid[] {
  const keypadCounting = request.answerInput === 'keypad' && request.maxNumber !== 20;
  const tappable = TAPPABLE_DOT_CELLS.map((cell) => dotGrid(cell, true));
  const lookOnly = LOOK_ONLY_DOT_CELLS.map((cell) => dotGrid(cell, false));
  if (keypadCounting) {
    return tappable;
  }
  if (request.answerInput === 'writing' && request.maxNumber === 5) {
    return [...tappable, ...lookOnly];
  }
  return lookOnly;
}

/** Půjde na tečky ťukat, až se nápověda ukáže? (Bez nápovědy se mřížka ještě nevybrala.) */
export function dotsCountableWithoutHint(request: PhonePlanRequest): boolean {
  return dotGridsFor(request)[0]?.countable === true;
}

/** Tečky jako jeden blok vedle příkladu. */
export interface HintBlock {
  readonly groups: readonly number[];
  readonly grid: DotGrid;
  readonly arrangement: GroupArrangement;
  readonly width: number;
  readonly height: number;
}

/** Možné bloky teček od největších; bez nápovědy jediná možnost `null`. */
export function hintBlocksFor(request: PhonePlanRequest): (HintBlock | null)[] {
  const groups = visibleGroups(request.hintGroups);
  if (groups.length === 0) {
    return [null];
  }
  return dotGridsFor(request).flatMap((grid) =>
    (['sideBySide', 'stacked'] as const).map((arrangement) => ({
      groups,
      grid,
      arrangement,
      ...hintBlockSize(groups, grid, arrangement),
    })),
  );
}

// ---------------------------------------------------------------------------
// Části plánu společné pro všechna rozložení
// ---------------------------------------------------------------------------

/** Hvězdičky, písmo a velikosti; zbytek doplní konkrétní rozložení. */
export function basePlan(
  request: PhonePlanRequest,
  sizes: ProblemAndMascot,
  grid: DotGrid | null,
): Omit<PhonePlan, 'mascot' | 'problem' | 'hintDots' | 'answerButtons' | 'writing'> {
  return {
    stars: layoutStars(request.free, request.starCount),
    starSize: STAR_SIZE,
    mascotSize: sizes.mascotSize,
    problemFontSize: sizes.font,
    problemWidth: sizes.problem.width,
    problemHeight: sizes.problem.height,
    hintCell: grid?.cell ?? 0,
    hintDotSize: grid?.dotSize ?? 0,
    hintDotsCountable: grid ? grid.countable : dotsCountableWithoutHint(request),
  };
}
