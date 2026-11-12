/**
 * Pohyby prostředí na mapě postupu (#136): na každé z 5 map se jemně hýbou
 * 2 druhy kousků podle tématu (vlny a racek u ostrova, listí a motýl
 * v lese, vlajky a mráčky u hradu, bublinky a rybky v podmoří, hvězdy
 * a kometa ve vesmíru). Rozložení dá každému kousku plochu, kterou při
 * pohybu projde i se svou velikostí, tak, aby nepřekryla místa, značku,
 * cestu (širokou jako značka), slavící cíl ani nic mimo plochu mapy
 * (roh kolečka a domečku, výřez, lištu). Listí a bublinky mají svislý pruh.
 * Kde kousek v čase je, plyne jen z času od ukázání mapy
 * (`mapSceneryMotion.ts`), takže po otočení pokračuje ze stejného
 * okamžiku. Nezávisí na kroku značky ani na tom, jestli se stáhl obrázek
 * mapy (AC4). Čistý TypeScript bez Phaseru, kreslí scéna.
 */

import type { GameArea } from '../../../shared/logic/viewportLayout';
import { SCENERY_MOTION_BOUNDS, sceneryMotionAt } from './mapSceneryMotion';
import type { SceneryKind, SceneryMotionBounds } from './mapSceneryMotion';
import type { MapThemeId } from './progressMap';
import { DRAWN_MARKER_SCALE, layoutProgressMap, mapContentBox } from './progressMapLayout';
import type { ContentBox, MapPoint, ProgressMapLayout } from './progressMapLayout';

export type { SceneryKind } from './mapSceneryMotion';

/** Druhy pohybu každé mapy (AC1); žádný druh není na dvou mapách. */
export const MAP_SCENERY_KINDS: Readonly<Record<MapThemeId, readonly SceneryKind[]>> = {
  island: ['waves', 'gull'],
  forest: ['fallingLeaves', 'butterfly'],
  castle: ['flag', 'cloud'],
  underwater: ['bubbles', 'fish'],
  space: ['stars', 'comet'],
};

/** Nejvýš tolik kousků jednoho druhu (AC1). */
export const MAX_SCENERY_PIECES_PER_KIND = 6;

/** Obdélník v herních jednotkách. */
export interface SceneryBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface SceneryPiece {
  readonly kind: SceneryKind;
  /** Pořadí kousku v jeho druhu (určuje tempo a fázi pohybu). */
  readonly index: number;
  /** Celá plocha, kterou kousek během pohybu projde i se svou velikostí. */
  readonly sweep: SceneryBox;
  /**
   * Vymezený svislý pruh, kudy kousek padá nebo stoupá (jen listí
   * a bublinky). Je to celá plocha pohybu, kousek z něj nikdy nevyjde.
   */
  readonly lane?: SceneryBox;
  /** Výchozí bod pohybu, od kterého se posun počítá. */
  readonly origin: MapPoint;
  /** Herní jednotky na jednotku velikosti kousku (šířka kousku je `width × sizeUnit`). */
  readonly sizeUnit: number;
  /** Herní jednotky na jednotku posunu. */
  readonly travelUnit: number;
}

export interface MapScenery {
  readonly pieces: readonly SceneryPiece[];
}

export interface SceneryPose {
  /** Střed kousku. */
  readonly x: number;
  readonly y: number;
  /** Obdélník, který kousek právě zabírá (i s otočením a zvětšením). */
  readonly width: number;
  readonly height: number;
  /** Průhlednost 0–1. */
  readonly alpha: number;
  /** Natočení ve stupních. */
  readonly angle: number;
  /** Zvětšení kreslení kousku; záporné `scaleX` je zrcadlově. */
  readonly scaleX: number;
  readonly scaleY: number;
}

/** Kolik kousků každého druhu: stejně v každém okně, aby po otočení pokračovaly všechny. */
const PIECE_COUNTS: Readonly<Record<SceneryKind, number>> = {
  waves: 3,
  gull: 2,
  fallingLeaves: 4,
  butterfly: 2,
  flag: 2,
  cloud: 2,
  bubbles: 5,
  fish: 2,
  stars: 6,
  comet: 1,
};

/**
 * Kam by kousek nejradši šel, díl plochy mapy zleva a shora: tam, kde
 * to na obrázku mapy dává smysl (vlny u kraje na vodě, mráčky a racek
 * nahoře, listí u stromů na krajích, bublinky od korálů na krajích).
 */
const WISHED_PLACES: Readonly<Record<SceneryKind, ReadonlyArray<readonly [number, number]>>> = {
  waves: [
    [0.02, 0.7],
    [0.2, 1],
    [0.98, 0.95],
  ],
  gull: [
    [0.3, 0],
    [0.85, 0.1],
  ],
  fallingLeaves: [
    [0, 0.3],
    [1, 0.25],
    [0.08, 0.9],
    [0.92, 0.8],
  ],
  butterfly: [
    [0.45, 1],
    [0.6, 0],
  ],
  flag: [
    [0.97, 0],
    [0.03, 0],
  ],
  cloud: [
    [0.3, 0],
    [0.7, 0],
  ],
  bubbles: [
    [0, 0.6],
    [1, 0.55],
    [0.12, 1],
    [0.88, 1],
    [0.5, 1],
  ],
  fish: [
    [0.5, 0],
    [0.3, 1],
  ],
  stars: [
    [0.47, 0.25],
    [0.38, 0.02],
    [0.62, 0.98],
    [0.97, 0.5],
    [0.2, 0.65],
    [0.82, 0.12],
  ],
  comet: [[0.65, 0]],
};

/**
 * Jaký horní díl plochy mapy je „nahoře“: mráčky jsou jen tam (nad cestou,
 * nikdy dole na trávě), vlaječky tam jdou nejradši (u obzoru).
 */
export const SCENERY_TOP_SHARE = 0.4;

/** Kde smí kousek být: jen nahoře, nejdřív nahoře a pak kdekoli, nebo kdekoli. */
type SceneryRegion = 'top' | 'anywhere';

const REGIONS: Readonly<Partial<Record<SceneryKind, readonly SceneryRegion[]>>> = {
  cloud: ['top'],
  flag: ['top', 'anywhere'],
};

/** Druhy, jejichž dráhy se smí překrývat navzájem (mráčky plují přes sebe). */
const OWN_OVERLAP_KINDS: ReadonlySet<SceneryKind> = new Set<SceneryKind>(['cloud']);

/** Druhy s vymezeným svislým pruhem (AC2). */
const LANE_KINDS: ReadonlySet<SceneryKind> = new Set<SceneryKind>(['fallingLeaves', 'bubbles']);

/**
 * Když se kousek s plným pohybem nevejde, zkusí se kratší pohyb a pak
 * menší kousek: díl velikosti a díl pohybu.
 */
const FIT_STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 0.75],
  [1, 0.5],
  [0.85, 0.4],
  [0.85, 0.25],
  [0.7, 0.2],
  [0.55, 0.15],
  [0.45, 0.1],
  [0.35, 0.07],
  [0.25, 0.05],
];

/** Od kolikátého kroku se kousek smí překrýt s jiným kouskem, když jinak není místo. */
const OVERLAP_ALLOWED_FROM_STEP = 3;

/** Krok mřížky, po které se hledá místo, jako díl průměru značky. */
const SEARCH_STEP_SHARE = 0.12;

/** Odstup kousků od míst, cesty, cíle a od sebe v CSS px. */
const GAP_CSS = 6;

/** Odstup od míst navíc jako díl průměru značky: značka po zastavení poskočí. */
const PLACE_GAP_SHARE = 0.12;

interface Obstacles {
  readonly content: ContentBox;
  readonly squares: readonly SceneryBox[];
  readonly path: ReadonlyArray<readonly [MapPoint, MapPoint]>;
  /** Kolik musí plocha kousku zůstat od osy cesty. */
  readonly pathClearance: number;
  readonly gap: number;
}

function square(center: MapPoint, size: number): SceneryBox {
  return {
    left: center.x - size / 2,
    right: center.x + size / 2,
    top: center.y - size / 2,
    bottom: center.y + size / 2,
  };
}

function obstaclesOf(area: GameArea, map: ProgressMapLayout): Obstacles {
  const gap = GAP_CSS / (area.scale > 0 ? area.scale : 1);
  const drawnMarker = map.markerSize * DRAWN_MARKER_SCALE;
  const placeSize = drawnMarker + 2 * (gap + map.markerSize * PLACE_GAP_SHARE);
  const { goalCelebration } = map;
  const path = map.places.slice(1).map((place, index): readonly [MapPoint, MapPoint] => {
    const previous = map.places[index] ?? place;
    return [previous, place];
  });
  return {
    content: mapContentBox(area),
    squares: [
      ...map.places.map((place) => square(place, placeSize)),
      square(goalCelebration, goalCelebration.size + 2 * gap),
    ],
    path,
    pathClearance: drawnMarker / 2 + gap,
    gap,
  };
}

function overlaps(first: SceneryBox, second: SceneryBox): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

function grow(box: SceneryBox, by: number): SceneryBox {
  return { left: box.left - by, right: box.right + by, top: box.top - by, bottom: box.bottom + by };
}

function pointDistance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegment(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const length = pointDistance(a, b);
  if (length === 0) {
    return pointDistance(point, a);
  }
  const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length ** 2;
  const share = Math.min(Math.max(along, 0), 1);
  return pointDistance(point, { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share });
}

function pointToBox(point: MapPoint, box: SceneryBox): number {
  return Math.hypot(
    Math.max(box.left - point.x, 0, point.x - box.right),
    Math.max(box.top - point.y, 0, point.y - box.bottom),
  );
}

/** Protne úsek `a`–`b` obdélník? (Liangův–Barskyho ořez.) */
function segmentHitsBox(a: MapPoint, b: MapPoint, box: SceneryBox): boolean {
  let start = 0;
  let end = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sides: Array<readonly [number, number]> = [
    [-dx, a.x - box.left],
    [dx, box.right - a.x],
    [-dy, a.y - box.top],
    [dy, box.bottom - a.y],
  ];
  for (const [direction, room] of sides) {
    if (direction === 0) {
      if (room < 0) {
        return false;
      }
      continue;
    }
    const share = room / direction;
    if (direction < 0) {
      start = Math.max(start, share);
    } else {
      end = Math.min(end, share);
    }
    if (start > end) {
      return false;
    }
  }
  return true;
}

/** Nejmenší vzdálenost úseku od obdélníku (0, když do něj zasahuje). */
function segmentToBox(a: MapPoint, b: MapPoint, box: SceneryBox): number {
  if (segmentHitsBox(a, b, box)) {
    return 0;
  }
  const corners: MapPoint[] = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ];
  return Math.min(
    ...corners.map((corner) => pointToSegment(corner, a, b)),
    pointToBox(a, box),
    pointToBox(b, box),
  );
}

/**
 * Je obdélník blíž než `clearance` k úseku `a`–`b`? Nejdřív levné
 * porovnání s obdélníkem kolem úseku, přesná vzdálenost jen u blízkých.
 */
function isNearSegment(a: MapPoint, b: MapPoint, box: SceneryBox, clearance: number): boolean {
  const around = {
    left: Math.min(a.x, b.x) - clearance,
    right: Math.max(a.x, b.x) + clearance,
    top: Math.min(a.y, b.y) - clearance,
    bottom: Math.max(a.y, b.y) + clearance,
  };
  return overlaps(box, around) && segmentToBox(a, b, box) < clearance;
}

function isFree(
  box: SceneryBox,
  obstacles: Obstacles,
  others: readonly SceneryBox[],
  avoidOthers: boolean,
): boolean {
  if (obstacles.squares.some((taken) => overlaps(box, taken))) {
    return false;
  }
  if (obstacles.path.some(([a, b]) => isNearSegment(a, b, box, obstacles.pathClearance))) {
    return false;
  }
  return !avoidOthers || !others.some((taken) => overlaps(grow(box, obstacles.gap), taken));
}

/** Nejširší rozměr obdélníku `along × across` natočeného nejvýš o `maxAngle` stupňů. */
function maxRotatedExtent(along: number, across: number, maxAngle: number): number {
  const limit = (maxAngle * Math.PI) / 180;
  const widest = Math.atan2(across, along);
  if (widest <= limit) {
    return Math.hypot(along, across);
  }
  return along * Math.cos(limit) + across * Math.sin(limit);
}

/** Plocha pohybu kolem výchozího bodu 0, 0 pro danou velikost a délku pohybu. */
function relativeSweep(
  bounds: SceneryMotionBounds,
  sizeUnit: number,
  travelUnit: number,
): SceneryBox {
  const width = bounds.width * bounds.maxScaleX * sizeUnit;
  const height = bounds.height * bounds.maxScaleY * sizeUnit;
  const halfWidth = maxRotatedExtent(width, height, bounds.maxAngle) / 2;
  const halfHeight = maxRotatedExtent(height, width, bounds.maxAngle) / 2;
  return {
    left: bounds.dx[0] * travelUnit + bounds.shiftX[0] * sizeUnit - halfWidth,
    right: bounds.dx[1] * travelUnit + bounds.shiftX[1] * sizeUnit + halfWidth,
    top: bounds.dy[0] * travelUnit + bounds.shiftY[0] * sizeUnit - halfHeight,
    bottom: bounds.dy[1] * travelUnit + bounds.shiftY[1] * sizeUnit + halfHeight,
  };
}

function shifted(box: SceneryBox, by: MapPoint): SceneryBox {
  return {
    left: box.left + by.x,
    right: box.right + by.x,
    top: box.top + by.y,
    bottom: box.bottom + by.y,
  };
}

/** Hodnoty od `min` do `max` po kroku `step`, vždy i s oběma konci. */
function stepsBetween(min: number, max: number, step: number): number[] {
  if (max < min) {
    return [];
  }
  const values: number[] = [];
  for (let value = min; value < max; value += step) {
    values.push(value);
  }
  values.push(max);
  return values;
}

/** Index hodnoty v seřazené řadě, která je nejblíž `wanted`. */
function nearestIndex(values: readonly number[], wanted: number): number {
  let best = 0;
  values.forEach((value, index) => {
    if (Math.abs(value - wanted) < Math.abs((values[best] ?? value) - wanted)) {
      best = index;
    }
  });
  return best;
}

/**
 * Body mřížky `columns × rows` ve čtvercovém prstenci `ring` kolem bodu
 * `column`, `row`; body mimo mřížku se vynechají.
 */
function ringCells(
  column: number,
  row: number,
  ring: number,
  columns: number,
  rows: number,
): Array<readonly [number, number]> {
  if (ring === 0) {
    return [[column, row]];
  }
  const cells: Array<readonly [number, number]> = [];
  const firstColumn = Math.max(column - ring, 0);
  const lastColumn = Math.min(column + ring, columns - 1);
  for (const edgeRow of [row - ring, row + ring]) {
    if (edgeRow >= 0 && edgeRow < rows) {
      for (let x = firstColumn; x <= lastColumn; x += 1) {
        cells.push([x, edgeRow]);
      }
    }
  }
  const firstRow = Math.max(row - ring + 1, 0);
  const lastRow = Math.min(row + ring - 1, rows - 1);
  for (const edgeColumn of [column - ring, column + ring]) {
    if (edgeColumn >= 0 && edgeColumn < columns) {
      for (let y = firstRow; y <= lastRow; y += 1) {
        cells.push([edgeColumn, y]);
      }
    }
  }
  return cells;
}

/**
 * Volný výchozí bod co nejblíž přání: mřížka se prochází v prstencích od
 * bodu nejbližšího přání, v prvním prstenci s volným bodem vyhraje ten
 * nejbližší. Celá mřížka se neřadí, prochází se jen, dokud není místo.
 */
function nearestFreeOrigin(
  relative: SceneryBox,
  region: ContentBox,
  wish: MapPoint,
  step: number,
  isFreeAt: (origin: MapPoint) => boolean,
): MapPoint | null {
  const xs = stepsBetween(
    region.left - relative.left,
    region.left + region.width - relative.right,
    step,
  );
  const ys = stepsBetween(
    region.top - relative.top,
    region.top + region.height - relative.bottom,
    step,
  );
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  const middle = {
    x: (relative.left + relative.right) / 2,
    y: (relative.top + relative.bottom) / 2,
  };
  const column = nearestIndex(xs, wish.x - middle.x);
  const row = nearestIndex(ys, wish.y - middle.y);
  const rings = Math.max(column, xs.length - 1 - column, row, ys.length - 1 - row);
  for (let ring = 0; ring <= rings; ring += 1) {
    let best: MapPoint | null = null;
    let bestDistance = Infinity;
    for (const [x, y] of ringCells(column, row, ring, xs.length, ys.length)) {
      const originX = xs[x];
      const originY = ys[y];
      if (originX === undefined || originY === undefined) {
        continue;
      }
      const origin = { x: originX, y: originY };
      const distance = pointDistance({ x: originX + middle.x, y: originY + middle.y }, wish);
      if (distance < bestDistance && isFreeAt(origin)) {
        best = origin;
        bestDistance = distance;
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}

interface Placement {
  readonly origin: MapPoint;
  readonly sweep: SceneryBox;
  readonly sizeUnit: number;
  readonly travelUnit: number;
}

/** Plocha mapy, kde kousek smí být. */
function regionBox(content: ContentBox, region: SceneryRegion): ContentBox {
  if (region === 'top') {
    return { ...content, height: content.height * SCENERY_TOP_SHARE };
  }
  return content;
}

/** Plochy pohybu už rozložených kousků a jejich druh. */
interface TakenSweep {
  readonly kind: SceneryKind;
  readonly sweep: SceneryBox;
}

/** Místo pro kousek, nebo `null`, když se nikam nevejde ani nejmenší. */
function placePiece(
  kind: SceneryKind,
  wish: MapPoint,
  map: ProgressMapLayout,
  obstacles: Obstacles,
  taken: readonly TakenSweep[],
): Placement | null {
  const bounds = SCENERY_MOTION_BOUNDS[kind];
  const step = map.markerSize * SEARCH_STEP_SHARE;
  const others = taken
    .filter((other) => !(other.kind === kind && OWN_OVERLAP_KINDS.has(kind)))
    .map((other) => other.sweep);
  for (const region of REGIONS[kind] ?? ['anywhere']) {
    const area = regionBox(obstacles.content, region);
    for (const [stepIndex, [sizeShare, travelShare]] of FIT_STEPS.entries()) {
      const sizeUnit = map.markerSize * sizeShare;
      const travelUnit = map.markerSize * travelShare;
      const relative = relativeSweep(bounds, sizeUnit, travelUnit);
      const passes = stepIndex >= OVERLAP_ALLOWED_FROM_STEP ? [true, false] : [true];
      for (const avoidOthers of passes) {
        const origin = nearestFreeOrigin(relative, area, wish, step, (candidate) =>
          isFree(shifted(relative, candidate), obstacles, others, avoidOthers),
        );
        if (origin) {
          return { origin, sweep: shifted(relative, origin), sizeUnit, travelUnit };
        }
      }
    }
  }
  return null;
}

function wishedPoint(content: ContentBox, kind: SceneryKind, index: number): MapPoint {
  const [shareX, shareY] = WISHED_PLACES[kind][index] ?? [0.5, 0.5];
  return { x: content.left + content.width * shareX, y: content.top + content.height * shareY };
}

/**
 * Kousky prostředí mapy `theme` v ploše `area` (AC1, AC2). Scéna předá
 * rozložení mapy, které už má; jinak se spočítá.
 *
 * Kousek, pro který na mapě není volné místo, se vynechá (AC1 dovoluje
 * méně kousků). První kousek druhu se nevynechá nikdy, nejvýš je nejmenší
 * u svého přání, aby se na mapě hýbal každý druh. Počty jsou zvolené tak,
 * aby se ve všech zkušebních oknech vešly všechny kousky, a po otočení
 * proto zůstává stejný počet (hlídá `mapSceneryRegions.test.ts`).
 */
export function layoutMapScenery(
  area: GameArea,
  theme: MapThemeId,
  map: ProgressMapLayout = layoutProgressMap(area, theme),
): MapScenery {
  const obstacles = obstaclesOf(area, map);
  const taken: TakenSweep[] = [];
  const pieces: SceneryPiece[] = [];
  for (const kind of MAP_SCENERY_KINDS[theme]) {
    const count = Math.min(PIECE_COUNTS[kind], MAX_SCENERY_PIECES_PER_KIND);
    for (let index = 0; index < count; index += 1) {
      const wish = wishedPoint(obstacles.content, kind, index);
      const placement =
        placePiece(kind, wish, map, obstacles, taken) ??
        (index === 0 ? tiniest(kind, wish, map) : null);
      if (!placement) {
        continue;
      }
      taken.push({ kind, sweep: placement.sweep });
      pieces.push({
        kind,
        index,
        sweep: placement.sweep,
        ...(LANE_KINDS.has(kind) ? { lane: placement.sweep } : {}),
        origin: placement.origin,
        sizeUnit: placement.sizeUnit,
        travelUnit: placement.travelUnit,
      });
    }
  }
  return { pieces };
}

/** Nejmenší kousek u svého přání (jen když se první kousek druhu nikam nevejde). */
function tiniest(kind: SceneryKind, wish: MapPoint, map: ProgressMapLayout): Placement {
  const [sizeShare, travelShare] = FIT_STEPS[FIT_STEPS.length - 1] ?? [1, 1];
  const sizeUnit = map.markerSize * sizeShare;
  const travelUnit = map.markerSize * travelShare;
  const relative = relativeSweep(SCENERY_MOTION_BOUNDS[kind], sizeUnit, travelUnit);
  return { origin: wish, sweep: shifted(relative, wish), sizeUnit, travelUnit };
}

/** Obdélník kolem obdélníku `width × height` natočeného o `angle` stupňů. */
function rotatedSize(width: number, height: number, angle: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return [width * cos + height * sin, width * sin + height * cos];
}

/** Kde kousek je v čase `elapsedMs` od ukázání mapy (jen z času a kousku, bez náhody). */
export function sceneryPoseAt(piece: SceneryPiece, elapsedMs: number): SceneryPose {
  const bounds = SCENERY_MOTION_BOUNDS[piece.kind];
  const motion = sceneryMotionAt(piece.kind, piece.index, elapsedMs);
  const [width, height] = rotatedSize(
    bounds.width * Math.abs(motion.scaleX) * piece.sizeUnit,
    bounds.height * Math.abs(motion.scaleY) * piece.sizeUnit,
    motion.angle,
  );
  return {
    x: piece.origin.x + motion.dx * piece.travelUnit + motion.shiftX * piece.sizeUnit,
    y: piece.origin.y + motion.dy * piece.travelUnit + motion.shiftY * piece.sizeUnit,
    width,
    height,
    alpha: motion.alpha,
    angle: motion.angle,
    scaleX: motion.scaleX,
    scaleY: motion.scaleY,
  };
}

/** Šířka a výška kousku bez zvětšení a natočení v herních jednotkách (pro kreslení). */
export function scenerySizeOf(piece: SceneryPiece): { width: number; height: number } {
  const bounds = SCENERY_MOTION_BOUNDS[piece.kind];
  return { width: bounds.width * piece.sizeUnit, height: bounds.height * piece.sizeUnit };
}
