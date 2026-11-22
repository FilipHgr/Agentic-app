/**
 * Pomůcky pro testy stop na cestě mapy postupu (#144, styl A z varianty
 * D): stopy podle tématu na oblouku cesty (#146), v kartě (#145) ve všech
 * oknech mapy z #133 AC7 a na 5 mapách. Tvar stopy (natočený obdélník),
 * kde leží na oblouku (ušlá délka od startu, úsek, strana), barva obrázku
 * pod ní a smíchání poloprůhledné barvy s pozadím.
 *
 * Navržené rozhraní `src/shared/logic/mapFootprints.ts` (čistý
 * TypeScript bez Phaseru, v herních jednotkách jako rozložení mapy):
 * - `type FootprintKind = 'paw' | 'bareFoot' | 'boot' | 'bubble' | 'star'`
 *   (tlapky, šlápoty bosých nohou, stopy bot, bublinky, hvězdičky),
 * - `MAP_FOOTPRINT_KINDS: Readonly<Record<MapThemeId, FootprintKind>>`
 *   druh stop každé mapy (les tlapky, ostrov šlápoty, hrad boty, podmoří
 *   bublinky, vesmír hvězdičky),
 * - `interface MapFootprint { x; y; width; height; angle }`: střed stopy,
 *   rozměr nenatočené stopy (`width` po směru, kam stopa míří, `height`
 *   napříč) a natočení ve stupních ve směru `Math.atan2(dy, dx)` souřadnic
 *   obrazovky (0 = doprava, 90 = dolů). Tlapky, šlápoty a boty míří po
 *   směru chůze od startu k cíli, bublinky a hvězdičky mají `angle` 0,
 * - `interface MapFootprints { kind: FootprintKind; prints: readonly MapFootprint[] }`
 *   stopy celé cesty od startu k cíli,
 * - `layoutMapFootprints(area: MapArea, theme: MapThemeId,
 *   map: ProgressMapLayout = layoutProgressMap(area, theme)): MapFootprints`
 *   stopy nezávislé na kroku značky a na tom, jestli je stažený obrázek;
 *   kreslí se i v zástupném vzhledu,
 * - `interface FootprintMoment { lit: boolean; hop: number }`: `lit`
 *   stopa svítí (prošlá), `hop` výška poskoku při rozsvícení jako díl
 *   delší strany stopy (0 v klidu),
 * - `footprintMomentAt(map: ProgressMapLayout, move: MapMove,
 *   footprint: MapFootprint, elapsedMs: number): FootprintMoment`
 *   v čase od ukázání mapy (jako `markerPointAt`),
 * - `interface FootprintLook { fillColor: string; outlineColor: string; alpha: number }`
 *   barvy `#RRGGBB` a krytí 0–1 celé stopy,
 * - `interface MapFootprintStyle { lit: FootprintLook; unlit: FootprintLook }`,
 * - `mapFootprintStyleFor(theme: MapThemeId, look: MapLook): MapFootprintStyle`
 *   prošlé zlaté s tmavým obrysem, neprošlé bílé poloprůhledné.
 * V `src/shared/logic/mapAnimation.ts` zůstává `markerTrailAt`,
 * jen `points` (zlatá čára) je během chůze prázdné, `sparkles` zůstávají.
 */

import { MAP_STEPS } from '../../../src/shared/logic/progressMap';
import { layoutMapFootprints } from '../../../src/shared/logic/mapFootprints';
import type {
  FootprintLook,
  MapFootprint,
  MapFootprints,
} from '../../../src/shared/logic/mapFootprints';
import { mapCardPictureCover } from '../../../src/shared/logic/progressMapCard';
import type { MapPoint, ProgressMapLayout } from '../../../src/shared/logic/progressMapLayout';
import { contrastRatio } from '../../../src/shared/logic/theme';
import { pictureFileName } from './mapPictureHelpers';
import { PICTURE_TONES, TONE_GRID } from './mapPictureTones';
import { arcCases, denseArcOf, distance, projectOntoArc } from './mapPathHelpers';
import type { ArcCase, DenseArc } from './mapPathHelpers';

/** Mapa v kartě jednoho okna se stopami. */
export interface FootprintCase extends ArcCase {
  readonly footprints: MapFootprints;
}

let cachedCases: FootprintCase[] | undefined;

/** Každé okno mapy × 5 map, mapa v kartě (#145) i se stopami. */
export function footprintCases(): FootprintCase[] {
  cachedCases ??= arcCases().map((arc) => ({
    ...arc,
    footprints: layoutMapFootprints(arc.area, arc.theme, arc.layout),
  }));
  return cachedCases;
}

/** Kde stopa leží na oblouku cesty. */
export interface PrintOnArc {
  readonly print: MapFootprint;
  /** Pořadí stopy od startu (podle ušlé délky). */
  readonly order: number;
  /** Ušlá délka od startu po oblouku k nejbližšímu bodu oblouku. */
  readonly along: number;
  /** Vzdálenost středu stopy od oblouku. */
  readonly offArc: number;
  /** Úsek 0 až 2, na kterém stopa leží. */
  readonly segment: number;
  /** Strana od směru chůze: 1 vlevo, −1 vpravo (souřadnice obrazovky), 0 na oblouku. */
  readonly side: number;
  /** Směr oblouku v místě stopy ve stupních (`Math.atan2`), po směru chůze. */
  readonly arcDegrees: number;
}

/** Stopy seřazené od startu s tím, kde leží na oblouku. */
export function printsOnArc(layout: ProgressMapLayout, footprints: MapFootprints): PrintOnArc[] {
  const dense = denseArcOf(layout);
  const measured = footprints.prints.map((print) => {
    const projection = projectOntoArc(dense, print);
    const frame = arcFrameAt(dense, projection.along);
    const cross =
      frame.direction.x * (print.y - frame.point.y) - frame.direction.y * (print.x - frame.point.x);
    return {
      print,
      along: projection.along,
      offArc: projection.distance,
      segment: segmentAt(dense, projection.along),
      // Souřadnice obrazovky mají osu y dolů: záporný součin je vlevo od směru chůze.
      side: cross < 0 ? 1 : cross > 0 ? -1 : 0,
      arcDegrees: (Math.atan2(frame.direction.y, frame.direction.x) * 180) / Math.PI,
    };
  });
  return measured
    .sort((first, second) => first.along - second.along)
    .map((each, order) => ({ ...each, order }));
}

/** Úsek, na kterém leží bod v ušlé délce `along`. */
function segmentAt(dense: DenseArc, along: number): number {
  for (let segment = 0; segment < MAP_STEPS; segment += 1) {
    if (along <= (dense.placeAlong[segment + 1] ?? Number.POSITIVE_INFINITY)) {
      return segment;
    }
  }
  return MAP_STEPS - 1;
}

/** Bod a jednotkový směr hustého oblouku v ušlé délce `along`. */
function arcFrameAt(dense: DenseArc, along: number): { point: MapPoint; direction: MapPoint } {
  const { points, along: walked } = dense;
  let index = walked.findIndex((value) => value >= along);
  if (index < 1) {
    index = index === 0 ? 1 : points.length - 1;
  }
  const before = points[index - 1] ?? { x: 0, y: 0 };
  const after = points[index] ?? before;
  const length = distance(before, after) || 1;
  const startAlong = walked[index - 1] ?? 0;
  const share = Math.min(Math.max((along - startAlong) / length, 0), 1);
  return {
    point: {
      x: before.x + (after.x - before.x) * share,
      y: before.y + (after.y - before.y) * share,
    },
    direction: { x: (after.x - before.x) / length, y: (after.y - before.y) / length },
  };
}

/** Rozdíl dvou směrů ve stupních (0 až 180). */
export function turnDegrees(first: number, second: number): number {
  const raw = Math.abs(first - second) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Rohy natočeného obdélníku stopy. */
export function printCorners(print: MapFootprint): MapPoint[] {
  const radians = (print.angle * Math.PI) / 180;
  const along = { x: Math.cos(radians), y: Math.sin(radians) };
  const across = { x: -along.y, y: along.x };
  const halfWidth = print.width / 2;
  const halfHeight = print.height / 2;
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([a = 0, b = 0]) => ({
    x: print.x + along.x * halfWidth * a + across.x * halfHeight * b,
    y: print.y + along.y * halfWidth * a + across.y * halfHeight * b,
  }));
}

/** Delší strana stopy. */
export function longerSide(print: MapFootprint): number {
  return Math.max(print.width, print.height);
}

/** Vzdálenost bodu od úsečky `a`–`b`. */
function pointSegmentDistance(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const share =
    lengthSquared === 0
      ? 0
      : Math.min(
          Math.max(
            ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared,
            0,
          ),
          1,
        );
  return distance(point, { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share });
}

/** Leží bod uvnitř konvexního mnohoúhelníku? */
function isInsidePolygon(point: MapPoint, polygon: readonly MapPoint[]): boolean {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index] ?? point;
    const b = polygon[(index + 1) % polygon.length] ?? point;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross !== 0) {
      if (sign !== 0 && Math.sign(cross) !== sign) {
        return false;
      }
      sign = Math.sign(cross);
    }
  }
  return true;
}

/** O kolik stopa zasahuje do kruhu (kladné = překryv). */
export function printCircleOverlap(print: MapFootprint, center: MapPoint, radius: number): number {
  const corners = printCorners(print);
  if (isInsidePolygon(center, corners)) {
    return Number.POSITIVE_INFINITY;
  }
  const edgeDistance = Math.min(
    ...corners.map((corner, index) =>
      pointSegmentDistance(center, corner, corners[(index + 1) % corners.length] ?? corner),
    ),
  );
  return radius - edgeDistance;
}

/** Obdélník podle hran v herních jednotkách. */
export interface Edges {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** O kolik stopa zasahuje do obdélníku (kladné = překryv), podle oddělujících os. */
export function printBoxOverlap(print: MapFootprint, area: Edges): number {
  const corners = printCorners(print);
  const boxCorners: MapPoint[] = [
    { x: area.left, y: area.top },
    { x: area.right, y: area.top },
    { x: area.right, y: area.bottom },
    { x: area.left, y: area.bottom },
  ];
  const radians = (print.angle * Math.PI) / 180;
  const axes: MapPoint[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: Math.cos(radians), y: Math.sin(radians) },
    { x: -Math.sin(radians), y: Math.cos(radians) },
  ];
  let smallest = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    const project = (points: readonly MapPoint[]): [number, number] => {
      const values = points.map((point) => point.x * axis.x + point.y * axis.y);
      return [Math.min(...values), Math.max(...values)];
    };
    const [printMin, printMax] = project(corners);
    const [boxMin, boxMax] = project(boxCorners);
    smallest = Math.min(smallest, Math.min(printMax, boxMax) - Math.max(printMin, boxMin));
  }
  return smallest;
}

/** Barva `color` s krytím `alpha` smíchaná s pozadím `under` (`#RRGGBB`). */
export function mixColor(color: string, under: string, alpha: number): string {
  const channel = (hex: string, start: number): number =>
    Number.parseInt(hex.slice(start, start + 2), 16);
  const channels = [1, 3, 5].map((start) =>
    Math.round(channel(color, start) * alpha + channel(under, start) * (1 - alpha)),
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * Kontrast stopy vůči pozadí `under`: výplň i obrys smíchané s pozadím
 * podle krytí stopy, počítá se ta výraznější z obou (stopu je vidět, když
 * je vidět výplň, nebo obrys).
 */
export function printContrast(look: FootprintLook, under: string): number {
  return Math.max(
    contrastRatio(mixColor(look.fillColor, under, look.alpha), under),
    contrastRatio(mixColor(look.outlineColor, under, look.alpha), under),
  );
}

/** Barva obrázku pod bodem mapy v kartě: průměr dílu mřížky 4 × 4 (`mapCardPictureCover`). */
export function toneUnder(arc: ArcCase, point: MapPoint): string {
  const { orientation, rect } = mapCardPictureCover(arc.card);
  // Plocha mapy začíná v levém horním rohu karty; obrázek je od něj v CSS px.
  const cssX = point.x * arc.area.scale;
  const cssY = point.y * arc.area.scale;
  const cell = (value: number, start: number, size: number): number =>
    Math.min(TONE_GRID - 1, Math.max(0, Math.floor(((value - start) / size) * TONE_GRID)));
  const column = cell(cssX, rect.left, rect.width);
  const row = cell(cssY, rect.top, rect.height);
  const tones = PICTURE_TONES[pictureFileName(arc.theme, orientation)]?.tones ?? [];
  return tones[row * TONE_GRID + column] ?? '#000000';
}

export function describePoint(point: MapPoint): string {
  return `[${Math.round(point.x)}, ${Math.round(point.y)}]`;
}
