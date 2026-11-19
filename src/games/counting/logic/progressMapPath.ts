/**
 * Cesta na mapě postupu vede oblouky (#146 AC1): každý úsek mezi
 * sousedními místy je kus kružnice, prohnutý o `bend` délky úsečky na
 * stranu podle znaménka (kladné vlevo od směru úseku v souřadnicích
 * obrazovky). Kružnice mění směr rovnoměrně, takže je plynulá a díl délky
 * oblouku odpovídá dílu úhlu. Body se měří po délce oblouku, ne po
 * parametru křivky. Podle těchto bodů jde značka, kreslí se čára cesty,
 * zlatá stopa a jiskřičky (#146 AC3, AC5) a vyhýbá se jim klíč
 * a prostředí (#146 AC2). Čistý TypeScript bez Phaseru.
 */

import type { MapPoint } from './progressMapLayout';

/** Co oblouky cesty potřebují z rozložení mapy: místa a prohnutí úseků. */
export interface MapPathShape {
  /** Střed místa podle kroku: 0 start, pak zastávky a cíl. */
  readonly places: readonly MapPoint[];
  /**
   * Prohnutí úseku z místa `i` na místo `i + 1`: největší vzdálenost
   * oblouku od úsečky jako díl délky úsečky, se znaménkem strany.
   */
  readonly pathBends: readonly number[];
}

/** Kus kružnice z `from` do `to` (u nulového prohnutí úsečka). */
interface PathArc {
  readonly from: MapPoint;
  readonly to: MapPoint;
  readonly center: MapPoint;
  readonly radius: number;
  /** Úhel bodu `from` od středu kružnice. */
  readonly startAngle: number;
  /** O kolik se úhel změní z `from` do `to` (se znaménkem směru). */
  readonly sweep: number;
  readonly length: number;
}

/** Kolik dílků má lomená čára jednoho úseku; od oblouku je nejvýš asi 0,03 % délky úsečky. */
const LINE_PIECES_PER_SEGMENT = 32;

/** Pod tímto prohnutím se úsek počítá jako úsečka. */
const STRAIGHT_BEND = 1e-6;

function straightArc(from: MapPoint, to: MapPoint): PathArc {
  return {
    from,
    to,
    center: from,
    radius: 0,
    startAngle: 0,
    sweep: 0,
    length: Math.hypot(to.x - from.x, to.y - from.y),
  };
}

/** Oblouk z `from` do `to` prohnutý o `bend` délky úsečky. */
function arcBetween(from: MapPoint, to: MapPoint, bend: number): PathArc {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0 || Math.abs(bend) < STRAIGHT_BEND) {
    return straightArc(from, to);
  }
  const sagitta = Math.abs(bend) * chord;
  const side = Math.sign(bend);
  // Jednotková kolmice vlevo od směru úseku; kladné prohnutí leží na její straně.
  const normal = { x: (-dy / chord) * side, y: (dx / chord) * side };
  const radius = (chord * chord) / 4 / (2 * sagitta) + sagitta / 2;
  const middle = { x: from.x + dx / 2, y: from.y + dy / 2 };
  const center = {
    x: middle.x - normal.x * (radius - sagitta),
    y: middle.y - normal.y * (radius - sagitta),
  };
  const halfAngle = 2 * Math.atan((2 * sagitta) / chord);
  const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
  // Směr otáčení: ten, kterým vede kružnice přes vrchol prohnutí.
  const toTop = {
    x: middle.x + normal.x * sagitta - center.x,
    y: middle.y + normal.y * sagitta - center.y,
  };
  const toFrom = { x: from.x - center.x, y: from.y - center.y };
  const turn = Math.sign(toFrom.x * toTop.y - toFrom.y * toTop.x) || 1;
  return {
    from,
    to,
    center,
    radius,
    startAngle,
    sweep: 2 * halfAngle * turn,
    length: 2 * halfAngle * radius,
  };
}

/** Bod oblouku v dílu `share` jeho délky (0 na začátku, 1 na konci). */
function pointOnArc(arc: PathArc, share: number): MapPoint {
  const clamped = Math.min(Math.max(share, 0), 1);
  if (clamped <= 0) {
    return arc.from;
  }
  if (clamped >= 1) {
    return arc.to;
  }
  if (arc.sweep === 0) {
    return {
      x: arc.from.x + (arc.to.x - arc.from.x) * clamped,
      y: arc.from.y + (arc.to.y - arc.from.y) * clamped,
    };
  }
  const angle = arc.startAngle + arc.sweep * clamped;
  return {
    x: arc.center.x + arc.radius * Math.cos(angle),
    y: arc.center.y + arc.radius * Math.sin(angle),
  };
}

/** Jednotkový směr oblouku v dílu `share` jeho délky. */
function directionOnArc(arc: PathArc, share: number): MapPoint {
  if (arc.sweep === 0 || arc.length === 0) {
    const length = arc.length || 1;
    return { x: (arc.to.x - arc.from.x) / length, y: (arc.to.y - arc.from.y) / length };
  }
  const angle = arc.startAngle + arc.sweep * Math.min(Math.max(share, 0), 1);
  const turn = Math.sign(arc.sweep);
  return { x: -Math.sin(angle) * turn, y: Math.cos(angle) * turn };
}

function segmentArc(shape: MapPathShape, segment: number): PathArc {
  const last = Math.max(shape.places.length - 2, 0);
  const index = Math.min(Math.max(Math.round(segment), 0), last);
  const from = shape.places[index] ?? { x: 0, y: 0 };
  const to = shape.places[index + 1] ?? from;
  return arcBetween(from, to, shape.pathBends[index] ?? 0);
}

/**
 * Bod na oblouku úseku z místa `segment` na místo `segment + 1`; `share`
 * je díl délky oblouku (0 na minulém místě, 1 na dalším).
 */
export function pathPointAt(shape: MapPathShape, segment: number, share: number): MapPoint {
  return pointOnArc(segmentArc(shape, segment), share);
}

/**
 * Lomená čára, kterou se kreslí čára cesty úseku (od místa `segment` po
 * místo `segment + 1`); dost hustá, aby byla od oblouku nejvýš 1 CSS px.
 */
export function pathLinePoints(shape: MapPathShape, segment: number): readonly MapPoint[] {
  return pathSamples(shape, segment, LINE_PIECES_PER_SEGMENT);
}

/** Body oblouku úseku po `1 / count` jeho délky: `count + 1` bodů od minulého místa po další. */
export function pathSamples(shape: MapPathShape, segment: number, count: number): MapPoint[] {
  const arc = segmentArc(shape, segment);
  return Array.from({ length: count + 1 }, (_, index) => pointOnArc(arc, index / count));
}

/** Lomené čáry všech úseků cesty jako dílky (pro vyhýbání klíče a prostředí). */
export function pathLinePieces(shape: MapPathShape): Array<readonly [MapPoint, MapPoint]> {
  const pieces: Array<readonly [MapPoint, MapPoint]> = [];
  for (let segment = 0; segment + 1 < shape.places.length; segment += 1) {
    const points = pathLinePoints(shape, segment);
    for (let index = 1; index < points.length; index += 1) {
      const before = points[index - 1];
      const point = points[index];
      if (before && point) {
        pieces.push([before, point]);
      }
    }
  }
  return pieces;
}

/** Bod a směr cesty v ušlé délce. */
export interface PathPose {
  readonly point: MapPoint;
  /** Jednotkový směr cesty v bodě. */
  readonly direction: MapPoint;
}

/**
 * Chůze po cestě z místa `fromStep` na místo `toStep`: oblouky se spočítají
 * jednou a pak se z nich berou body v dílu délky (pro značku a stopu).
 */
export interface PathWalk {
  /** Délka oblouků mezi oběma místy. */
  readonly length: number;
  /** Bod a směr v dílu `share` délky (0 na minulém místě, 1 na novém). */
  poseAt(share: number): PathPose;
  /** Vzdálenost bodu od nejbližšího úseku cesty, po kterém se nejde. */
  distanceFromOtherSegments(point: MapPoint): number;
}

export function walkBetween(shape: MapPathShape, fromStep: number, toStep: number): PathWalk {
  const first = Math.min(fromStep, toStep);
  const segments = Math.max(Math.abs(toStep - fromStep), 1);
  const arcs = Array.from({ length: segments }, (_, index) => segmentArc(shape, first + index));
  const total = arcs.reduce((sum, arc) => sum + arc.length, 0);
  const others: PathArc[] = [];
  for (let segment = 0; segment + 1 < shape.places.length; segment += 1) {
    if (segment < first || segment >= first + segments) {
      others.push(segmentArc(shape, segment));
    }
  }
  const poseAt = (share: number): PathPose => {
    const forward = toStep >= fromStep ? share : 1 - share;
    let remaining = Math.min(Math.max(forward, 0), 1) * total;
    for (const [index, arc] of arcs.entries()) {
      const isLast = index === arcs.length - 1;
      if (remaining <= arc.length || isLast) {
        const local = arc.length === 0 ? 1 : Math.min(remaining / arc.length, 1);
        return { point: pointOnArc(arc, local), direction: directionOnArc(arc, local) };
      }
      remaining -= arc.length;
    }
    const from = shape.places[fromStep] ?? { x: 0, y: 0 };
    return { point: from, direction: { x: 1, y: 0 } };
  };
  const distanceFromOtherSegments = (point: MapPoint): number =>
    Math.min(Number.POSITIVE_INFINITY, ...others.map((arc) => distanceToArc(arc, point)));
  return { length: total, poseAt, distanceFromOtherSegments };
}

/**
 * Bod cesty z místa `fromStep` na místo `toStep` v dílu `share` délky
 * oblouků mezi nimi (0 na minulém místě, 1 na novém).
 */
export function pathPoseBetween(
  shape: MapPathShape,
  fromStep: number,
  toStep: number,
  share: number,
): PathPose {
  return walkBetween(shape, fromStep, toStep).poseAt(share);
}

/** Vzdálenost bodu od oblouku (od kružnice v rozsahu oblouku, jinak od bližšího konce). */
function distanceToArc(arc: PathArc, point: MapPoint): number {
  const toEnds = Math.min(
    Math.hypot(point.x - arc.from.x, point.y - arc.from.y),
    Math.hypot(point.x - arc.to.x, point.y - arc.to.y),
  );
  if (arc.sweep === 0) {
    const dx = arc.to.x - arc.from.x;
    const dy = arc.to.y - arc.from.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      return toEnds;
    }
    const share = ((point.x - arc.from.x) * dx + (point.y - arc.from.y) * dy) / lengthSquared;
    const clamped = Math.min(Math.max(share, 0), 1);
    return Math.hypot(point.x - (arc.from.x + dx * clamped), point.y - (arc.from.y + dy * clamped));
  }
  const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
  // Jak daleko je úhel bodu od začátku oblouku ve směru otáčení (0 až 2π).
  const turned =
    ((((angle - arc.startAngle) * Math.sign(arc.sweep)) % (2 * Math.PI)) + 2 * Math.PI) %
    (2 * Math.PI);
  if (turned <= Math.abs(arc.sweep)) {
    return Math.abs(Math.hypot(point.x - arc.center.x, point.y - arc.center.y) - arc.radius);
  }
  return toEnds;
}
