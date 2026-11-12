/**
 * Rozmístění zástupné mapy postupu (#87 AC7, #133 AC7) v herních
 * jednotkách: start, 2 zastávky a cíl na cestě, a kde stojí značka hráče.
 * Cesta vede rovnými úseky od místa k místu po řadě. Na šířku jde vlnovkou
 * zleva doprava, na výšku klikatě zdola nahoru, takže se nikde nekříží.
 * Každá mapa má vlnovku jinak natočenou (začíná dole, nebo nahoře).
 * Mapa leží pod rohem kolečka a domečku a mimo výřez a lištu. Za cílem
 * (na šířku vpravo, na výšku nad ním) stojí symbol tématu (#134 AC2).
 * Místa a značka se měří i s okrajem a poskočením po dojití, aby se ani
 * nakreslené nepřekrývaly a nevyčnívaly (kontrola #133). Vedle slavícího
 * cíle je místo pro klíč (#139), které nepřekryje cíl, místa ani značku.
 * Čistý TypeScript bez Phaseru; vzhled kreslí scéna a dá se vyměnit bez
 * změny tohoto rozložení i logiky mapy.
 */

import type { GameArea } from '../../../shared/logic/viewportLayout';
import { MAP_GOAL_CELEBRATION_SCALE } from './mapAnimation';
import { MAP_STEPS, MAP_THEMES } from './progressMap';
import type { MapThemeId } from './progressMap';
import { PROGRESS_MAP_SHAPE } from './theme';

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** Čtverec se středem `x`, `y` a stranou `size`. */
export interface MapSquare extends MapPoint {
  readonly size: number;
}

/** Obdélník se středem `x`, `y`, šířkou `width` a výškou `height`. */
export interface MapRect extends MapPoint {
  readonly width: number;
  readonly height: number;
}

export interface ProgressMapLayout {
  /** Střed místa podle kroku: 0 start, 1 a 2 zastávky, `MAP_STEPS` cíl. */
  readonly places: readonly MapPoint[];
  /** Průměr místa na mapě. */
  readonly placeSize: number;
  /** Průměr značky hráče. */
  readonly markerSize: number;
  /** Symbol tématu u cíle (#134 AC2) na světlém kruhovém podkladu, `size` je průměr podkladu. */
  readonly goalSymbol: MapSquare;
  /**
   * Kam se vejde celý slavící cíl (#135 AC3): podklad zvětšený 1,3× i se
   * zlatou září a prstencem, se středem ve středu symbolu cíle.
   */
  readonly goalCelebration: MapSquare;
  /**
   * Kam se u cíle vejde klíč (#139 AC2): vodorovný štítek s půlkou klíče,
   * nebo s oběma půlkami, které se k sobě přiblíží. Vedle slavícího cíle,
   * nepřekrývá ho, místa na cestě, značku v cíli ani okraj mapy.
   */
  readonly goalKey: MapRect;
}

/** Kolikrát se zastávka, cíl a značka po dojití značky krátce zvětší. */
export const MAP_ARRIVAL_PULSE_SCALE = 1.15;

/** Šířka čáry cesty jako díl průměru značky. */
export const MAP_PATH_WIDTH_SHARE = 0.18;

/** Kolikrát je nakreslená značka větší než její průměr: bílý okraj a poskočení. */
export const DRAWN_MARKER_SCALE =
  (1 + PROGRESS_MAP_SHAPE.markerBorderShare) * MAP_ARRIVAL_PULSE_SCALE;

/** Pás nahoře pro kolečko a domeček v CSS px (roh 88 px, iPad 12 + 76 px a stavový řádek). */
const CORNER_BAND_CSS = 100;

/** Odstup mapy od okrajů viditelné plochy v CSS px. */
const EDGE_MARGIN_CSS = 16;

/** Štítek klíče: výška jako díl průměru značky, poměr šířky k výšce a nejmenší výška v CSS px. */
const GOAL_KEY_HEIGHT_TO_MARKER = 0.62;
const GOAL_KEY_ASPECT = 2.4;
const GOAL_KEY_MIN_HEIGHT_CSS = 36;

/** Mezera mezi štítkem klíče a slavícím cílem nebo místem na cestě v CSS px. */
const GOAL_KEY_GAP_CSS = 8;

/** O kolik se štítek klíče zmenší, když se nikam nevejde. */
const GOAL_KEY_SHRINK = 0.92;

/** Rozestup mřížky v CSS px, ve které se hledá místo pro štítek, když se nevejde vedle cíle. */
const GOAL_KEY_SEARCH_STEP_CSS = 6;

/** Jak daleko od slavícího cíle v CSS px štítek klíče ještě stojí „u cíle“. */
const GOAL_KEY_NEAR_CSS = 40;

/** Jak málo rozhoduje vzdálenost od značky proti vzdálenosti od cíle (jen při shodě). */
const GOAL_KEY_MARKER_TIEBREAK = 0.001;

/** Na výšku leží místa střídavě v levém a pravém sloupci. */
const PORTRAIT_COLUMNS = 2;

/** Největší značka v CSS px, aby mapa se 4 místy nevypadala přerostle. */
const MAX_MARKER_CSS = 150;

/** Značka zabere nejvýš tento díl místa mezi zastávkami, aby nezakryla sousední. */
const MARKER_SHARE = 0.75;

/** Místo je menší než značka, aby značka stojící na něm byla dobře vidět. */
const PLACE_TO_MARKER = 0.7;

/** Plocha mapy v herních jednotkách: levý horní roh, šířka a výška. */
export interface ContentBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Plocha pro mapu: bez pásu kolečka a domečku, výřezu, lišty a s odstupem
 * od okraje. Drží se jí i pohyby prostředí (#136).
 */
export function mapContentBox(area: GameArea): ContentBox {
  const covered = area.coveredEdges ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const margin = EDGE_MARGIN_CSS / area.scale;
  const left = covered.left + margin;
  const top = covered.top + CORNER_BAND_CSS / area.scale;
  const right = area.width - covered.right - margin;
  const bottom = area.height - covered.bottom - margin;
  return { left, top, width: right - left, height: bottom - top };
}

/** Začíná cesta této mapy vlnou dolů (na výšku vlevo)? Mapy se střídají. */
function startsLow(theme: MapThemeId): boolean {
  return MAP_THEMES.indexOf(theme) % 2 === 0;
}

/** Míst na cestě (start, zastávky, cíl) a za nimi jedno místo pro symbol cíle. */
const PLACE_COUNT = MAP_STEPS + 1;
const SLOT_COUNT = PLACE_COUNT + 1;

/**
 * Střed symbolu cíle měřený v rozestupech míst od začátku řady (na výšku
 * v řadách odspodu): stojí v posledním, pátém místě za cílem, tedy
 * o půl rozestupu dál než poslední hrana míst.
 */
const GOAL_SYMBOL_SLOT = PLACE_COUNT + 0.5;

/**
 * Na šířku: všechna místa v jedné řadě zleva doprava, střídavě výš a níž,
 * symbol cíle vpravo vedle cíle ve stejné výšce.
 */
function wavyRow(
  content: ContentBox,
  maxMarker: number,
  theme: MapThemeId,
  scale: number,
): ProgressMapLayout {
  const spacing = rowSpacing(content, maxMarker);
  const markerSize = rowMarkerSize(content, maxMarker, spacing);
  const amplitude = Math.min(
    (content.height - markerSize * DRAWN_MARKER_SCALE) / 2,
    markerSize * 0.8,
  );
  const middle = content.top + content.height / 2;
  const firstLow = startsLow(theme);
  const places = Array.from({ length: PLACE_COUNT }, (_, index) => {
    const low = index % 2 === 0 ? firstLow : !firstLow;
    return {
      x: content.left + spacing * (index + 0.5),
      y: middle + (low ? amplitude : -amplitude),
    };
  });
  const goal = lastPlace(places);
  return withGoal(content, places, markerSize, { x: goal.x + spacing, y: goal.y }, scale);
}

function rowMarkerSize(content: ContentBox, maxMarker: number, spacing: number): number {
  return Math.min(spacing * MARKER_SHARE, content.height / 2 / DRAWN_MARKER_SCALE, maxMarker);
}

/**
 * Rozestup míst v řadě. Symbol cíle stojí o rozestup za cílem; když by se
 * slavící cíl (#135) za ním nevešel, řada se zhustí, aby se symbol nemusel
 * posunout až k cíli.
 */
function rowSpacing(content: ContentBox, maxMarker: number): number {
  const even = content.width / SLOT_COUNT;
  const half = goalCelebrationSize(goalBadgeSize(rowMarkerSize(content, maxMarker, even))) / 2;
  if (GOAL_SYMBOL_SLOT * even + half <= content.width) {
    return even;
  }
  return (content.width - half) / GOAL_SYMBOL_SLOT;
}

/** Na výšku: místa zdola nahoru, střídavě vlevo a vpravo, symbol cíle nad cílem. */
function zigzagUp(
  content: ContentBox,
  maxMarker: number,
  theme: MapThemeId,
  scale: number,
): ProgressMapLayout {
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const cellHeight = columnCellHeight(content, maxMarker);
  const markerSize = columnMarkerSize(cellWidth, cellHeight, maxMarker);
  const firstColumn = startsLow(theme) ? 0 : 1;
  const places = Array.from({ length: PLACE_COUNT }, (_, index) => {
    const column = index % 2 === 0 ? firstColumn : 1 - firstColumn;
    return {
      x: content.left + cellWidth * (column + 0.5),
      // Řady se počítají odspodu: start dole, cíl nahoře.
      y: content.top + content.height - cellHeight * (index + 0.5),
    };
  });
  const goal = lastPlace(places);
  return withGoal(content, places, markerSize, { x: goal.x, y: goal.y - cellHeight }, scale);
}

/**
 * Rozložení se symbolem cíle na místě `wanted`. Symbol se posune dovnitř
 * tak, aby se slavící cíl i se září vešel celý do plochy mapy (#135 AC3).
 */
function withGoal(
  content: ContentBox,
  places: readonly MapPoint[],
  markerSize: number,
  wanted: MapPoint,
  scale: number,
): ProgressMapLayout {
  const size = goalBadgeSize(markerSize);
  const celebrationSize = goalCelebrationSize(size);
  const half = celebrationSize / 2;
  const center = {
    x: clampInto(wanted.x, content.left + half, content.left + content.width - half),
    y: clampInto(wanted.y, content.top + half, content.top + content.height - half),
  };
  const placeSize = markerSize * PLACE_TO_MARKER;
  const goalCelebration = { ...center, size: celebrationSize };
  const keySpace: GoalKeySpace = {
    content,
    goal: goalCelebration,
    goalPlace: lastPlace(places),
    obstacles: [
      squareRect(goalCelebration),
      ...places.map((place, step) =>
        squareRect({ ...place, size: drawnPlaceSize(step, placeSize, markerSize) }),
      ),
    ],
    path: places.slice(1).map((place, index) => [places[index] ?? place, place] as const),
    pathClearance: (markerSize * MAP_PATH_WIDTH_SHARE) / 2 + GOAL_KEY_GAP_CSS / scale,
    gap: GOAL_KEY_GAP_CSS / scale,
    searchStep: GOAL_KEY_SEARCH_STEP_CSS / scale,
    nearGap: GOAL_KEY_NEAR_CSS / scale,
  };
  return {
    places,
    placeSize,
    markerSize,
    goalSymbol: { ...center, size },
    goalCelebration,
    goalKey: placeGoalKey(
      keySpace,
      markerSize * GOAL_KEY_HEIGHT_TO_MARKER,
      GOAL_KEY_MIN_HEIGHT_CSS / scale,
    ),
  };
}

/** Kolik zabere nakreslené místo: cíl i se značkou, která v něm stojí, ostatní s okrajem. */
function drawnPlaceSize(step: number, placeSize: number, markerSize: number): number {
  return step === MAP_STEPS
    ? markerSize * DRAWN_MARKER_SCALE
    : placeSize * (1 + PROGRESS_MAP_SHAPE.goalBorderShare) * MAP_ARRIVAL_PULSE_SCALE;
}

function squareRect(square: MapSquare): MapRect {
  return { x: square.x, y: square.y, width: square.size, height: square.size };
}

/** Překrývají se obdélníky, i s mezerou `gap` kolem? */
function rectsOverlap(first: MapRect, second: MapRect, gap: number): boolean {
  return (
    Math.abs(first.x - second.x) < (first.width + second.width) / 2 + gap &&
    Math.abs(first.y - second.y) < (first.height + second.height) / 2 + gap
  );
}

function isRectInside(rect: MapRect, content: ContentBox): boolean {
  return (
    rect.x - rect.width / 2 >= content.left &&
    rect.x + rect.width / 2 <= content.left + content.width &&
    rect.y - rect.height / 2 >= content.top &&
    rect.y + rect.height / 2 <= content.top + content.height
  );
}

/** Kde smí stát štítek klíče: plocha mapy, slavící cíl, čemu se vyhnout a mezera. */
interface GoalKeySpace {
  readonly content: ContentBox;
  readonly goal: MapSquare;
  /** Cíl na cestě, kde stojí značka. */
  readonly goalPlace: MapPoint;
  /** Slavící cíl a všechna nakreslená místa na cestě. */
  readonly obstacles: readonly MapRect[];
  /** Úseky cesty mezi místy; štítek od nich drží `pathClearance`. */
  readonly path: readonly (readonly [MapPoint, MapPoint])[];
  /** Nejmenší vzdálenost štítku od osy cesty: půl čáry a mezera. */
  readonly pathClearance: number;
  readonly gap: number;
  /** Rozestup mřížky, ve které se hledá místo pro štítek. */
  readonly searchStep: number;
  /** Jak daleko od slavícího cíle je štítek ještě „u cíle“. */
  readonly nearGap: number;
}

/**
 * Kam se dá štítek klíče výšky `height` postavit: těsně pod, nad, vlevo
 * a vpravo od slavícího cíle a navíc v mřížce po `GOAL_KEY_SEARCH_STEP_CSS`
 * přes celou plochu mapy (na malých oknech se vedle cíle nevejde).
 */
function goalKeyCandidates(space: GoalKeySpace, height: number): MapRect[] {
  const { content, goal, gap } = space;
  const width = height * GOAL_KEY_ASPECT;
  const reachX = goal.size / 2 + gap + width / 2;
  const reachY = goal.size / 2 + gap + height / 2;
  const minX = content.left + width / 2;
  const maxX = content.left + content.width - width / 2;
  const minY = content.top + height / 2;
  const maxY = content.top + content.height - height / 2;
  const alongX = clampInto(goal.x, minX, maxX);
  const alongY = clampInto(goal.y, minY, maxY);
  const candidates: MapRect[] = [
    { x: alongX, y: goal.y + reachY, width, height },
    { x: alongX, y: goal.y - reachY, width, height },
    { x: goal.x - reachX, y: alongY, width, height },
    { x: goal.x + reachX, y: alongY, width, height },
  ];
  for (let y = minY; y <= maxY; y += space.searchStep) {
    for (let x = minX; x <= maxX; x += space.searchStep) {
      candidates.push({ x, y, width, height });
    }
  }
  return candidates;
}

/**
 * Místo pro štítek klíče u slavícího cíle (#139 AC2): nejdřív jen místa
 * u cíle (nejvýš `nearGap` od slavícího cíle), co největší, ale nejvýš
 * `maxHeight`, a z nich to nejblíž cíli (při shodě dál od značky v cíli).
 * Teprve když se u cíle nevejde ani nejmenší (`minHeight`), hledá se
 * kdekoli na mapě; když ani tam, stojí pod cílem.
 */
function placeGoalKey(space: GoalKeySpace, maxHeight: number, minHeight: number): MapRect {
  const goalRect = squareRect(space.goal);
  const isNearGoal = (rect: MapRect): boolean => rectDistance(rect, goalRect) <= space.nearGap;
  return (
    largestFitting(space, maxHeight, minHeight, isNearGoal) ??
    largestFitting(space, maxHeight, minHeight, () => true) ??
    goalKeyCandidates(space, minHeight)[0] ?? {
      ...space.goalPlace,
      width: minHeight * GOAL_KEY_ASPECT,
      height: minHeight,
    }
  );
}

/** Největší štítek od `maxHeight` do `minHeight`, který se vejde a splní `allowed`. */
function largestFitting(
  space: GoalKeySpace,
  maxHeight: number,
  minHeight: number,
  allowed: (rect: MapRect) => boolean,
): MapRect | undefined {
  for (
    let height = Math.max(maxHeight, minHeight);
    height >= minHeight;
    height *= GOAL_KEY_SHRINK
  ) {
    const fitting = goalKeyCandidates(space, height).filter(
      (rect) =>
        allowed(rect) &&
        isRectInside(rect, space.content) &&
        space.obstacles.every((other) => !rectsOverlap(rect, other, space.gap)) &&
        space.path.every(
          ([from, to]) => segmentRectDistance(from, to, rect) >= space.pathClearance,
        ),
    );
    const nearest = nearestToGoal(fitting, space);
    if (nearest !== undefined) {
      return nearest;
    }
  }
  return undefined;
}

/** Vzdálenost bodu od obdélníku (0 uvnitř). */
function pointRectDistance(point: MapPoint, rect: MapRect): number {
  const dx = Math.max(Math.abs(point.x - rect.x) - rect.width / 2, 0);
  const dy = Math.max(Math.abs(point.y - rect.y) - rect.height / 2, 0);
  return Math.hypot(dx, dy);
}

/** Vzdálenost bodu od úsečky `from`–`to`. */
function pointSegmentDistance(point: MapPoint, from: MapPoint, to: MapPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const share =
    lengthSquared === 0
      ? 0
      : clampInto(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (from.x + dx * share), point.y - (from.y + dy * share));
}

/**
 * Vzdálenost úsečky od obdélníku. Úsečka, která obdélníkem prochází, má
 * vzdálenost 0; jinak je nejbližší bod buď konec úsečky, nebo roh obdélníku.
 */
function segmentRectDistance(from: MapPoint, to: MapPoint, rect: MapRect): number {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const corners: MapPoint[] = [
    { x: rect.x - halfWidth, y: rect.y - halfHeight },
    { x: rect.x + halfWidth, y: rect.y - halfHeight },
    { x: rect.x + halfWidth, y: rect.y + halfHeight },
    { x: rect.x - halfWidth, y: rect.y + halfHeight },
  ];
  const crossesEdge = corners.some((corner, index) =>
    segmentsCross(from, to, corner, corners[(index + 1) % corners.length] ?? corner),
  );
  if (crossesEdge || pointRectDistance(from, rect) === 0) {
    return 0;
  }
  return Math.min(
    pointRectDistance(from, rect),
    pointRectDistance(to, rect),
    ...corners.map((corner) => pointSegmentDistance(corner, from, to)),
  );
}

/** Kříží se úsečky `a1`–`a2` a `b1`–`b2`? */
function segmentsCross(a1: MapPoint, a2: MapPoint, b1: MapPoint, b2: MapPoint): boolean {
  const side = (p: MapPoint, q: MapPoint, r: MapPoint): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(b1, b2, a1);
  const d2 = side(b1, b2, a2);
  const d3 = side(a1, a2, b1);
  const d4 = side(a1, a2, b2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Vzdálenost mezi okraji obdélníků (0, když se dotýkají nebo překrývají). */
function rectDistance(first: MapRect, second: MapRect): number {
  const dx = Math.abs(first.x - second.x) - (first.width + second.width) / 2;
  const dy = Math.abs(first.y - second.y) - (first.height + second.height) / 2;
  return Math.max(dx, dy, 0);
}

/** Štítek nejblíž slavícímu cíli, při shodě nejdál od značky v cíli; `undefined`, když žádný není. */
function nearestToGoal(rects: readonly MapRect[], space: GoalKeySpace): MapRect | undefined {
  let best: MapRect | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const toGoal = Math.hypot(rect.x - space.goal.x, rect.y - space.goal.y);
    const toMarker = Math.hypot(rect.x - space.goalPlace.x, rect.y - space.goalPlace.y);
    // Vzdálenost od značky rozhoduje jen při (skoro) stejné vzdálenosti od cíle.
    const score = toGoal - toMarker * GOAL_KEY_MARKER_TIEBREAK;
    if (score < bestScore) {
      best = rect;
      bestScore = score;
    }
  }
  return best;
}

function columnMarkerSize(cellWidth: number, cellHeight: number, maxMarker: number): number {
  return Math.min(cellWidth * MARKER_SHARE, cellHeight * MARKER_SHARE, maxMarker);
}

/**
 * Výška řady na výšku. Symbol cíle stojí o řadu nad cílem; když by se
 * slavící cíl (#135) nad ním nevešel, řady se zhustí.
 */
function columnCellHeight(content: ContentBox, maxMarker: number): number {
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const even = content.height / SLOT_COUNT;
  const marker = columnMarkerSize(cellWidth, even, maxMarker);
  const half = goalCelebrationSize(goalBadgeSize(marker)) / 2;
  if (GOAL_SYMBOL_SLOT * even + half <= content.height) {
    return even;
  }
  return (content.height - half) / GOAL_SYMBOL_SLOT;
}

/** Průměr slavícího cíle i se září. */
function goalCelebrationSize(badgeSize: number): number {
  return badgeSize * MAP_GOAL_CELEBRATION_SCALE * (1 + PROGRESS_MAP_SHAPE.goalGlowShare);
}

/** `value` posunutá do rozmezí `min` až `max`; když se rozmezí nevejde, jeho střed. */
function clampInto(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.min(Math.max(value, min), max);
}

/** Průměr světlého podkladu symbolu cíle i s okrajem; symbol leží uvnitř. */
function goalBadgeSize(markerSize: number): number {
  return markerSize * PROGRESS_MAP_SHAPE.goalBadgeToMarker;
}

function lastPlace(places: readonly MapPoint[]): MapPoint {
  return places[places.length - 1] ?? { x: 0, y: 0 };
}

/** Rozložení mapy `theme`; orientace cesty se řídí tvarem herní plochy. */
export function layoutProgressMap(area: GameArea, theme: MapThemeId): ProgressMapLayout {
  const content = mapContentBox(area);
  const maxMarker = MAX_MARKER_CSS / area.scale;
  return area.width > area.height
    ? wavyRow(content, maxMarker, theme, area.scale)
    : zigzagUp(content, maxMarker, theme, area.scale);
}

/** Kde stojí značka na kroku `step` (mimo mapu se bere nejbližší konec). */
export function markerAt(layout: ProgressMapLayout, step: number): MapPoint {
  const last = layout.places.length - 1;
  const index = Math.min(Math.max(Math.round(step), 0), last);
  return layout.places[index] ?? { x: 0, y: 0 };
}
