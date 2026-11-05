/**
 * Rozložení V2 na telefonu (#54) v CSS px: nahoře uprostřed hvězdičky,
 * pod nimi uprostřed příklad s nápovědou vpravo od něj,
 * dole přes šířku číselník nebo okénka na psaní. Čistý TypeScript.
 */

import { controlsOptions } from './phoneControls';
import type { Controls } from './phoneControls';
import { basePlan, hintBlocksFor, problemOptions } from './phoneElements';
import type { HintBlock, ProblemSizes } from './phoneElements';
import { placeHintBlock } from './phoneHint';
import {
  EDGE_MARGIN,
  FONT_SIZES,
  GEAR_CORNER_GAP,
  GEAR_CORNER_SIZE,
  MIN_GAP_ABOVE_CONTROLS,
  MIN_GAP_BELOW_STARS,
  MIN_GAP_BOTTOM,
  PROBLEM_HINT_GAP,
  STAR_ROW_BOTTOM,
} from './phonePlan';
import type { FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import type { HintDot, Point } from './screenLayout';

interface MiddleRowSpec extends ProblemSizes {
  readonly hint: HintBlock | null;
}

interface MiddlePlacement {
  readonly problem: Point;
  readonly hintDots: HintDot[];
}

interface MiddleRow {
  readonly width: number;
  readonly height: number;
  readonly place: (left: number, top: number) => MiddlePlacement;
}

/**
 * Nejmenší výška prostřední řady (#63). Řada je aspoň tak vysoká jako
 * před #63, aby uvolněné místo nezabralo větší ovládání na úkor písma
 * příkladu.
 */
const MIN_MIDDLE_ROW_HEIGHT = 76;

/** Příklad a tečky vpravo od něj; obojí svisle uprostřed řady. */
function middleRow(spec: MiddleRowSpec): MiddleRow {
  const { problem, hint } = spec;
  const width = problem.width + (hint ? PROBLEM_HINT_GAP + hint.width : 0);
  const height = Math.max(MIN_MIDDLE_ROW_HEIGHT, problem.height, hint?.height ?? 0);

  return {
    width,
    height,
    place: (left, top) => ({
      problem: { x: left + problem.width / 2, y: top + height / 2 },
      hintDots: placeRowHint(hint, left + problem.width, top, height),
    }),
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

/** Nejvyšší místo, které příklad a buňky teček v řadě opravdu zaberou (tečky jsou na celých px). */
function placedTop(spec: MiddleRowSpec, placement: MiddlePlacement): number {
  const halfCell = (spec.hint?.grid.cell ?? 0) / 2;
  const dotTops = placement.hintDots.map((dot) => dot.y - halfCell);
  return Math.min(placement.problem.y - spec.problem.height / 2, ...dotTops);
}

/** Levý okraj prostřední řady: uprostřed, a když by zasáhla do rohu s kolečkem, posune se doleva. */
function middleRowLeft(free: FreeSize, spec: MiddleRowSpec, row: MiddleRow, top: number): number {
  const centered = (free.width - row.width) / 2;
  const limit = free.width - GEAR_CORNER_SIZE - GEAR_CORNER_GAP;
  const reachesCorner = placedTop(spec, row.place(centered, top)) < GEAR_CORNER_SIZE;
  if (!reachesCorner || centered + row.width <= limit) {
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
    ...row.place(middleRowLeft(free, spec, row, rowTop), rowTop),
    ...controls.place((free.width - controls.width) / 2, controlsTop),
  };
}

/** Všechny možnosti prostřední řady od největšího písma. */
function middleRowSpecs(request: PhonePlanRequest): MiddleRowSpec[] {
  const hints = hintBlocksFor(request);
  return problemOptions(FONT_SIZES, request.maxNumber).flatMap((sizes) =>
    hints.map((hint) => ({ ...sizes, hint })),
  );
}

/**
 * Písmo příkladu aspoň takhle velké má přednost před větším ovládáním (#63).
 * Bez toho by se větší číselník nebo okénka vešly jen s mnohem menším
 * příkladem než před #63.
 */
const PREFERRED_MIN_FONT_SIZE = 56;

/**
 * Kandidáti rozložení V2: nejdřív s písmem aspoň `PREFERRED_MIN_FONT_SIZE`,
 * pak s menším; v každé skupině od největšího ovládání a písma.
 */
export function* stackedCandidates(request: PhonePlanRequest): Generator<PhonePlan> {
  const specs = middleRowSpecs(request);
  const preferred = specs.filter((spec) => spec.font >= PREFERRED_MIN_FONT_SIZE);
  const smaller = specs.filter((spec) => spec.font < PREFERRED_MIN_FONT_SIZE);
  for (const tier of [preferred, smaller]) {
    yield* candidatesFor(request, tier);
  }
}

/** Kandidáti od největšího ovládání a v něm od největšího písma. */
function* candidatesFor(
  request: PhonePlanRequest,
  specs: readonly MiddleRowSpec[],
): Generator<PhonePlan> {
  for (const controls of controlsOptions(request)) {
    for (const spec of specs) {
      const plan = planStacked(request, controls, spec);
      if (plan) {
        yield plan;
      }
    }
  }
}
