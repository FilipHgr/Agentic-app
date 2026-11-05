/**
 * Rozložení telefonu na výšku podle návrhu P2 (#56), v CSS px volné plochy
 * (bez výřezu a lišty, levý horní roh je 0, 0).
 *
 * Shora dolů: vlevo od kolečka nastavení řada hvězdiček, pod ní postavička
 * vlevo od příkladu (dvojice je vodorovně uprostřed), pod příkladem
 * vyhrazené místo pro nápovědu a dole u palce číselník nebo okénka na psaní.
 * Rozložení závisí jen na velikosti plochy a nastavení, ne na nápovědě,
 * takže se po ukázání nápovědy nic neposune (AC5).
 *
 * Velikosti se zkouší od největších: písmo příkladu, tečky nápovědy,
 * ovládání. Použije se první rozložení, ve kterém se všechno vejde.
 * Převod na herní jednotky je v `phonePortraitLayout.ts`. Čistý TypeScript.
 */

import type { Controls } from './phoneControls';
import {
  dotGridsFor,
  mascotCenterBelow,
  mascotWidth,
  problemAndMascotOptions,
  problemBox,
} from './phoneElements';
import type { DotGrid, ProblemAndMascot } from './phoneElements';
import type { Region } from './phoneHint';
import { portraitControlsOptions, smallestPortraitControls } from './phonePortraitControls';
import { HINT_GROUP_GAP, possibleHintGroups, reservedHintSize } from './phonePortraitHint';
import type { PortraitLayoutSettings } from './phonePortraitHint';
import { FONT_SIZES, MASCOT_PROBLEM_GAP, MIN_MASCOT_SIZE, STAR_SIZE } from './phonePlan';
import type { FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import type { Point } from './screenLayout';
import { STARS_PER_SET } from './stars';

export type { PortraitLayoutSettings } from './phonePortraitHint';

/** Rozložení na výšku v CSS px; tečky nápovědy dopočítá `placePortraitHint`. */
export interface PortraitPlan extends Omit<PhonePlan, 'hintDots'> {
  /** Vyhrazené místo pro nejvyšší nápovědu z nastavení. */
  readonly hintRegion: Region;
}

/** Nic není blíž než 4 px k okraji volné plochy (AC2). */
const EDGE_MARGIN = 4;

/** Plocha pro prst u kolečka nastavení (#55): 64 px, 8 px od horního a pravého okraje. */
const GEAR_HIT_SIZE = 64;
const GEAR_INSET = 8;
const GEAR_BOTTOM = GEAR_INSET + GEAR_HIT_SIZE;
/** Hvězdičky aspoň 4 px od plochy kolečka, postavička 4 px pod ní. */
const GEAR_GAP = 4;

/** Svislý střed řady hvězdiček je ve výšce středu plochy kolečka (AC2). */
const STAR_ROW_CENTER_Y = GEAR_INSET + GEAR_HIT_SIZE / 2;
const MAX_STAR_SPACING = 32;

/** Písmo příkladu aspoň 40 px (AC3). */
const MIN_PORTRAIT_FONT_SIZE = 40;
const PORTRAIT_FONT_SIZES = FONT_SIZES.filter((font) => font >= MIN_PORTRAIT_FONT_SIZE);

/** Svislé mezery: pod příkladem, nad ovládáním a ovládání nad spodním okrajem (8 až 24 px). */
const PROBLEM_HINT_GAP = 8;
const HINT_CONTROLS_GAP = 8;
const CONTROLS_BOTTOM_GAP = 16;

/** Tolerance na zaokrouhlení při porovnání s velikostí místa. */
const FIT_TOLERANCE = 0.001;

// ---------------------------------------------------------------------------
// Hvězdičky
// ---------------------------------------------------------------------------

/** Hvězdičky v řadě vlevo od kolečka; místo je vždy pro celou řadu. */
function layoutPortraitStars(free: FreeSize, starCount: number): Point[] {
  const rowRight = free.width - GEAR_BOTTOM - GEAR_GAP;
  const room = rowRight - EDGE_MARGIN;
  const spacing = Math.min(MAX_STAR_SPACING, Math.floor((room - STAR_SIZE) / (STARS_PER_SET - 1)));
  const rowWidth = (STARS_PER_SET - 1) * spacing + STAR_SIZE;
  const firstX = EDGE_MARGIN + (room - rowWidth) / 2 + STAR_SIZE / 2;
  return Array.from({ length: starCount }, (_, index) => ({
    x: firstX + index * spacing,
    y: STAR_ROW_CENTER_Y,
  }));
}

// ---------------------------------------------------------------------------
// Postavička a příklad
// ---------------------------------------------------------------------------

interface MiddleRow {
  readonly sizes: ProblemAndMascot;
  readonly mascot: Point;
  readonly problem: Point;
  readonly width: number;
  readonly bottom: number;
}

/** Postavička vlevo od příkladu pod kolečkem; dvojice vodorovně uprostřed. */
function middleRow(free: FreeSize, sizes: ProblemAndMascot): MiddleRow {
  const mascotSpan = mascotWidth(sizes.mascotSize);
  const width = mascotSpan + MASCOT_PROBLEM_GAP + sizes.problem.width;
  const left = (free.width - width) / 2;
  const mascot = mascotCenterBelow(left + mascotSpan / 2, GEAR_BOTTOM + GEAR_GAP, sizes.mascotSize);
  const problem = { x: left + width - sizes.problem.width / 2, y: mascot.y };
  const bottom = Math.max(mascot.y + sizes.mascotSize / 2, problem.y + sizes.problem.height / 2);
  return { sizes, mascot, problem, width, bottom };
}

// ---------------------------------------------------------------------------
// Celé rozložení
// ---------------------------------------------------------------------------

interface Candidate {
  readonly plan: PortraitPlan;
  /** Vejde se do volné plochy (šířka i výška)? */
  readonly fits: boolean;
}

function innerWidth(free: FreeSize): number {
  return free.width - 2 * EDGE_MARGIN;
}

/** Vyhrazené místo pro nápovědu pod příkladem přes celou šířku. */
function hintRegionBelow(free: FreeSize, rowBottom: number, height: number): Region {
  const top = Math.ceil(rowBottom + PROBLEM_HINT_GAP);
  return { left: EDGE_MARGIN, right: free.width - EDGE_MARGIN, top, bottom: top + height };
}

/** Ovládání vodorovně uprostřed, spodní okraj 16 px nad spodním okrajem volné plochy. */
function placeControls(
  free: FreeSize,
  controls: Controls,
): Pick<PhonePlan, 'answerButtons' | 'writing'> {
  const left = (free.width - controls.width) / 2;
  const top = free.height - CONTROLS_BOTTOM_GAP - controls.height;
  return controls.place(left, top);
}

/** Všechna rozložení od největšího; `fits` říká, jestli se do plochy vejde. */
function* portraitCandidates(
  request: PhonePlanRequest,
  settings: PortraitLayoutSettings,
): Generator<Candidate> {
  const { free } = request;
  const inner = innerWidth(free);
  const stars = layoutPortraitStars(free, request.starCount);
  const allGroups = possibleHintGroups(settings);
  const hints = dotGridsFor(request).map((grid) => ({
    grid,
    size: reservedHintSize(allGroups, { cell: grid.cell, groupGap: HINT_GROUP_GAP }, inner),
  }));

  for (const sizes of problemAndMascotOptions(PORTRAIT_FONT_SIZES, settings.maxNumber, false)) {
    const row = middleRow(free, sizes);
    for (const { grid, size: hint } of hints) {
      const hintRegion = hintRegionBelow(free, row.bottom, hint.height);
      const controlsTop = hintRegion.bottom + HINT_CONTROLS_GAP;
      const available = free.height - CONTROLS_BOTTOM_GAP - controlsTop;
      for (const controls of portraitControlsOptions(
        settings.maxNumber,
        request.answerInput,
        available,
      )) {
        yield {
          plan: {
            ...planParts(stars, row, grid),
            hintRegion,
            ...placeControls(free, controls),
          },
          fits:
            row.width <= inner + FIT_TOLERANCE &&
            hint.width <= inner + FIT_TOLERANCE &&
            controls.width <= inner + FIT_TOLERANCE &&
            controls.height <= available + FIT_TOLERANCE,
        };
      }
    }
  }
}

function planParts(
  stars: readonly Point[],
  row: MiddleRow,
  grid: DotGrid,
): Omit<PortraitPlan, 'hintRegion' | 'answerButtons' | 'writing'> {
  return {
    stars,
    starSize: STAR_SIZE,
    mascot: row.mascot,
    mascotSize: row.sizes.mascotSize,
    problem: row.problem,
    problemFontSize: row.sizes.font,
    problemWidth: row.sizes.problem.width,
    problemHeight: row.sizes.problem.height,
    hintCell: grid.cell,
    hintDotSize: grid.dotSize,
    hintDotsCountable: grid.countable,
  };
}

/** Nouzové tečky nápovědy jen k dívání; rozměry jako nejmenší tečky ve hře (#54). */
const FALLBACK_DOT_GRID: DotGrid = {
  cell: 20,
  dotSize: 20,
  countable: false,
  groupGap: HINT_GROUP_GAP,
};

/** Nouzové rozložení: všechno co nejmenší, ovládání dole. */
function fallbackPlan(request: PhonePlanRequest, settings: PortraitLayoutSettings): PortraitPlan {
  const { free } = request;
  const sizes: ProblemAndMascot = {
    font: MIN_PORTRAIT_FONT_SIZE,
    problem: problemBox(MIN_PORTRAIT_FONT_SIZE, settings.maxNumber),
    mascotSize: MIN_MASCOT_SIZE,
  };
  const row = middleRow(free, sizes);
  const grid = FALLBACK_DOT_GRID;
  const hint = reservedHintSize(possibleHintGroups(settings), grid, innerWidth(free));
  return {
    ...planParts(layoutPortraitStars(free, request.starCount), row, grid),
    hintRegion: hintRegionBelow(free, row.bottom, hint.height),
    ...placeControls(free, smallestPortraitControls(settings.maxNumber, request.answerInput)),
  };
}

/**
 * Největší rozložení na výšku, ve kterém se všechno vejde.
 *
 * Kdyby se nevešlo žádné, použije se vědomě nouzové rozložení: hra se tak
 * zobrazí vždy a nespadne. Na oknech, která rozložení na výšku dostanou
 * (volná plocha od 360 × 620 px), se to nestane, hlídají to testy
 * v `tests/phonePortraitLayout.test.ts`.
 */
export function planPhonePortrait(
  request: PhonePlanRequest,
  settings: PortraitLayoutSettings,
): PortraitPlan {
  for (const candidate of portraitCandidates(request, settings)) {
    if (candidate.fits) {
      return candidate.plan;
    }
  }
  return fallbackPlan(request, settings);
}
