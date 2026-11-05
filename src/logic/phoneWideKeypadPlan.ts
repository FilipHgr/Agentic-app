/**
 * Číselník do 20 na telefonu (#54, výjimka V2) v CSS px: tři řady po 7
 * vpravo dole, postavička s příkladem vlevo od něj a tečky nápovědy vpravo
 * od příkladu nad číselníkem. Čistý TypeScript.
 */

import { WIDE_KEYPAD_ROW_LENGTH, keypadControls } from './phoneControls';
import {
  basePlan,
  dotGridsFor,
  mascotCenterBelow,
  mascotHeight,
  mascotWidth,
  problemAndMascotOptions,
  starRowRect,
} from './phoneElements';
import type { DotGrid, ProblemAndMascot } from './phoneElements';
import { placeHintInRegions, visibleGroups } from './phoneHint';
import type { Region } from './phoneHint';
import {
  EDGE_MARGIN,
  FONT_SIZES,
  GEAR_CORNER_GAP,
  GEAR_CORNER_SIZE,
  HINT_REGION_GAP,
  MASCOT_ABOVE_PROBLEM_GAP,
  MASCOT_PROBLEM_GAP,
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
  readonly mascot: Point;
  readonly problem: Point;
}

/** S nápovědou příklad nahoře vlevo, aby tečky mohly být hned vpravo od něj; postavička pod ním. */
function placeColumnWithHint(column: Region, sizes: ProblemAndMascot): ColumnPlacement {
  const { problem, mascotSize } = sizes;
  const problemCenter = { x: column.left + problem.width / 2, y: column.top + problem.height / 2 };
  const mascotTop = column.top + problem.height + MASCOT_ABOVE_PROBLEM_GAP;
  return {
    problem: problemCenter,
    mascot: mascotCenterBelow(problemCenter.x, mascotTop, mascotSize),
  };
}

/** Bez nápovědy postavička vedle příkladu, nebo nad ním, uprostřed sloupce. */
function placeColumnCentered(column: Region, sizes: ProblemAndMascot): ColumnPlacement {
  const { problem, mascotSize } = sizes;
  const mascotW = mascotWidth(mascotSize);
  const mascotH = mascotHeight(mascotSize);
  const centerX = (column.left + column.right) / 2;
  const besideWidth = mascotW + MASCOT_PROBLEM_GAP + problem.width;
  if (besideWidth <= column.right - column.left) {
    const height = Math.max(mascotH, problem.height);
    const top = column.top + (column.bottom - column.top - height) / 2;
    const left = centerX - besideWidth / 2;
    return {
      mascot: mascotCenterBelow(left + mascotW / 2, top + (height - mascotH) / 2, mascotSize),
      problem: { x: left + besideWidth - problem.width / 2, y: top + height / 2 },
    };
  }
  const height = mascotH + MASCOT_ABOVE_PROBLEM_GAP + problem.height;
  const top = column.top + (column.bottom - column.top - height) / 2;
  return {
    mascot: mascotCenterBelow(centerX, top, mascotSize),
    problem: { x: centerX, y: top + height - problem.height / 2 },
  };
}

function placeColumn(
  column: Region,
  sizes: ProblemAndMascot,
  withHint: boolean,
): ColumnPlacement | null {
  const columnWidth = column.right - column.left;
  if (sizes.problem.width > columnWidth || mascotWidth(sizes.mascotSize) > columnWidth) {
    return null;
  }
  return withHint ? placeColumnWithHint(column, sizes) : placeColumnCentered(column, sizes);
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

/** Plán pro jeden číselník a jednu velikost písma a postavičky (všechny mřížky teček). */
function* plansFor(
  request: PhonePlanRequest,
  keypad: WideKeypad,
  sizes: ProblemAndMascot,
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
  const withHint = visibleGroups(request.hintGroups).length > 0;
  const sizeOptions = problemAndMascotOptions(FONT_SIZES, request.maxNumber, withHint);
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
