/**
 * Cesta na mapě postupu ze stop podle tématu (#144, styl A z varianty D):
 * v lese tlapky, na ostrově šlápoty bosých nohou, na hradě stopy bot,
 * v podmoří bublinky a ve vesmíru hvězdičky. Stopy leží střídavě vlevo
 * a vpravo kousek vedle oblouku cesty (#146), v pruhu širokém jako
 * značka, a vyhýbají se značce na každém místě i slavícímu cíli. Prošlé
 * stopy jsou zlaté s tmavým obrysem, neprošlé bílé poloprůhledné. Stopa
 * se rozsvítí, když k ní značka po oblouku dojde, a krátce poskočí.
 * Rozložení nezávisí na kroku ani na staženém obrázku, kreslí se celé
 * i v zástupném vzhledu. Čistý TypeScript bez Phaseru, kreslí scéna.
 */

import { MARKER_START_MS, MARKER_WALK_MS, markerShareAt } from './mapAnimation';
import type { MapLook } from './mapPictureLoading';
import { MAP_STEPS } from './progressMap';
import type { MapMove, MapThemeId } from './progressMap';
import { DRAWN_MARKER_SCALE, layoutProgressMap } from './progressMapLayout';
import type { MapArea, MapPoint, ProgressMapLayout } from './progressMapLayout';
import { layoutMapScenery } from './mapScenery';
import { walkBetween } from './progressMapPath';
import type { PathPose, PathWalk } from './progressMapPath';
import { MAP_FOOTPRINT_COLORS, progressMapStyleFor } from './mapTheme';

/** Druh stop: tlapky, šlápoty bosých nohou, stopy bot, bublinky, hvězdičky. */
export type FootprintKind = 'paw' | 'bareFoot' | 'boot' | 'bubble' | 'star';

/** Druh stop každé mapy (AC1); žádný druh není na dvou mapách. */
export const MAP_FOOTPRINT_KINDS: Readonly<Record<MapThemeId, FootprintKind>> = {
  forest: 'paw',
  island: 'bareFoot',
  castle: 'boot',
  underwater: 'bubble',
  space: 'star',
};

/** Jedna stopa na cestě. */
export interface MapFootprint {
  /** Střed stopy. */
  readonly x: number;
  readonly y: number;
  /** Rozměr nenatočené stopy: `width` po směru chůze, `height` napříč. */
  readonly width: number;
  readonly height: number;
  /** Natočení ve stupních jako `Math.atan2(dy, dx)` (0 doprava, 90 dolů). */
  readonly angle: number;
  /** Strana od směru chůze: 1 vlevo, −1 vpravo (levá a pravá noha). */
  readonly side: 1 | -1;
  /** Úsek 0 až 2, na kterém stopa leží. */
  readonly segment: number;
  /** Díl délky oblouku úseku, kde stopa leží (0 na minulém místě, 1 na dalším). */
  readonly segmentShare: number;
}

/** Stopy celé cesty od startu k cíli. */
export interface MapFootprints {
  readonly kind: FootprintKind;
  readonly prints: readonly MapFootprint[];
}

/** Rozměry stopy jako díl její delší strany: šířka po směru, výška napříč. */
const KIND_SHAPES: Readonly<Record<FootprintKind, { width: number; height: number }>> = {
  paw: { width: 1, height: 0.92 },
  bareFoot: { width: 1, height: 0.46 },
  boot: { width: 1, height: 0.46 },
  bubble: { width: 1, height: 1 },
  star: { width: 1, height: 1 },
};

/** Stopy natočené po směru chůze (tlapky, šlápoty, boty). */
const ORIENTED_KINDS: ReadonlySet<FootprintKind> = new Set<FootprintKind>([
  'paw',
  'bareFoot',
  'boot',
]);

/**
 * Delší strana stopy jako díl průměru značky, od největší (AC2: 18–30 %).
 * Pod 18 % (nejméně 15 %) jen tam, kde se jinak nevejdou 3 stopy na úsek.
 */
const PRINT_SIZE_TRIES = [0.28, 0.26, 0.24, 0.22, 0.2, 0.19, 0.18];
const TIGHT_PRINT_SIZE_TRIES = [0.165, 0.15];

/**
 * Jak daleko od oblouku leží střed stopy, díl průměru značky (AC2: nejvýš
 * 15 %). Nohy a tlapky vlevo a vpravo jako při chůzi, bublinky
 * a hvězdičky skoro na oblouku, aby tvořily linku.
 */
const SIDE_OFFSET_SHARE: Readonly<Record<FootprintKind, number>> = {
  paw: 0.09,
  bareFoot: 0.09,
  boot: 0.09,
  bubble: 0.025,
  star: 0.025,
};

/**
 * Nejmenší rozestup stop po oblouku, násobek delší strany. Nohy a tlapky
 * leží střídavě vlevo a vpravo, takže se nedotknou i blíž za sebou (jako
 * kroky); bublinky a hvězdičky leží v jedné lince a potřebují mezeru.
 */
const MIN_SPACING_TO_PRINT: Readonly<Record<FootprintKind, number>> = {
  paw: 0.95,
  bareFoot: 0.95,
  boot: 0.95,
  bubble: 1.15,
  star: 1.15,
};

/** Kolik stop na úseku se chce, aby stopy tvořily cestu; menší stopy jen do 18 %. */
const WANTED_PRINTS_PER_SEGMENT = 5;

/** Nejméně stop na úseku (AC2). */
const MIN_PRINTS_PER_SEGMENT = 3;

/** O kolik se smějí lišit rozestupy úseků, než se všechny srovnají na nejmenší (AC2: 15 %). */
const MAX_SPACING_SPREAD = 0.12;

/** Malá mezera mezi stopou a tím, co nesmí překrýt (zaokrouhlení), díl průměru značky. */
const CLEARANCE_SHARE = 0.005;

/** Po kolika dílech délky úseku se hledá, kde stopa nic nepřekryje. */
const FREE_SAMPLES = 320;

/** Kruh, do kterého stopa nesmí zasáhnout. */
interface Circle extends MapPoint {
  readonly radius: number;
}

/** Obdélník podle hran, do kterého stopa nesmí zasáhnout. */
interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Co stopy nesmí překrýt (AC2). */
interface Obstacles {
  readonly circles: readonly Circle[];
  readonly boxes: readonly Box[];
}

/** Úsek oblouku, kde se stopy vejdou, v délce od minulého místa. */
interface FreeStretch {
  readonly start: number;
  readonly end: number;
  readonly length: number;
}

/** Stopa bez údajů o úseku: kde leží a jak je velká a natočená. */
type PrintShape = Omit<MapFootprint, 'segment' | 'segmentShare'>;

/** Rozvržení stop jedné velikosti: volné kusy úseků a kolik stop se na ně vejde. */
interface SizePlan {
  readonly size: number;
  readonly stretches: readonly FreeStretch[];
  /** Nejméně stop na některém úseku při nejmenším rozestupu. */
  readonly fewest: number;
}

/**
 * Stopy cesty mapy `theme` v ploše `area`. Stopy jdou rovnoměrně přes
 * celý volný kus oblouku každého úseku, od značky na minulém místě po
 * značku na dalším, se stejným rozestupem na všech úsecích. Největší
 * stopy, při kterých je na každém úseku aspoň 5 stop; když to nejde,
 * stopy 18 % průměru značky. Pod 18 % (nejvýš na 15 %) se zmenší, jen
 * když se jinak nevejdou 3 stopy na úsek (AC2).
 */
export function layoutMapFootprints(
  area: MapArea,
  theme: MapThemeId,
  map: ProgressMapLayout = layoutProgressMap(area, theme),
): MapFootprints {
  const kind = MAP_FOOTPRINT_KINDS[theme];
  const obstacles = obstaclesOf(area, theme, map);
  const walks = Array.from({ length: MAP_STEPS }, (_, segment) =>
    walkBetween(map, segment, segment + 1),
  );
  const planFor = (sizeShare: number): SizePlan => {
    const size = map.markerSize * sizeShare;
    const stretches = walks.map((walk) => freeStretch(walk, kind, size, map, obstacles));
    const shortest = Math.min(...stretches.map((stretch) => stretch.length));
    return {
      size,
      stretches,
      fewest: Math.floor(shortest / (size * MIN_SPACING_TO_PRINT[kind]) + 1e-9) + 1,
    };
  };
  const plans = PRINT_SIZE_TRIES.map(planFor);
  const chosen =
    plans.find((plan) => plan.fewest >= WANTED_PRINTS_PER_SEGMENT) ??
    [...plans].reverse().find((plan) => plan.fewest >= MIN_PRINTS_PER_SEGMENT) ??
    TIGHT_PRINT_SIZE_TRIES.map(planFor).find((plan) => plan.fewest >= MIN_PRINTS_PER_SEGMENT) ??
    planFor(TIGHT_PRINT_SIZE_TRIES[TIGHT_PRINT_SIZE_TRIES.length - 1] ?? 0.15);
  return { kind, prints: placePrints(walks, chosen, kind, map) };
}

/**
 * Co stopy nesmí překrýt: značka stojící na kterémkoli místě, symbol
 * a slavící cíl, místo klíče (#139) a plochy a pruhy kousků prostředí (#136).
 */
function obstaclesOf(area: MapArea, theme: MapThemeId, map: ProgressMapLayout): Obstacles {
  const markerRadius = (map.markerSize * DRAWN_MARKER_SCALE) / 2;
  const key = map.goalKey;
  const scenery = layoutMapScenery(area, theme, map).pieces.flatMap((piece) =>
    piece.lane ? [piece.sweep, piece.lane] : [piece.sweep],
  );
  return {
    circles: [
      ...map.places.map((place) => ({ ...place, radius: markerRadius })),
      { ...map.goalSymbol, radius: map.goalSymbol.size / 2 },
      { ...map.goalCelebration, radius: map.goalCelebration.size / 2 },
    ],
    boxes: [
      {
        left: key.x - key.width / 2,
        right: key.x + key.width / 2,
        top: key.y - key.height / 2,
        bottom: key.y + key.height / 2,
      },
      ...scenery,
    ],
  };
}

/** Stopa velikosti `size` na straně `side` vedle oblouku v bodě `pose`. */
function printAt(
  kind: FootprintKind,
  size: number,
  pose: PathPose,
  side: 1 | -1,
  markerSize: number,
): PrintShape {
  const { point, direction } = pose;
  const shape = KIND_SHAPES[kind];
  const offset = markerSize * SIDE_OFFSET_SHARE[kind];
  const angle = ORIENTED_KINDS.has(kind)
    ? (Math.atan2(direction.y, direction.x) * 180) / Math.PI
    : 0;
  // Vlevo od směru chůze je v souřadnicích obrazovky (dy, −dx).
  return {
    x: point.x + direction.y * offset * side,
    y: point.y - direction.x * offset * side,
    width: size * shape.width,
    height: size * shape.height,
    angle,
    side,
  };
}

/** Rohy natočeného obdélníku stopy zvětšeného o `grow` na každou stranu. */
function printCorners(print: PrintShape, grow: number): MapPoint[] {
  const radians = (print.angle * Math.PI) / 180;
  const along = { x: Math.cos(radians), y: Math.sin(radians) };
  const across = { x: -along.y, y: along.x };
  const halfWidth = print.width / 2 + grow;
  const halfHeight = print.height / 2 + grow;
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

/** Vzdálenost bodu od natočeného obdélníku stopy (0 uvnitř). */
function distanceFromPrint(print: PrintShape, point: MapPoint): number {
  const radians = (print.angle * Math.PI) / 180;
  const dx = point.x - print.x;
  const dy = point.y - print.y;
  const along = dx * Math.cos(radians) + dy * Math.sin(radians);
  const across = -dx * Math.sin(radians) + dy * Math.cos(radians);
  const outAlong = Math.max(Math.abs(along) - print.width / 2, 0);
  const outAcross = Math.max(Math.abs(across) - print.height / 2, 0);
  return Math.hypot(outAlong, outAcross);
}

/** Zasahuje stopa zvětšená o `grow` do obdélníku `box`? Podle oddělujících os. */
function printHitsBox(print: PrintShape, box: Box, grow: number): boolean {
  const corners = printCorners(print, grow);
  const boxCorners: MapPoint[] = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ];
  const radians = (print.angle * Math.PI) / 180;
  const axes: MapPoint[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: Math.cos(radians), y: Math.sin(radians) },
    { x: -Math.sin(radians), y: Math.cos(radians) },
  ];
  return axes.every((axis) => {
    const project = (points: readonly MapPoint[]): number[] =>
      points.map((point) => point.x * axis.x + point.y * axis.y);
    const printSpan = project(corners);
    const boxSpan = project(boxCorners);
    return (
      Math.min(Math.max(...printSpan), Math.max(...boxSpan)) >
      Math.max(Math.min(...printSpan), Math.min(...boxSpan))
    );
  });
}

/** Nezasahuje stopa do ničeho, co nesmí překrýt? */
function isPrintClear(print: PrintShape, obstacles: Obstacles, clearance: number): boolean {
  return (
    obstacles.circles.every(
      (circle) => distanceFromPrint(print, circle) >= circle.radius + clearance,
    ) && obstacles.boxes.every((box) => !printHitsBox(print, box, clearance))
  );
}

/**
 * Nejdelší kus oblouku úseku, kde stopa na kterékoli straně nic
 * nepřekryje (značku na žádném místě, cíl, klíč ani prostředí).
 */
function freeStretch(
  walk: PathWalk,
  kind: FootprintKind,
  size: number,
  map: ProgressMapLayout,
  obstacles: Obstacles,
): FreeStretch {
  const clearance = map.markerSize * CLEARANCE_SHARE;
  const isClear = (share: number): boolean => {
    const pose = walk.poseAt(share);
    return ([1, -1] as const).every((side) =>
      isPrintClear(printAt(kind, size, pose, side, map.markerSize), obstacles, clearance),
    );
  };
  let best = { first: 0, last: -1 };
  let runStart = -1;
  for (let index = 0; index <= FREE_SAMPLES; index += 1) {
    if (isClear(index / FREE_SAMPLES)) {
      runStart = runStart < 0 ? index : runStart;
      if (index - runStart > best.last - best.first) {
        best = { first: runStart, last: index };
      }
    } else {
      runStart = -1;
    }
  }
  if (best.last < best.first) {
    // Nikde se stopa nevejde: aspoň prostředek úseku.
    return { start: walk.length / 2, end: walk.length / 2, length: 0 };
  }
  const start = (best.first / FREE_SAMPLES) * walk.length;
  const end = (best.last / FREE_SAMPLES) * walk.length;
  return { start, end, length: end - start };
}

/**
 * Rozestup stop každého úseku: stopy jdou přes celý volný kus, co nejvíc
 * jich se vejde při nejmenším rozestupu. Když by se rozestupy úseků lišily
 * víc než o `MAX_SPACING_SPREAD`, dostanou všechny úseky ten nejmenší
 * a stopy leží uprostřed volného kusu.
 */
function segmentSpacings(plan: SizePlan, kind: FootprintKind): number[] {
  const minSpacing = plan.size * MIN_SPACING_TO_PRINT[kind];
  const spacings = plan.stretches.map((stretch) => {
    const count = Math.max(
      MIN_PRINTS_PER_SEGMENT,
      Math.floor(stretch.length / minSpacing + 1e-9) + 1,
    );
    return stretch.length / (count - 1);
  });
  const smallest = Math.min(...spacings);
  const largest = Math.max(...spacings);
  return largest > smallest * (1 + MAX_SPACING_SPREAD) ? spacings.map(() => smallest) : spacings;
}

/** Stopy po rozestupu úseku v jeho volném kusu, střídavě vlevo a vpravo; první vlevo. */
function placePrints(
  walks: readonly PathWalk[],
  plan: SizePlan,
  kind: FootprintKind,
  map: ProgressMapLayout,
): MapFootprint[] {
  const spacings = segmentSpacings(plan, kind);
  return walks.flatMap((walk, segment) => {
    const stretch = plan.stretches[segment] ?? { start: 0, end: 0, length: 0 };
    const spacing = spacings[segment] ?? 0;
    const count =
      spacing > 0
        ? Math.max(MIN_PRINTS_PER_SEGMENT, Math.floor(stretch.length / spacing + 1e-6) + 1)
        : MIN_PRINTS_PER_SEGMENT;
    const used = spacing * (count - 1);
    const first = stretch.start + (stretch.length - used) / 2;
    const length = walk.length || 1;
    return Array.from({ length: count }, (_, index) => {
      const segmentShare = (first + spacing * index) / length;
      const side: 1 | -1 = index % 2 === 0 ? 1 : -1;
      return {
        ...printAt(kind, plan.size, walk.poseAt(segmentShare), side, map.markerSize),
        segment,
        segmentShare,
      };
    });
  });
}

/** Jak stopa v jednom okamžiku vypadá. */
export interface FootprintMoment {
  /** Stopa svítí (značka k ní už došla). */
  readonly lit: boolean;
  /** Výška poskoku při rozsvícení jako díl delší strany stopy (0 v klidu). */
  readonly hop: number;
}

/** Jak dlouho trvá poskok stopy při rozsvícení (AC4: nejvýš 250 ms). */
export const FOOTPRINT_HOP_MS = 220;

/** Jak vysoko stopa poskočí, díl její delší strany. */
const FOOTPRINT_HOP_SHARE = 0.45;

/**
 * Kdy značka dojde ke stopě v dílu `share` úseku, ms od ukázání mapy:
 * obrácené `markerShareAt` (plynulý rozjezd a zastavení).
 */
function reachedAtMs(share: number): number {
  const clamped = Math.min(Math.max(share, 0), 1);
  return MARKER_START_MS + (MARKER_WALK_MS * Math.acos(1 - 2 * clamped)) / Math.PI;
}

/**
 * Stopa v čase `elapsedMs` od ukázání mapy: svítí, když k ní značka
 * po oblouku došla (stopy dřívějších úseků svítí celou dobu), a hned po
 * rozsvícení krátce poskočí. Stopy rozsvícené už z minulého kroku
 * neposkočí. Plyne jen z času a dílu úseku, takže po otočení zařízení
 * svítí stopy po stejný díl úseku (AC5).
 */
export function footprintMomentAt(
  map: ProgressMapLayout,
  move: MapMove,
  footprint: MapFootprint,
  elapsedMs: number,
): FootprintMoment {
  const lastSegment = Math.max(map.places.length - 2, 0);
  const segment = Math.min(footprint.segment, lastSegment);
  if (segment < move.from) {
    return { lit: true, hop: 0 };
  }
  if (segment > move.from) {
    return { lit: false, hop: 0 };
  }
  const lit = markerShareAt(elapsedMs) >= footprint.segmentShare;
  if (!lit) {
    return { lit, hop: 0 };
  }
  const sinceLit = elapsedMs - reachedAtMs(footprint.segmentShare);
  if (sinceLit <= 0 || sinceLit >= FOOTPRINT_HOP_MS) {
    return { lit, hop: 0 };
  }
  return { lit, hop: Math.sin((Math.PI * sinceLit) / FOOTPRINT_HOP_MS) * FOOTPRINT_HOP_SHARE };
}

/** Barvy a krytí celé stopy. */
export interface FootprintLook {
  readonly fillColor: string;
  readonly outlineColor: string;
  readonly alpha: number;
}

export interface MapFootprintStyle {
  readonly lit: FootprintLook;
  readonly unlit: FootprintLook;
}

/**
 * Vzhled stop (AC3): prošlé zlaté s tmavým obrysem (aspoň 3 : 1 na
 * světlém obrázku díky obrysu, na tmavém díky výplni), neprošlé bílé
 * poloprůhledné s tenkým tmavým obrysem, aby byly vidět i na trávě
 * a písku. Na zástupném pastelovém pozadí má neprošlá stopa obrys v šedé
 * barvě cesty (#134), na obrázku tmavý.
 */
export function mapFootprintStyleFor(theme: MapThemeId, look: MapLook): MapFootprintStyle {
  const colors = MAP_FOOTPRINT_COLORS;
  const unlitOutline =
    look === 'placeholder' ? progressMapStyleFor(theme, look).pathColor : colors.unlitOutline;
  return {
    lit: { fillColor: colors.litFill, outlineColor: colors.litOutline, alpha: 1 },
    unlit: {
      fillColor: colors.unlitFill,
      outlineColor: unlitOutline,
      alpha: theme === 'space' ? colors.unlitAlphaOnDark : colors.unlitAlpha,
    },
  };
}
