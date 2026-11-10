/**
 * Prvky rozložení telefonu (V2, #54) v CSS px: hvězdičky, příklad
 * a tečky nápovědy. Čistý TypeScript.
 */

import { hintBlockSize, visibleGroups } from './phoneHint';
import type { GroupArrangement, HintGrid, Region } from './phoneHint';
import {
  STAR_ROW_BOTTOM,
  STAR_ROW_TOP,
  STAR_ROW_WIDTH,
  STAR_SIZE,
  STAR_SPACING,
} from './phonePlan';
import type { FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import { problemMaxWidth, problemTextHeight } from './screenLayout';
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
// Příklad
// ---------------------------------------------------------------------------

/** Místo pro nejdelší příklad v rozsahu (stejný odhad jako na iPadu, s přesností na půl px). */
export function problemBox(font: number, maxNumber: MaxNumber): FreeSize {
  return {
    width: problemMaxWidth(font * 2, maxNumber) / 2,
    height: problemTextHeight(font * 2) / 2,
  };
}

/** Písmo příkladu a místo pro něj. */
export interface ProblemSizes {
  readonly font: number;
  readonly problem: FreeSize;
}

/** Možné velikosti písma příkladu od největších. */
export function problemOptions(fonts: readonly number[], maxNumber: MaxNumber): ProblemSizes[] {
  return fonts.map((font) => ({ font, problem: problemBox(font, maxNumber) }));
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
  sizes: ProblemSizes,
  grid: DotGrid | null,
): Omit<PhonePlan, 'problem' | 'hintDots' | 'answerButtons' | 'writing'> {
  return {
    stars: layoutStars(request.free, request.starCount),
    starSize: STAR_SIZE,
    problemFontSize: sizes.font,
    problemWidth: sizes.problem.width,
    problemHeight: sizes.problem.height,
    hintCell: grid?.cell ?? 0,
    hintDotSize: grid?.dotSize ?? 0,
    hintDotsCountable: grid ? grid.countable : dotsCountableWithoutHint(request),
  };
}
