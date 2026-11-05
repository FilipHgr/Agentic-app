/**
 * Telefon na šířku podle návrhu C (#68), v CSS px volné plochy (bez výřezu
 * a lišty, levý horní roh je 0, 0).
 *
 * Nahoře pás: vlevo domeček, vpravo kolečko, mezi nimi příklad s tečkami
 * nápovědy a u kolečka hvězdičky ve 2 řadách po 5. Dole číselník přes
 * celou šířku (do 5 jedna řada, do 10 jako 6 + 5, do 20 3 řady po 7)
 * se širokými tlačítky, nebo při psaní okénka se smazáním a ✓.
 *
 * Tečky jdou souvisle po pěti v řadě: druhé číslo pokračuje v řadě
 * prvního. Jsou vpravo vedle příkladu, a když se tam nevejdou, pod ním.
 * Jen když se nevejdou ani tak (do 20 s víc než 15 tečkami na nejnižších
 * telefonech), jsou v řadě dvě pětice vedle sebe s mezerou jako na iPadu.
 *
 * Velikosti se zkouší od největšího písma; použije se první rozložení,
 * které projde kontrolou (`phonePlanCheck.ts`). Čistý TypeScript.
 */

import { controlsOptions, wideKeypadControls } from './phoneControls';
import type { Controls } from './phoneControls';
import { basePlan, dotGridsFor, problemOptions } from './phoneElements';
import type { DotGrid, ProblemSizes } from './phoneElements';
import { DOTS_PER_ROW, visibleGroups } from './phoneHint';
import {
  EDGE_MARGIN,
  FONT_SIZES,
  GEAR_CORNER_GAP,
  GEAR_CORNER_SIZE,
  MIN_GAP_BOTTOM,
  PROBLEM_HINT_GAP,
  STAR_SIZE,
} from './phonePlan';
import type { FreeSize, PhonePlan, PhonePlanRequest } from './phonePlan';
import { isValidPlan } from './phonePlanCheck';
import type { HintDot, Point } from './screenLayout';
import { STARS_PER_SET } from './stars';

// ---------------------------------------------------------------------------
// Horní pás
// ---------------------------------------------------------------------------

/** Hvězdičky 2 × 5 u kolečka (obrázek C): 24 px, mezera 5 px, řady 14–38 a 43–67 px. */
const STARS_PER_ROW = 5;
const STAR_GAP = 5;
const STAR_SPACING = STAR_SIZE + STAR_GAP;
const STAR_ROW_TOPS = [14, 14 + STAR_SPACING];
const STARS_WIDTH = STARS_PER_ROW * STAR_SIZE + (STARS_PER_ROW - 1) * STAR_GAP;

/** Rohy domečku a kolečka i s odstupem. */
const CORNER_WITH_GAP = GEAR_CORNER_SIZE + GEAR_CORNER_GAP;

/** Odstup příkladu od rohu domečku a od hvězdiček. */
const PROBLEM_STARS_GAP = 6;

/** Svislý střed pásu je ve výšce středu domečku a kolečka (8 + 64 / 2). */
const BAND_CENTER_Y = 40;
const BAND_TOP = 4;

/** Tečky pod příkladem jsou od něj kousek odsazené (obrázek C). */
const PROBLEM_DOTS_BELOW_GAP = 6;

/** Mezera mezi pásem a ovládáním; mezi pětkami teček v nouzové dvojité řadě. */
const BAND_CONTROLS_GAP = 8;
const FIVES_GAP = 8;

/** Tolerance na zaokrouhlení při porovnání s velikostí místa. */
const FIT_TOLERANCE = 0.001;

/** Výšky tlačítek číselníku od největší. */
const KEYPAD_HEIGHTS = [80, 72, 64];

function starsLeft(free: FreeSize): number {
  return free.width - CORNER_WITH_GAP - STARS_WIDTH;
}

/** Hvězdičky 2 × 5 u kolečka; nejdřív se plní horní řada. */
function layoutBandStars(free: FreeSize, starCount: number): Point[] {
  const left = starsLeft(free);
  return Array.from({ length: Math.min(starCount, STARS_PER_SET) }, (_, index) => ({
    x: left + (index % STARS_PER_ROW) * STAR_SPACING + STAR_SIZE / 2,
    y: (STAR_ROW_TOPS[Math.floor(index / STARS_PER_ROW)] ?? 0) + STAR_SIZE / 2,
  }));
}

/** Místo pro příklad v pásu: mezi rohem domečku a hvězdičkami, z obou stran stejný odstup. */
function problemRegion(free: FreeSize): { left: number; right: number } {
  return {
    left: GEAR_CORNER_SIZE + PROBLEM_STARS_GAP,
    right: starsLeft(free) - PROBLEM_STARS_GAP,
  };
}

// ---------------------------------------------------------------------------
// Tečky nápovědy souvisle po pěti v řadě
// ---------------------------------------------------------------------------

/** Tečky v řadě: po pěti, nebo v nouzi dvě pětice vedle sebe. */
type DotRow = 5 | 10;

interface DotBlock {
  readonly groups: readonly number[];
  readonly grid: DotGrid;
  readonly perRow: DotRow;
  readonly width: number;
  readonly height: number;
}

function columnOffset(column: number, cell: number): number {
  return column * cell + (column >= DOTS_PER_ROW ? FIVES_GAP : 0);
}

function dotBlock(groups: readonly number[], grid: DotGrid, perRow: DotRow): DotBlock {
  const total = groups.reduce((sum, count) => sum + count, 0);
  const columns = Math.min(total, perRow);
  return {
    groups,
    grid,
    perRow,
    width: columns > 0 ? columnOffset(columns - 1, grid.cell) + grid.cell : 0,
    height: Math.ceil(total / perRow) * grid.cell,
  };
}

/** Tečky všech skupinek za sebou od levého horního rohu; druhá skupinka pokračuje v řadě první. */
function placeDots(block: DotBlock, left: number, top: number): HintDot[] {
  // Celé px: sousední buňky se pak potkají přesně a nepřekryjí se ani o zaokrouhlení.
  const originX = Math.ceil(left);
  const originY = Math.ceil(top);
  const { cell } = block.grid;
  const dots: HintDot[] = [];
  block.groups.forEach((count, group) => {
    for (let dot = 0; dot < count; dot += 1) {
      const index = dots.length;
      dots.push({
        x: originX + columnOffset(index % block.perRow, cell) + cell / 2,
        y: originY + Math.floor(index / block.perRow) * cell + cell / 2,
        group,
      });
    }
  });
  return dots;
}

// ---------------------------------------------------------------------------
// Příklad a tečky v pásu
// ---------------------------------------------------------------------------

interface BandPlacement {
  readonly problem: Point;
  readonly hintDots: HintDot[];
  /** Spodní okraj všeho v pásu (i ploch teček pro prst). */
  readonly bottom: number;
}

/** Vejde se šířka `width` do místa pro příklad? */
function fitsRegion(free: FreeSize, width: number): boolean {
  const region = problemRegion(free);
  return width <= region.right - region.left + FIT_TOLERANCE;
}

function bandWithoutHint(free: FreeSize, sizes: ProblemSizes): BandPlacement | null {
  if (!fitsRegion(free, sizes.problem.width)) {
    return null;
  }
  const region = problemRegion(free);
  const top = Math.max(BAND_TOP, BAND_CENTER_Y - sizes.problem.height / 2);
  return {
    problem: { x: (region.left + region.right) / 2, y: top + sizes.problem.height / 2 },
    hintDots: [],
    bottom: top + sizes.problem.height,
  };
}

/** Příklad a tečky vedle sebe, dvojice vodorovně uprostřed místa pro příklad. */
function bandBeside(free: FreeSize, sizes: ProblemSizes, block: DotBlock): BandPlacement | null {
  const region = problemRegion(free);
  const pairWidth = sizes.problem.width + PROBLEM_HINT_GAP + block.width;
  if (!fitsRegion(free, pairWidth)) {
    return null;
  }
  const pairHeight = Math.max(sizes.problem.height, block.height);
  const left = (region.left + region.right - pairWidth) / 2;
  const top = Math.max(BAND_TOP, BAND_CENTER_Y - pairHeight / 2);
  const centerY = top + pairHeight / 2;
  return {
    problem: { x: left + sizes.problem.width / 2, y: centerY },
    hintDots: placeDots(
      block,
      left + sizes.problem.width + PROBLEM_HINT_GAP,
      centerY - block.height / 2,
    ),
    bottom: top + pairHeight + 1,
  };
}

/**
 * Tečky pod příkladem, obojí vodorovně uprostřed místa pro příklad.
 * Příklad je svisle ve středu pásu, nebo (když je pod ním málo místa)
 * u horního okraje (`atTop`).
 */
function bandBelow(
  free: FreeSize,
  sizes: ProblemSizes,
  block: DotBlock,
  atTop: boolean,
): BandPlacement | null {
  if (!fitsRegion(free, Math.max(sizes.problem.width, block.width))) {
    return null;
  }
  const region = problemRegion(free);
  const centerX = (region.left + region.right) / 2;
  const centered = Math.max(BAND_TOP, BAND_CENTER_Y - sizes.problem.height / 2);
  const top = atTop ? BAND_TOP : centered;
  const dotsTop = top + sizes.problem.height + PROBLEM_DOTS_BELOW_GAP;
  return {
    problem: { x: centerX, y: top + sizes.problem.height / 2 },
    hintDots: placeDots(block, centerX - block.width / 2, dotsTop),
    bottom: dotsTop + block.height + 1,
  };
}

interface BandOption {
  readonly sizes: ProblemSizes;
  readonly grid: DotGrid | null;
  readonly band: BandPlacement;
}

/**
 * Pás pro jedno písmo: bez nápovědy jedna možnost, s ní všechny mřížky
 * a místa teček (vedle příkladu, pod ním) s `perRow` tečkami v řadě.
 */
function bandOptions(request: PhonePlanRequest, sizes: ProblemSizes, perRow: DotRow): BandOption[] {
  const { free } = request;
  const groups = visibleGroups(request.hintGroups);
  const options: BandOption[] = [];
  const add = (grid: DotGrid | null, band: BandPlacement | null): void => {
    if (band) {
      options.push({ sizes, grid, band });
    }
  };
  if (groups.length === 0) {
    add(null, bandWithoutHint(free, sizes));
    return options;
  }
  for (const grid of dotGridsFor(request)) {
    const block = dotBlock(groups, grid, perRow);
    add(grid, bandBeside(free, sizes, block));
    add(grid, bandBelow(free, sizes, block, false));
    add(grid, bandBelow(free, sizes, block, true));
  }
  return options;
}

// ---------------------------------------------------------------------------
// Ovládání dole
// ---------------------------------------------------------------------------

/** Řad po kolika má číselník: do 5 jedna řada, do 10 6 + 5, do 20 po 7. */
function keypadRowLength(maxNumber: number): number {
  return maxNumber === 20 ? 7 : 6;
}

/**
 * Možné číselníky od největšího: přes celou šířku, nebo jen mezi rohy
 * domečku a kolečka (když by jinak sahal do rohů), tlačítka 80 až 64 px vysoká.
 */
function keypadOptions(request: PhonePlanRequest): Controls[] {
  const { free, maxNumber } = request;
  const widths = [free.width - 2 * EDGE_MARGIN, free.width - 2 * CORNER_WITH_GAP];
  return KEYPAD_HEIGHTS.flatMap((height) =>
    widths.map((width) =>
      wideKeypadControls(maxNumber + 1, keypadRowLength(maxNumber), width, height),
    ),
  );
}

function controlsFor(request: PhonePlanRequest): Controls[] {
  return request.answerInput === 'keypad' ? keypadOptions(request) : controlsOptions(request);
}

/** Ovládání vodorovně uprostřed u spodního okraje; `null`, když se pod pás nevejde. */
function placeControls(
  free: FreeSize,
  controls: Controls,
  bandBottom: number,
): Pick<PhonePlan, 'answerButtons' | 'writing'> | null {
  const top = free.height - MIN_GAP_BOTTOM - controls.height;
  if (top < bandBottom + BAND_CONTROLS_GAP) {
    return null;
  }
  return controls.place((free.width - controls.width) / 2, top);
}

// ---------------------------------------------------------------------------
// Celé rozložení
// ---------------------------------------------------------------------------

function planFor(
  request: PhonePlanRequest,
  option: BandOption,
  controls: Controls,
): PhonePlan | null {
  const placed = placeControls(request.free, controls, option.band.bottom);
  if (!placed) {
    return null;
  }
  return {
    ...basePlan(request, option.sizes, option.grid),
    stars: layoutBandStars(request.free, request.starCount),
    problem: option.band.problem,
    hintDots: option.band.hintDots,
    ...placed,
  };
}

/**
 * Kandidáti od největšího písma, v něm od největšího ovládání. Dvě pětice
 * teček v řadě přijdou na řadu, až když se po pěti nevejde žádné písmo.
 */
function* candidates(
  request: PhonePlanRequest,
  controlsList: readonly Controls[],
  rowOptions: readonly DotRow[] = request.hintGroups.length > 0 ? [5, 10] : [5],
  fonts: readonly number[] = FONT_SIZES,
): Generator<PhonePlan> {
  for (const perRow of rowOptions) {
    for (const sizes of problemOptions(fonts, request.maxNumber)) {
      for (const controls of controlsList) {
        for (const option of bandOptions(request, sizes, perRow)) {
          const plan = planFor(request, option, controls);
          if (plan) {
            yield plan;
          }
        }
      }
    }
  }
}

function firstValid(
  request: PhonePlanRequest,
  controlsList: readonly Controls[],
  rowOptions?: readonly DotRow[],
  fonts?: readonly number[],
): PhonePlan | null {
  for (const plan of candidates(request, controlsList, rowOptions, fonts)) {
    if (isValidPlan(plan, request.free)) {
      return plan;
    }
  }
  return null;
}

/**
 * Písmo, které má při psaní zůstat i s nejvyšší nápovědou (obrázek C):
 * okénka se kvůli tomu raději zmenší (nejvýš na minima z #54).
 */
const WRITING_FONTS_WITH_HINT = [FONT_SIZES.filter((font) => font >= 48), FONT_SIZES];

/** Vybraná okénka podle okna a rozsahu; rozložení se počítá často, výběr je pořád stejný. */
const writingControlsCache = new Map<string, Controls | null>();

/**
 * Okénka na psaní: největší, se kterými se vejde příklad bez nápovědy
 * i s nejvyšší nápovědou v rozsahu (po pěti v řadě, písmo aspoň 48 px,
 * když to jde). S nápovědou se pak okénka nemění (nepřeskočí).
 */
function writingControls(request: PhonePlanRequest): Controls | null {
  const key = `${request.free.width}×${request.free.height}|${request.maxNumber}`;
  const cached = writingControlsCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const withoutHint = { ...request, hintGroups: [] };
  const highestHint = { ...request, hintGroups: [request.maxNumber] };
  const all = controlsFor(request);
  let chosen: Controls | null = null;
  for (const fonts of WRITING_FONTS_WITH_HINT) {
    chosen =
      all.find(
        (controls) =>
          firstValid(withoutHint, [controls]) !== null &&
          firstValid(highestHint, [controls], [5], fonts) !== null,
      ) ?? null;
    if (chosen) {
      break;
    }
  }
  chosen ??= all.find((controls) => firstValid(withoutHint, [controls]) !== null) ?? null;
  writingControlsCache.set(key, chosen);
  return chosen;
}

/**
 * Největší rozložení C, ve kterém se všechno vejde; `null`, když žádné.
 * Při psaní zůstanou okénka s nápovědou stejná jako bez ní (nepřeskočí),
 * číselník se kvůli nápovědě smí zmenšit až na 64 px.
 */
export function planBandScreen(request: PhonePlanRequest): PhonePlan | null {
  if (request.answerInput === 'writing') {
    const controls = writingControls(request);
    const fixed = controls ? firstValid(request, [controls]) : null;
    if (fixed) {
      return fixed;
    }
  }
  return firstValid(request, controlsFor(request));
}
