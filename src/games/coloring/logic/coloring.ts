/**
 * Malování prstem nebo tužkou do omalovánky (#88). Oblast tahu se určí při
 * jeho začátku a každé razítko štětce zapíše jen pixely této oblasti, takže
 * barva nikdy nepřeteče přes obrys (AC2). Mezi body tahu se razítka kladou
 * po kroku nejvýš W/4, čára je tak souvislá a dosáhne až k obrysu (AC3).
 *
 * Maluje jen první prst: další dotyky (druhý prst, dlaň, tužka) během tahu
 * nic nenamalují a po zvednutí prvního prstu tah skončí (AC5). Každé místo
 * má jen jednu barvu z palety, bez míchání a průhlednosti.
 *
 * Souřadnice jsou v pixelech vrstvy barev, která má rozměry mapy oblastí.
 * Čistý TypeScript bez Phaseru.
 */

import { OUTLINE_REGION, regionAt } from './regionMap';
import type { RegionMap } from './regionMap';

/** Stopa štětce je široká tento díl šířky plochy (doporučení k otázce 6). */
const BRUSH_WIDTH_SHARE = 1 / 30;

/** Razítka po kroku nejvýš W/4, jinak by na okraji stopy zůstaly zuby. */
const STAMPS_PER_BRUSH_WIDTH = 4;

/** Krok v pixelech, po kterém se hledá oblast, do které prst vjel z obrysu. */
const REGION_SEARCH_STEP = 1;

/** Pixel vrstvy barev bez barvy. */
const NO_COLOR = 255;

export type PointerKind = 'touch' | 'pen' | 'mouse';

/** Jeden údaj o dotyku: číslo prstu a poloha v pixelech vrstvy barev. */
export interface PointerSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Prst, tužka nebo myš; všechny barví stejně. */
  readonly kind?: PointerKind;
}

/** Obdélník pixelů, které se změnily (pravý a spodní okraj už do něj nepatří). */
export interface ChangedArea {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Coloring {
  /** Šířka stopy štětce W v pixelech. */
  readonly brushWidth: number;
  /** Prst se dotkl. Vrátí, co se zabarvilo, nebo `null`. */
  pointerDown(pointer: PointerSample, colorIndex: number): ChangedArea | null;
  /** Prst se posunul. Vrátí, co se zabarvilo, nebo `null`. */
  pointerMove(pointer: PointerSample): ChangedArea | null;
  /** Prst se zvedl. */
  pointerUp(pointerId: number): void;
  /** Systém tah přerušil: namalované zůstane, nic se nedokreslí. */
  interrupt(): void;
  /** Index barvy palety v pixelu; `null` u prázdného pixelu, obrysu a mimo plochu. */
  colorAt(x: number, y: number): number | null;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Co tah barví: nic (začal mimo plochu), zatím nic (začal na obrysu a čeká
 * na první oblast), nebo jednu oblast.
 */
type StrokeTarget =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'waitingForRegion' }
  | { readonly kind: 'region'; readonly region: number };

interface Stroke {
  readonly pointerId: number;
  readonly colorIndex: number;
  target: StrokeTarget;
  /** Poslední bod tahu s platnými souřadnicemi. */
  last: Point | null;
}

/** Šířka stopy štětce pro plochu široké `pictureWidth` pixelů. */
export function brushWidthFor(pictureWidth: number): number {
  return pictureWidth * BRUSH_WIDTH_SHARE;
}

function isUsablePoint(pointer: PointerSample): boolean {
  return Number.isFinite(pointer.x) && Number.isFinite(pointer.y);
}

/** Co bude tah barvit podle místa, kde začal. */
function targetAt(regions: RegionMap, point: Point): StrokeTarget {
  const region = regionAt(regions, point.x, point.y);
  if (region === null) {
    return { kind: 'nothing' };
  }
  if (region === OUTLINE_REGION) {
    return { kind: 'waitingForRegion' };
  }
  return { kind: 'region', region };
}

/** První oblast na úsečce `from`–`to` (prst vjel z obrysu do oblasti), nebo `null`. */
function firstRegionOnSegment(regions: RegionMap, from: Point, to: Point): number | null {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / REGION_SEARCH_STEP));
  for (let step = 0; step <= steps; step += 1) {
    const share = step / steps;
    const region = regionAt(
      regions,
      from.x + (to.x - from.x) * share,
      from.y + (to.y - from.y) * share,
    );
    if (region !== null && region !== OUTLINE_REGION) {
      return region;
    }
  }
  return null;
}

/** Sjednocení dvou změněných obdélníků. */
export function joinAreas(
  first: ChangedArea | null,
  second: ChangedArea | null,
): ChangedArea | null {
  if (first === null) {
    return second;
  }
  if (second === null) {
    return first;
  }
  return {
    left: Math.min(first.left, second.left),
    top: Math.min(first.top, second.top),
    right: Math.max(first.right, second.right),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

export function createColoring(
  regions: RegionMap,
  options: { brushWidth?: number } = {},
): Coloring {
  const brushWidth = options.brushWidth ?? brushWidthFor(regions.width);
  const radius = brushWidth / 2;
  const stampSpacing = brushWidth / STAMPS_PER_BRUSH_WIDTH;
  const colors = new Uint8Array(regions.width * regions.height).fill(NO_COLOR);
  let stroke: Stroke | null = null;

  /** Kulaté razítko průměru W se středem `center`, jen do pixelů oblasti `region`. */
  const stamp = (center: Point, region: number, colorIndex: number): ChangedArea | null => {
    const left = Math.max(0, Math.floor(center.x - radius));
    const right = Math.min(regions.width - 1, Math.ceil(center.x + radius));
    const top = Math.max(0, Math.floor(center.y - radius));
    const bottom = Math.min(regions.height - 1, Math.ceil(center.y + radius));
    let paintedAny = false;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const index = y * regions.width + x;
        const distance = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y);
        if (distance <= radius && regions.regionIds[index] === region) {
          colors[index] = colorIndex;
          paintedAny = true;
        }
      }
    }
    // Celý čtverec razítka stačí: textura se tak posílá po malých kouscích.
    return paintedAny ? { left, top, right: right + 1, bottom: bottom + 1 } : null;
  };

  /** Razítka po úsečce `from`–`to` po kroku nejvýš W/4. */
  const paintSegment = (
    from: Point,
    to: Point,
    region: number,
    colorIndex: number,
  ): ChangedArea | null => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length / stampSpacing));
    let changed: ChangedArea | null = null;
    for (let step = 0; step <= steps; step += 1) {
      const share = step / steps;
      const center = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
      changed = joinAreas(changed, stamp(center, region, colorIndex));
    }
    return changed;
  };

  return {
    brushWidth,

    pointerDown(pointer, colorIndex) {
      if (stroke !== null) {
        // Druhý prst nebo dlaň během tahu nic nenamaluje.
        return null;
      }
      if (!isUsablePoint(pointer)) {
        stroke = { pointerId: pointer.id, colorIndex, target: { kind: 'nothing' }, last: null };
        return null;
      }
      const point = { x: pointer.x, y: pointer.y };
      const target = targetAt(regions, point);
      stroke = { pointerId: pointer.id, colorIndex, target, last: point };
      return target.kind === 'region' ? stamp(point, target.region, colorIndex) : null;
    },

    pointerMove(pointer) {
      if (stroke === null || stroke.pointerId !== pointer.id || !isUsablePoint(pointer)) {
        return null;
      }
      const from = stroke.last;
      const to = { x: pointer.x, y: pointer.y };
      stroke.last = to;
      if (from === null) {
        return null;
      }
      if (stroke.target.kind === 'waitingForRegion') {
        const entered = firstRegionOnSegment(regions, from, to);
        if (entered !== null) {
          stroke.target = { kind: 'region', region: entered };
        }
      }
      if (stroke.target.kind !== 'region') {
        return null;
      }
      return paintSegment(from, to, stroke.target.region, stroke.colorIndex);
    },

    pointerUp(pointerId) {
      if (stroke?.pointerId === pointerId) {
        stroke = null;
      }
    },

    interrupt() {
      stroke = null;
    },

    colorAt(x, y) {
      const region = regionAt(regions, x, y);
      if (region === null || region === OUTLINE_REGION) {
        return null;
      }
      const color = colors[Math.floor(y) * regions.width + Math.floor(x)] ?? NO_COLOR;
      return color === NO_COLOR ? null : color;
    },
  };
}
