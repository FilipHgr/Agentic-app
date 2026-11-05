/**
 * Číselník do 20 na telefonu (#54, výjimka V2) v CSS px: tři řady po 7
 * vpravo dole, příklad vlevo od něj a tečky nápovědy vpravo
 * od příkladu nad číselníkem. Čistý TypeScript.
 */

import { WIDE_KEYPAD_ROW_LENGTH, keypadControls } from './phoneControls';
import { basePlan, dotGridsFor, problemOptions, starRowRect } from './phoneElements';
import type { DotGrid, ProblemSizes } from './phoneElements';
import { placeHintInRegions, visibleGroups } from './phoneHint';
import type { Region } from './phoneHint';
import {
  EDGE_MARGIN,
  FONT_SIZES,
  GEAR_CORNER_GAP,
  GEAR_CORNER_SIZE,
  HINT_REGION_GAP,
  MIN_GAP_BELOW_STARS,
  MIN_GAP_BOTTOM,
  PROBLEM_HINT_GAP,
  STAR_ROW_BOTTOM,
} from './phonePlan';
import type { ControlsPlacement, FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import type { HintDot, Point } from './screenLayout';

const WIDE_KEYPAD_BUTTON_SIZES = [80, 72, 64];

/** Číselník vpravo dole a volný sloupec vlevo od něj. */
interface WideKeypad {
  readonly placement: ControlsPlacement;
  readonly top: number;
  readonly column: Region;
}

/** Číselník s tlačítky `size` vpravo dole; `null`, když by zasáhl do rohu s kolečkem. */
function wideKeypad(request: PhonePlanRequest, size: number): WideKeypad | null {
  const { free } = request;
  const controls = keypadControls(request.maxNumber + 1, size, WIDE_KEYPAD_ROW_LENGTH);
  const spaceBelowCorner = free.height - GEAR_CORNER_SIZE - controls.height;
  const bottomMargin = Math.min(EDGE_MARGIN, Math.max(0, spaceBelowCorner));
  const top = free.height - bottomMargin - controls.height;
  if (top < GEAR_CORNER_SIZE) {
    return null;
  }
  const left = free.width - EDGE_MARGIN - controls.width;
  return {
    placement: controls.place(left, top),
    top,
    column: {
      left: EDGE_MARGIN,
      right: left - EDGE_MARGIN,
      top: STAR_ROW_BOTTOM + MIN_GAP_BELOW_STARS,
      bottom: free.height - MIN_GAP_BOTTOM,
    },
  };
}

interface ColumnPlacement {
  readonly problem: Point;
}

/** S nápovědou příklad nahoře vlevo, aby tečky mohly být hned vpravo od něj. */
function placeColumnWithHint(column: Region, sizes: ProblemSizes): ColumnPlacement {
  const { problem } = sizes;
  return {
    problem: { x: column.left + problem.width / 2, y: column.top + problem.height / 2 },
  };
}

/** Bez nápovědy příklad uprostřed sloupce. */
function placeColumnCentered(column: Region): ColumnPlacement {
  return {
    problem: { x: (column.left + column.right) / 2, y: (column.top + column.bottom) / 2 },
  };
}

function placeColumn(
  column: Region,
  sizes: ProblemSizes,
  withHint: boolean,
): ColumnPlacement | null {
  if (sizes.problem.width > column.right - column.left) {
    return null;
  }
  return withHint ? placeColumnWithHint(column, sizes) : placeColumnCentered(column);
}

/**
 * Místa pro tečky vpravo od příkladu nad číselníkem: nejdřív celý pruh,
 * jinak pruh až k hvězdičkám a místo vpravo od hvězdiček (na nízkém okně).
 */
function hintRegionSets(free: FreeSize, problemRight: number, keypadTop: number): Region[][] {
  const stars = starRowRect(free);
  const cornerLimit = free.width - GEAR_CORNER_SIZE - GEAR_CORNER_GAP;
  const top = STAR_ROW_BOTTOM + HINT_REGION_GAP;
  const bottom = keypadTop - HINT_REGION_GAP;
  const left = problemRight + PROBLEM_HINT_GAP;
  const bandRight = top < GEAR_CORNER_SIZE ? cornerLimit : free.width - EDGE_MARGIN;
  const band: Region = { left, top, bottom, right: bandRight };
  const bandBelowStars: Region = { left, top, bottom, right: stars.right + HINT_REGION_GAP };
  const besideStars: Region = {
    left: stars.right + 2 * HINT_REGION_GAP,
    right: cornerLimit,
    top: 0,
    bottom,
  };
  return [[band], [bandBelowStars, besideStars]];
}

function placeWideHint(
  request: PhonePlanRequest,
  grid: DotGrid,
  problemRight: number,
  keypadTop: number,
): HintDot[] | null {
  const groups = visibleGroups(request.hintGroups);
  for (const regions of hintRegionSets(request.free, problemRight, keypadTop)) {
    const dots = placeHintInRegions(groups, grid, regions);
    if (dots) {
      return dots;
    }
  }
  return null;
}

/** Plán pro jeden číselník a jednu velikost písma (všechny mřížky teček). */
function* plansFor(
  request: PhonePlanRequest,
  keypad: WideKeypad,
  sizes: ProblemSizes,
): Generator<PhonePlan> {
  const withHint = visibleGroups(request.hintGroups).length > 0;
  const column = placeColumn(keypad.column, sizes, withHint);
  if (!column) {
    return;
  }
  const problemRight = column.problem.x + sizes.problem.width / 2;
  const grids: (DotGrid | null)[] = withHint ? dotGridsFor(request) : [null];
  for (const grid of grids) {
    const hintDots = grid ? placeWideHint(request, grid, problemRight, keypad.top) : [];
    if (hintDots) {
      yield { ...basePlan(request, sizes, grid), ...column, hintDots, ...keypad.placement };
    }
  }
}

/** Kandidáti pro číselník do 20 od největších tlačítek a písma. */
export function* wideKeypadCandidates(request: PhonePlanRequest): Generator<PhonePlan> {
  const sizeOptions = problemOptions(FONT_SIZES, request.maxNumber);
  for (const buttonSize of WIDE_KEYPAD_BUTTON_SIZES) {
    const keypad = wideKeypad(request, buttonSize);
    if (!keypad) {
      continue;
    }
    for (const sizes of sizeOptions) {
      yield* plansFor(request, keypad, sizes);
    }
  }
}
