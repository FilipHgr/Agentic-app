/**
 * Rozložení V2 na telefonu (#54) v CSS px: nahoře uprostřed hvězdičky,
 * pod nimi uprostřed postavička a příklad s nápovědou vpravo od něj,
 * dole přes šířku číselník nebo okénka na psaní. Čistý TypeScript.
 */

import { controlsOptions } from './phoneControls';
import type { Controls } from './phoneControls';
import {
  basePlan,
  hintBlocksFor,
  mascotCenterBelow,
  mascotHeight,
  mascotWidth,
  problemAndMascotOptions,
} from './phoneElements';
import type { HintBlock, ProblemAndMascot } from './phoneElements';
import { placeHintBlock, visibleGroups } from './phoneHint';
import {
  EDGE_MARGIN,
  FONT_SIZES,
  GEAR_CORNER_GAP,
  GEAR_CORNER_SIZE,
  MASCOT_ABOVE_PROBLEM_GAP,
  MASCOT_PROBLEM_GAP,
  MIN_GAP_ABOVE_CONTROLS,
  MIN_GAP_BELOW_STARS,
  MIN_GAP_BOTTOM,
  PROBLEM_HINT_GAP,
  STAR_ROW_BOTTOM,
} from './phonePlan';
import type { FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import type { HintDot, Point } from './screenLayout';

/** Postavička vedle příkladu, nebo nad ním (jen s nápovědou). */
type MascotPlace = 'beside' | 'above';

interface MiddleRowSpec extends ProblemAndMascot {
  readonly mascotPlace: MascotPlace;
  readonly hint: HintBlock | null;
}

interface MiddlePlacement {
  readonly mascot: Point;
  readonly problem: Point;
  readonly hintDots: HintDot[];
}

interface MiddleRow {
  readonly width: number;
  readonly height: number;
  readonly place: (left: number, top: number) => MiddlePlacement;
}

/** Postavička vlevo vedle příkladu, tečky vpravo od něj; vše svisle uprostřed řady. */
function besideRow(spec: MiddleRowSpec): MiddleRow {
  const { problem, mascotSize, hint } = spec;
  const mascotW = mascotWidth(mascotSize);
  const mascotH = mascotHeight(mascotSize);
  const problemRightOffset = mascotW + MASCOT_PROBLEM_GAP + problem.width;
  const width = problemRightOffset + (hint ? PROBLEM_HINT_GAP + hint.width : 0);
  const height = Math.max(mascotH, problem.height, hint?.height ?? 0);

  return {
    width,
    height,
    place: (left, top) => ({
      mascot: mascotCenterBelow(left + mascotW / 2, top + (height - mascotH) / 2, mascotSize),
      problem: { x: left + problemRightOffset - problem.width / 2, y: top + height / 2 },
      hintDots: placeRowHint(hint, left + problemRightOffset, top, height),
    }),
  };
}

/** Postavička nad příkladem, tečky vpravo od příkladu. */
function aboveRow(spec: MiddleRowSpec): MiddleRow {
  const { problem, mascotSize, hint } = spec;
  const columnWidth = Math.max(problem.width, mascotWidth(mascotSize));
  const mascotH = mascotHeight(mascotSize);
  const columnHeight = mascotH + MASCOT_ABOVE_PROBLEM_GAP + problem.height;
  const width = columnWidth + (hint ? PROBLEM_HINT_GAP + hint.width : 0);
  const height = Math.max(columnHeight, hint?.height ?? 0);

  return {
    width,
    height,
    place: (left, top) => {
      const columnTop = top + (height - columnHeight) / 2;
      const centerX = left + columnWidth / 2;
      return {
        mascot: mascotCenterBelow(centerX, columnTop, mascotSize),
        problem: { x: centerX, y: columnTop + columnHeight - problem.height / 2 },
        hintDots: placeRowHint(hint, centerX + problem.width / 2, top, height),
      };
    },
  };
}

/** Tečky vpravo od příkladu, svisle uprostřed řady. */
function placeRowHint(
  hint: HintBlock | null,
  problemRight: number,
  rowTop: number,
  rowHeight: number,
): HintDot[] {
  if (!hint) {
    return [];
  }
  const top = rowTop + (rowHeight - hint.height) / 2;
  return placeHintBlock(
    hint.groups,
    hint.grid,
    hint.arrangement,
    problemRight + PROBLEM_HINT_GAP,
    top,
  );
}

function middleRow(spec: MiddleRowSpec): MiddleRow {
  return spec.mascotPlace === 'beside' ? besideRow(spec) : aboveRow(spec);
}

/** Levý okraj prostřední řady: uprostřed, a když by zasáhla do rohu s kolečkem, posune se doleva. */
function middleRowLeft(free: FreeSize, row: MiddleRow, top: number): number {
  const centered = (free.width - row.width) / 2;
  const limit = free.width - GEAR_CORNER_SIZE - GEAR_CORNER_GAP;
  if (top >= GEAR_CORNER_SIZE || centered + row.width <= limit) {
    return centered;
  }
  return Math.max(EDGE_MARGIN, limit - row.width);
}

/** Hvězdičky, prostřední řada a ovládání pod sebou; volné místo se rozdělí rovným dílem. */
function planStacked(
  request: PhonePlanRequest,
  controls: Controls,
  spec: MiddleRowSpec,
): PhonePlan | null {
  const { free } = request;
  const row = middleRow(spec);
  const used =
    STAR_ROW_BOTTOM +
    MIN_GAP_BELOW_STARS +
    row.height +
    MIN_GAP_ABOVE_CONTROLS +
    controls.height +
    MIN_GAP_BOTTOM;
  if (used > free.height || Math.max(row.width, controls.width) > free.width - 2 * EDGE_MARGIN) {
    return null;
  }
  const extra = (free.height - used) / 3;
  const rowTop = STAR_ROW_BOTTOM + MIN_GAP_BELOW_STARS + extra;
  const controlsTop = rowTop + row.height + MIN_GAP_ABOVE_CONTROLS + extra;

  return {
    ...basePlan(request, spec, spec.hint?.grid ?? null),
    ...row.place(middleRowLeft(free, row, rowTop), rowTop),
    ...controls.place((free.width - controls.width) / 2, controlsTop),
  };
}

/** Všechny možnosti prostřední řady od největšího písma a postavičky. */
function middleRowSpecs(request: PhonePlanRequest): MiddleRowSpec[] {
  const withHint = visibleGroups(request.hintGroups).length > 0;
  const places: MascotPlace[] = withHint ? ['beside', 'above'] : ['beside'];
  const hints = hintBlocksFor(request);
  return problemAndMascotOptions(FONT_SIZES, request.maxNumber, withHint).flatMap((sizes) =>
    places.flatMap((mascotPlace) => hints.map((hint) => ({ ...sizes, mascotPlace, hint }))),
  );
}

/** Kandidáti rozložení V2 od největšího ovládání a písma. */
export function* stackedCandidates(request: PhonePlanRequest): Generator<PhonePlan> {
  const specs = middleRowSpecs(request);
  for (const controls of controlsOptions(request)) {
    for (const spec of specs) {
      const plan = planStacked(request, controls, spec);
      if (plan) {
        yield plan;
      }
    }
  }
}
