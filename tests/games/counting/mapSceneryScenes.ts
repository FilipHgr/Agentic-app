/**
 * Pomůcky pro testy pohybů prostředí na mapách postupu (#136): druhy
 * pohybu podle mapy, rozložení kousků ve všech oknech mapy z #133 AC7
 * (`MAP_WINDOWS`) a obrazovka mapy s pohyblivými kousky pro společná
 * pravidla rozložení (`tests/shared/layoutRules.ts`).
 *
 * Navržené rozhraní `src/games/counting/logic/mapScenery.ts` (čistý
 * TypeScript bez Phaseru, v herních jednotkách jako rozložení mapy):
 * - `type SceneryKind = 'waves' | 'gull' | 'fallingLeaves' | 'butterfly'
 *   | 'flag' | 'cloud' | 'bubbles' | 'fish' | 'stars' | 'comet'`,
 * - `MAP_SCENERY_KINDS: Readonly<Record<MapThemeId, readonly SceneryKind[]>>`
 *   druhy pohybu každé mapy,
 * - `MAX_SCENERY_PIECES_PER_KIND = 6`,
 * - `interface SceneryBox { left, right, top, bottom }`,
 * - `interface SceneryPiece { kind, sweep: SceneryBox, lane?: SceneryBox }`:
 *   `sweep` je celá plocha, kterou kousek během pohybu projde i se svou
 *   velikostí, `lane` vymezený pruh (jen padající listí a bublinky),
 * - `interface MapScenery { pieces: readonly SceneryPiece[] }`,
 * - `layoutMapScenery(area: GameArea, theme: MapThemeId): MapScenery`
 *   (rozložení mapy si spočítá samo přes `layoutProgressMap`, nezávisí
 *   na kroku značky ani na tom, jestli se stáhl obrázek mapy),
 * - `interface SceneryPose { x, y, width, height, alpha, angle }`: střed
 *   kousku, obdélník, který kousek právě zabírá (i s otočením a zvětšením),
 *   průhlednost 0–1 a natočení ve stupních,
 * - `sceneryPoseAt(piece: SceneryPiece, elapsedMs: number): SceneryPose`
 *   kde kousek je v čase od ukázání mapy. Plyne jen z času a kousku, bez
 *   náhody, takže po otočení zařízení pokračuje ze stejného okamžiku.
 */

import {
  MAP_SCENERY_KINDS,
  layoutMapScenery,
  sceneryPoseAt,
} from '../../../src/games/counting/logic/mapScenery';
import type {
  MapScenery,
  SceneryBox,
  SceneryKind,
  SceneryPiece,
  SceneryPose,
} from '../../../src/games/counting/logic/mapScenery';
import {
  MAP_GOAL_SHOW_MS,
  MAP_STEPS,
  MAP_THEMES,
} from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap, markerAt } from '../../../src/games/counting/logic/progressMapLayout';
import type {
  MapPoint,
  ProgressMapLayout,
} from '../../../src/games/counting/logic/progressMapLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, toCss, viewportOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { cornerItems, isOwnSurrounding, visibleAreaOf } from './layoutScenes';
import { MAP_WINDOWS, MARKER_NAME, placeName } from './mapLayoutScenes';
import { drawnMarkerSize, drawnPlaceSize } from './mapPictureLayoutScenes';

export { MAP_SCENERY_KINDS, MAP_WINDOWS, sceneryPoseAt };
export type { SceneryKind, SceneryPiece, SceneryPose };

/** Druhy pohybu podle zadání (#136 AC1), jak je pozná člověk. */
export const EXPECTED_KINDS: Readonly<Record<MapThemeId, readonly SceneryKind[]>> = {
  island: ['waves', 'gull'],
  forest: ['fallingLeaves', 'butterfly'],
  castle: ['flag', 'cloud'],
  underwater: ['bubbles', 'fish'],
  space: ['stars', 'comet'],
};

export const KIND_NAMES: Readonly<Record<SceneryKind, string>> = {
  waves: 'vlna',
  gull: 'racek',
  fallingLeaves: 'list',
  butterfly: 'motýl',
  flag: 'vlajka',
  cloud: 'mráček',
  bubbles: 'bublinka',
  fish: 'rybka',
  stars: 'hvězda',
  comet: 'kometa',
};

/** Druhy, které mají vymezený pruh (#136 AC2). */
export const LANE_KINDS: readonly SceneryKind[] = ['fallingLeaves', 'bubbles'];

/** Po kolika ms se kousky kontrolují, od ukázání mapy až do jejího zavření. */
export const SCENERY_SAMPLE_MS = 10;

/** Časy 0, 10, 20 … až do nejdelšího zobrazení mapy (cíl 5 s) včetně. */
export function sceneryTimes(untilMs: number = MAP_GOAL_SHOW_MS): number[] {
  const times: number[] = [];
  for (let time = 0; time < untilMs; time += SCENERY_SAMPLE_MS) {
    times.push(time);
  }
  times.push(untilMs);
  return times;
}

/** Mapa v jednom okně: plocha, rozložení mapy a pohyblivé kousky. */
export interface SceneryCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly theme: MapThemeId;
  readonly area: GameArea;
  readonly map: ProgressMapLayout;
  readonly scenery: MapScenery;
}

export function sceneryCase(window: TestWindow, theme: MapThemeId): SceneryCase {
  const area = gameAreaFor(viewportOf(window));
  return {
    label: `${window.name}, mapa ${theme}`,
    window,
    theme,
    area,
    map: layoutProgressMap(area, theme),
    scenery: layoutMapScenery(area, theme),
  };
}

export function sceneryCases(windows: readonly TestWindow[] = MAP_WINDOWS): SceneryCase[] {
  return windows.flatMap((window) => MAP_THEMES.map((theme) => sceneryCase(window, theme)));
}

/** Kousky jednoho druhu v pořadí, v jakém je rozložení vydalo. */
export function piecesOf(scenery: MapScenery, kind: SceneryKind): SceneryPiece[] {
  return scenery.pieces.filter((piece) => piece.kind === kind);
}

/** Jméno kousku pro zprávy: „vlna 2“. */
export function pieceName(scenery: MapScenery, piece: SceneryPiece): string {
  const index = piecesOf(scenery, piece.kind).indexOf(piece);
  return `${KIND_NAMES[piece.kind]} ${index + 1}`;
}

/** Obdélník, který kousek zabírá v daném okamžiku, v herních jednotkách. */
export function poseBox(pose: SceneryPose): Box {
  return box(pose.x, pose.y, pose.width, pose.height);
}

function asBox(sceneryBox: SceneryBox): Box {
  return {
    left: sceneryBox.left,
    right: sceneryBox.right,
    top: sceneryBox.top,
    bottom: sceneryBox.bottom,
  };
}

const SCENERY_PREFIX = 'pohyb: ';
const LANE_PREFIX = 'pruh: ';
const GOAL_NAME = 'symbol cíle (i slavící)';

function isScenery(item: LayoutItem): boolean {
  return item.name.startsWith(SCENERY_PREFIX) || item.name.startsWith(LANE_PREFIX);
}

function sceneryItems(testCase: SceneryCase): LayoutItem[] {
  const { scenery, area } = testCase;
  return scenery.pieces.flatMap((piece) => {
    const name = pieceName(scenery, piece);
    const sweep: LayoutItem = {
      name: `${SCENERY_PREFIX}${name}`,
      box: toCss(asBox(piece.sweep), area),
    };
    if (!piece.lane) {
      return [sweep];
    }
    return [sweep, { name: `${LANE_PREFIX}${name}`, box: toCss(asBox(piece.lane), area) }];
  });
}

/**
 * Mapa se značkou na kroku `step` a s plochami, kterými kousky projdou.
 * Místa a značka se měří tak, jak je scéna nakreslí (okraj a poskočení,
 * `mapPictureLayoutScenes.ts`), symbol cíle i zvětšený se září (#135 AC3).
 * Kousky se smí překrývat navzájem a se svým pruhem, s ničím jiným.
 * Cestu hlídá zvlášť `pathViolations`, protože úseky jsou šikmé.
 */
export function sceneryScene(testCase: SceneryCase, step: number): LayoutScene {
  const { window, area, map } = testCase;
  const placeItems: LayoutItem[] = map.places.map((place, index) => {
    const size = drawnPlaceSize(map, index);
    return { name: placeName(index), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const marker = markerAt(map, step);
  const markerSize = drawnMarkerSize(map);
  const markerItem: LayoutItem = {
    name: MARKER_NAME,
    box: toCss(box(marker.x, marker.y, markerSize, markerSize), area),
  };
  const goal = map.goalCelebration;
  const goalItem: LayoutItem = {
    name: GOAL_NAME,
    box: toCss(box(goal.x, goal.y, goal.size, goal.size), area),
  };
  const ownPlace = placeName(step);
  return {
    label: `${testCase.label}, značka na kroku ${step} (${ownPlace})`,
    free: visibleAreaOf(window, area),
    items: [
      ...cornerItems(window, area),
      ...placeItems,
      goalItem,
      markerItem,
      ...sceneryItems(testCase),
    ],
    mayOverlap: (first, second) =>
      (isScenery(first) && isScenery(second)) ||
      // Rozložení mapy samo (značka na svém místě, cíl a jeho symbol) hlídají testy #133–#135.
      (!isScenery(first) && !isScenery(second)) ||
      isOwnSurrounding(first, second) ||
      isOwnSurrounding(second, first),
  };
}

/** Mapa ve všech oknech, na každé z 5 map a se značkou na každém kroku 0 až 3. */
export function sceneryScenes(cases: readonly SceneryCase[]): LayoutScene[] {
  return cases.flatMap((testCase) =>
    Array.from({ length: MAP_STEPS + 1 }, (_, step) => sceneryScene(testCase, step)),
  );
}

// ---------------------------------------------------------------------------
// Cesta: šikmé úseky od místa k místu, široké jako značka
// ---------------------------------------------------------------------------

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const length = distance(a, b);
  if (length === 0) {
    return distance(point, a);
  }
  const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length ** 2;
  const clamped = Math.min(Math.max(along, 0), 1);
  return distance(point, { x: a.x + (b.x - a.x) * clamped, y: a.y + (b.y - a.y) * clamped });
}

function isPointInside(point: MapPoint, area: Box): boolean {
  return (
    point.x >= area.left && point.x <= area.right && point.y >= area.top && point.y <= area.bottom
  );
}

function cross(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function cornersOf(area: Box): MapPoint[] {
  return [
    { x: area.left, y: area.top },
    { x: area.right, y: area.top },
    { x: area.right, y: area.bottom },
    { x: area.left, y: area.bottom },
  ];
}

/** Nejmenší vzdálenost úseku `a`–`b` od obdélníku (0, když do něj zasahuje). */
export function segmentToBoxDistance(a: MapPoint, b: MapPoint, area: Box): number {
  if (isPointInside(a, area) || isPointInside(b, area)) {
    return 0;
  }
  const corners = cornersOf(area);
  const edges = corners.map((corner, index): [MapPoint, MapPoint] => [
    corner,
    corners[(index + 1) % corners.length] ?? corner,
  ]);
  if (edges.some(([c, d]) => segmentsCross(a, b, c, d))) {
    return 0;
  }
  const fromCorners = corners.map((corner) => distanceToSegment(corner, a, b));
  const fromEnds = [a, b].map((end) =>
    Math.hypot(
      Math.max(area.left - end.x, 0, end.x - area.right),
      Math.max(area.top - end.y, 0, end.y - area.bottom),
    ),
  );
  return Math.min(...fromCorners, ...fromEnds);
}

/** Tolerance v herních jednotkách. */
const PATH_TOLERANCE = 0.01;

/**
 * Kousky a pruhy, které zasahují do cesty. Cesta je široká jako nakreslená
 * značka (i s okrajem a poskočením), protože značka po ní jde (#135).
 */
export function pathViolations(testCase: SceneryCase): string[] {
  const { map, scenery } = testCase;
  const halfWidth = drawnMarkerSize(map) / 2;
  const violations: string[] = [];
  for (let index = 0; index + 1 < map.places.length; index += 1) {
    const a = map.places[index];
    const b = map.places[index + 1];
    if (!a || !b) {
      continue;
    }
    const segment = `úsek cesty ${placeName(index)} → ${placeName(index + 1)}`;
    for (const piece of scenery.pieces) {
      const areas: Array<[string, SceneryBox]> = [['plocha pohybu', piece.sweep]];
      if (piece.lane) {
        areas.push(['pruh', piece.lane]);
      }
      for (const [what, area] of areas) {
        const gap = segmentToBoxDistance(a, b, asBox(area)) - halfWidth;
        if (gap < -PATH_TOLERANCE) {
          violations.push(
            `${testCase.label}: ${what} ${pieceName(scenery, piece)} zasahuje do ${segment}`,
          );
        }
      }
    }
  }
  return violations;
}
