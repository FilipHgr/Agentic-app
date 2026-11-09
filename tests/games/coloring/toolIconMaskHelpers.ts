/**
 * Neprůhledné body ikon nástrojů Omalovánek (#114 AC3, AC4, AC5) bez nové
 * závislosti: test si SVG ikony z repozitáře sám „rasterizuje“ na mřížku
 * vzorků. Tvary (`path`, `circle`, `ellipse`, `use` z `defs`) se převedou
 * na mnohoúhelníky (křivky a oblouky na krátké úsečky), vyplní se podle
 * pravidla nonzero, ořežou `clip-path` a posunou `transform`. Scéna kreslí
 * SVG (plocha 128 × 128) přes celý čtverec ikony (`showToolIcon`), vzorek
 * mřížky proto odpovídá bodu čtverce ve stejném poměru.
 *
 * Neprůhledný bod: vzorek, který zakryje aspoň jeden tvar s výplní
 * (`fill` není `none`) a nenulovou průhledností (`opacity`,
 * `fill-opacity`, u přechodu nejvyšší `stop-opacity`). Poloprůhledné
 * bubliny (opacity 0,42) se tedy počítají, obrys tahu (`stroke`, jen
 * u třpytek o 0,5 jednotky SVG) se zanedbává. Viz komentář s testy v issue #114.
 */

import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { iconSvgOf } from './toolIconHelpers';

/** Strana plochy SVG ikon Noto. */
const SVG_SIDE = 128;

/** Mřížka vzorků na stranu ikony (vzorek je asi 0,2 CSS px u ikony 47 px). */
export const MASK_SAMPLES = 256;

/** Na kolik úseček se rozdělí jedna křivka nebo oblouk. */
const CURVE_STEPS = 12;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Afinní transformace `[a, b, c, d, e, f]` jako v SVG `matrix(...)`. */
type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

interface Element {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** Jména rodičů od kořene (`svg`, `defs`, `clipPath`, …). */
  readonly parents: readonly string[];
  /** `id` rodiče `clipPath`, když v něm prvek leží. */
  readonly clipPathId: string | null;
}

/** Neprůhledné vzorky ikony: `opaque[row * MASK_SAMPLES + column]` je 1 nebo 0. */
export interface IconMask {
  readonly samples: number;
  readonly opaque: Uint8Array;
}

/** Bod ikony jako díl strany jejího čtverce (0 vlevo nahoře, 1 vpravo dole). */
export interface IconPoint {
  readonly u: number;
  readonly v: number;
}

// ---------------------------------------------------------------------------
// Čtení SVG
// ---------------------------------------------------------------------------

function attributesOf(text: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of text.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const name = match[1];
    if (name !== undefined) {
      attributes[name] = match[3] ?? match[4] ?? '';
    }
  }
  return attributes;
}

function elementsOf(svg: string): Element[] {
  const elements: Element[] = [];
  const stack: { name: string; id: string | null }[] = [];
  for (const match of svg.matchAll(/<(\/?)([\w:-]+)([^>]*?)(\/?)>/g)) {
    const closing = match[1] === '/';
    const name = match[2] ?? '';
    const selfClosing = match[4] === '/';
    if (closing) {
      stack.pop();
      continue;
    }
    const attributes = attributesOf(match[3] ?? '');
    const clipParent = [...stack].reverse().find((parent) => parent.name === 'clipPath');
    elements.push({
      name,
      attributes,
      parents: stack.map((parent) => parent.name),
      clipPathId: clipParent?.id ?? null,
    });
    if (!selfClosing) {
      stack.push({ name, id: attributes.id ?? null });
    }
  }
  return elements;
}

// ---------------------------------------------------------------------------
// Transformace
// ---------------------------------------------------------------------------

function multiply(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function numbersIn(text: string): number[] {
  return (text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
}

function transformOf(text: string | undefined): Matrix {
  let matrix = IDENTITY;
  for (const match of (text ?? '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const values = numbersIn(match[2] ?? '');
    const [p = 0, q = 0, r = 0, s = 0, t = 0, w = 0] = values;
    let step: Matrix;
    switch (match[1]) {
      case 'matrix':
        step = [p, q, r, s, t, w];
        break;
      case 'translate':
        step = [1, 0, 0, 1, p, values.length > 1 ? q : 0];
        break;
      case 'scale':
        step = [p, 0, 0, values.length > 1 ? q : p, 0, 0];
        break;
      case 'rotate': {
        const angle = (p * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotation: Matrix = [cos, sin, -sin, cos, 0, 0];
        step =
          values.length > 1
            ? multiply(multiply([1, 0, 0, 1, q, r], rotation), [1, 0, 0, 1, -q, -r])
            : rotation;
        break;
      }
      default:
        throw new Error(`transformace ${match[1]} v ikoně test neumí`);
    }
    matrix = multiply(matrix, step);
  }
  return matrix;
}

function apply(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

// ---------------------------------------------------------------------------
// Tvary na mnohoúhelníky
// ---------------------------------------------------------------------------

/** Čtečka dat cesty `d`: čísla i jednoznakové příznaky oblouku. */
class PathReader {
  private position = 0;

  constructor(private readonly text: string) {}

  private skipSeparators(): void {
    while (this.position < this.text.length && /[\s,]/.test(this.text[this.position] ?? '')) {
      this.position += 1;
    }
  }

  command(): string | null {
    this.skipSeparators();
    const char = this.text[this.position];
    if (char !== undefined && /[a-zA-Z]/.test(char)) {
      this.position += 1;
      return char;
    }
    return null;
  }

  hasNumber(): boolean {
    this.skipSeparators();
    return /[-+.\d]/.test(this.text[this.position] ?? '');
  }

  number(): number {
    this.skipSeparators();
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(this.text.slice(this.position));
    if (match === null) {
      throw new Error(`v cestě ikony chybí číslo na pozici ${this.position}`);
    }
    this.position += match[0].length;
    return Number(match[0]);
  }

  flag(): number {
    this.skipSeparators();
    const char = this.text[this.position];
    if (char !== '0' && char !== '1') {
      throw new Error(`v oblouku ikony chybí příznak na pozici ${this.position}`);
    }
    this.position += 1;
    return Number(char);
  }

  done(): boolean {
    this.skipSeparators();
    return this.position >= this.text.length;
  }
}

function cubic(from: Point, c1: Point, c2: Point, to: Point): Point[] {
  return Array.from({ length: CURVE_STEPS }, (_, index) => {
    const t = (index + 1) / CURVE_STEPS;
    const s = 1 - t;
    return {
      x: s * s * s * from.x + 3 * s * s * t * c1.x + 3 * s * t * t * c2.x + t * t * t * to.x,
      y: s * s * s * from.y + 3 * s * s * t * c1.y + 3 * s * t * t * c2.y + t * t * t * to.y,
    };
  });
}

function quadratic(from: Point, control: Point, to: Point): Point[] {
  return Array.from({ length: CURVE_STEPS }, (_, index) => {
    const t = (index + 1) / CURVE_STEPS;
    const s = 1 - t;
    return {
      x: s * s * from.x + 2 * s * t * control.x + t * t * to.x,
      y: s * s * from.y + 2 * s * t * control.y + t * t * to.y,
    };
  });
}

/** Oblouk SVG (koncové body) jako úsečky, podle převodu ze specifikace SVG (F.6.5). */
function arc(
  from: Point,
  radii: Point,
  rotationDeg: number,
  largeArc: number,
  sweep: number,
  to: Point,
): Point[] {
  let rx = Math.abs(radii.x);
  let ry = Math.abs(radii.y);
  if (rx === 0 || ry === 0 || (from.x === to.x && from.y === to.y)) {
    return [to];
  }
  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const sign = largeArc === sweep ? -1 : 1;
  const factor = sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cx1 = (factor * rx * y1) / ry;
  const cy1 = (-factor * ry * x1) / rx;
  const centerX = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const centerY = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const angleOf = (ux: number, uy: number): number => Math.atan2(uy, ux);
  const start = angleOf((x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angleOf((-x1 - cx1) / rx, (-y1 - cy1) / ry) - start;
  if (sweep === 0 && delta > 0) {
    delta -= 2 * Math.PI;
  } else if (sweep === 1 && delta < 0) {
    delta += 2 * Math.PI;
  }
  const steps = Math.max(CURVE_STEPS, Math.ceil((Math.abs(delta) / (2 * Math.PI)) * 48));
  return Array.from({ length: steps }, (_, index) => {
    const angle = start + (delta * (index + 1)) / steps;
    const ex = rx * Math.cos(angle);
    const ey = ry * Math.sin(angle);
    return { x: cos * ex - sin * ey + centerX, y: sin * ex + cos * ey + centerY };
  });
}

/** Podcesty cesty `d` jako lomené čáry (pro výplň se každá uzavře). */
function polygonsOfPath(d: string): Point[][] {
  const reader = new PathReader(d);
  const polygons: Point[][] = [];
  let current: Point[] = [];
  let point: Point = { x: 0, y: 0 };
  let start: Point = point;
  let lastControl: Point | null = null;
  let lastCommand = '';
  let command = '';
  const finish = (): void => {
    if (current.length > 1) {
      polygons.push(current);
    }
    current = [];
  };
  while (!reader.done()) {
    const next = reader.command();
    if (next !== null) {
      command = next;
    } else if (command === '' || !reader.hasNumber()) {
      throw new Error('cesta ikony začíná bez příkazu');
    }
    const relative = command === command.toLowerCase();
    const base = relative ? point : { x: 0, y: 0 };
    const read = (): Point => {
      const x = reader.number();
      const y = reader.number();
      return { x: base.x + x, y: base.y + y };
    };
    const upper = command.toUpperCase();
    let control: Point | null = null;
    switch (upper) {
      case 'M': {
        finish();
        point = read();
        start = point;
        current = [point];
        // Další dvojice čísel po M jsou úsečky.
        command = relative ? 'l' : 'L';
        break;
      }
      case 'L':
        point = read();
        current.push(point);
        break;
      case 'H':
        point = { x: (relative ? point.x : 0) + reader.number(), y: point.y };
        current.push(point);
        break;
      case 'V':
        point = { x: point.x, y: (relative ? point.y : 0) + reader.number() };
        current.push(point);
        break;
      case 'C': {
        const c1 = read();
        const c2 = read();
        const to = read();
        current.push(...cubic(point, c1, c2, to));
        control = c2;
        point = to;
        break;
      }
      case 'S': {
        const reflected: Point =
          lastControl !== null && /[CS]/i.test(lastCommand)
            ? { x: 2 * point.x - lastControl.x, y: 2 * point.y - lastControl.y }
            : point;
        const c2 = read();
        const to = read();
        current.push(...cubic(point, reflected, c2, to));
        control = c2;
        point = to;
        break;
      }
      case 'Q': {
        const c1 = read();
        const to = read();
        current.push(...quadratic(point, c1, to));
        control = c1;
        point = to;
        break;
      }
      case 'T': {
        const reflected: Point =
          lastControl !== null && /[QT]/i.test(lastCommand)
            ? { x: 2 * point.x - lastControl.x, y: 2 * point.y - lastControl.y }
            : point;
        const to = read();
        current.push(...quadratic(point, reflected, to));
        control = reflected;
        point = to;
        break;
      }
      case 'A': {
        const radii = { x: reader.number(), y: reader.number() };
        const rotation = reader.number();
        const largeArc = reader.flag();
        const sweep = reader.flag();
        const to = read();
        current.push(...arc(point, radii, rotation, largeArc, sweep, to));
        point = to;
        break;
      }
      case 'Z':
        finish();
        point = start;
        current = [point];
        break;
      default:
        throw new Error(`příkaz cesty ${command} test neumí`);
    }
    lastControl = control;
    lastCommand = upper;
  }
  finish();
  return polygons;
}

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number): Point[] {
  const steps = 96;
  return Array.from({ length: steps }, (_, index) => {
    const angle = (2 * Math.PI * index) / steps;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

function number(attributes: Readonly<Record<string, string>>, name: string, fallback = 0): number {
  const value = attributes[name];
  return value === undefined ? fallback : Number(value);
}

/** Mnohoúhelníky tvaru v souřadnicích SVG; `use` se rozbalí podle `byId`. */
function polygonsOfElement(element: Element, byId: ReadonlyMap<string, Element>): Point[][] {
  const { attributes } = element;
  const matrix = transformOf(attributes.transform);
  let polygons: Point[][];
  switch (element.name) {
    case 'path':
      polygons = polygonsOfPath(attributes.d ?? '');
      break;
    case 'circle': {
      const r = number(attributes, 'r');
      polygons = [ellipsePolygon(number(attributes, 'cx'), number(attributes, 'cy'), r, r)];
      break;
    }
    case 'ellipse':
      polygons = [
        ellipsePolygon(
          number(attributes, 'cx'),
          number(attributes, 'cy'),
          number(attributes, 'rx'),
          number(attributes, 'ry'),
        ),
      ];
      break;
    case 'use': {
      const target = byId.get((attributes.href ?? attributes['xlink:href'] ?? '').replace('#', ''));
      if (target === undefined) {
        throw new Error('use v ikoně odkazuje na neznámý prvek');
      }
      const shifted: Matrix = [1, 0, 0, 1, number(attributes, 'x'), number(attributes, 'y')];
      return polygonsOfElement(target, byId).map((polygon) =>
        polygon.map((point) => apply(multiply(matrix, shifted), point)),
      );
    }
    default:
      throw new Error(`tvar ${element.name} v ikoně test neumí`);
  }
  return polygons.map((polygon) => polygon.map((point) => apply(matrix, point)));
}

// ---------------------------------------------------------------------------
// Výplň na mřížku
// ---------------------------------------------------------------------------

/** Vzorky uvnitř mnohoúhelníků podle pravidla nonzero (nebo evenodd). */
function fillMask(polygons: readonly Point[][], evenOdd: boolean): Uint8Array {
  const mask = new Uint8Array(MASK_SAMPLES * MASK_SAMPLES);
  const unit = SVG_SIDE / MASK_SAMPLES;
  for (let row = 0; row < MASK_SAMPLES; row += 1) {
    const y = (row + 0.5) * unit;
    const crossings: { x: number; winding: number }[] = [];
    for (const polygon of polygons) {
      for (let index = 0; index < polygon.length; index += 1) {
        const from = polygon[index];
        const to = polygon[(index + 1) % polygon.length];
        if (from === undefined || to === undefined || from.y === to.y) {
          continue;
        }
        const goesDown = to.y > from.y;
        const top = goesDown ? from : to;
        const bottom = goesDown ? to : from;
        if (y < top.y || y >= bottom.y) {
          continue;
        }
        const x = top.x + ((y - top.y) / (bottom.y - top.y)) * (bottom.x - top.x);
        crossings.push({ x, winding: goesDown ? 1 : -1 });
      }
    }
    crossings.sort((first, second) => first.x - second.x);
    let winding = 0;
    for (let index = 0; index < crossings.length - 1; index += 1) {
      const crossing = crossings[index];
      const next = crossings[index + 1];
      if (crossing === undefined || next === undefined) {
        continue;
      }
      winding += evenOdd ? 1 : crossing.winding;
      const inside = evenOdd ? winding % 2 !== 0 : winding !== 0;
      if (!inside) {
        continue;
      }
      const firstColumn = Math.max(0, Math.ceil(crossing.x / unit - 0.5));
      const lastColumn = Math.min(MASK_SAMPLES - 1, Math.ceil(next.x / unit - 0.5) - 1);
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        mask[row * MASK_SAMPLES + column] = 1;
      }
    }
  }
  return mask;
}

/** Nejvyšší průhlednost výplně (u přechodu nejvyšší `stop-opacity`). */
function fillAlpha(element: Element, elements: readonly Element[]): number {
  const fill = element.attributes.fill;
  if (fill === 'none') {
    return 0;
  }
  const opacity =
    number(element.attributes, 'opacity', 1) * number(element.attributes, 'fill-opacity', 1);
  const gradient = /^url\(#([^)]+)\)$/.exec(fill ?? '');
  if (gradient === null) {
    return opacity;
  }
  const id = gradient[1];
  const start = elements.findIndex((candidate) => candidate.attributes.id === id);
  // Zastávky přechodu jsou prvky `stop` hned za ním.
  const stops: Element[] = [];
  for (const candidate of elements.slice(start + 1)) {
    if (candidate.name !== 'stop') {
      break;
    }
    stops.push(candidate);
  }
  const highest = Math.max(0, ...stops.map((stop) => number(stop.attributes, 'stop-opacity', 1)));
  return opacity * highest;
}

const SHAPES = new Set(['path', 'circle', 'ellipse', 'use']);

/** Maska neprůhledných vzorků SVG ikony. */
export function maskOfSvg(svg: string): IconMask {
  const elements = elementsOf(svg);
  const byId = new Map<string, Element>();
  for (const element of elements) {
    const id = element.attributes.id;
    if (id !== undefined && SHAPES.has(element.name)) {
      byId.set(id, element);
    }
  }
  const clips = new Map<string, Point[][]>();
  for (const element of elements) {
    if (element.clipPathId !== null && SHAPES.has(element.name)) {
      const polygons = clips.get(element.clipPathId) ?? [];
      polygons.push(...polygonsOfElement(element, byId));
      clips.set(element.clipPathId, polygons);
    }
  }
  const opaque = new Uint8Array(MASK_SAMPLES * MASK_SAMPLES);
  for (const element of elements) {
    const drawn =
      SHAPES.has(element.name) &&
      !element.parents.some((parent) => parent === 'defs' || parent === 'clipPath');
    if (!drawn) {
      continue;
    }
    const target =
      element.name === 'use' ? byId.get((element.attributes.href ?? '').replace('#', '')) : element;
    const fillSource =
      element.attributes.fill === undefined && target !== undefined ? target : element;
    if (fillAlpha(fillSource, elements) <= 0) {
      continue;
    }
    const evenOdd = fillSource.attributes['fill-rule'] === 'evenodd';
    const shape = fillMask(polygonsOfElement(element, byId), evenOdd);
    const clipId = /^url\(#([^)]+)\)$/.exec(element.attributes['clip-path'] ?? '')?.[1];
    const clip = clipId === undefined ? null : fillMask(clips.get(clipId) ?? [], false);
    for (let index = 0; index < shape.length; index += 1) {
      if (shape[index] === 1 && (clip === null || clip[index] === 1)) {
        opaque[index] = 1;
      }
    }
  }
  return { samples: MASK_SAMPLES, opaque };
}

const masks = new Map<ToolId, IconPoint[]>();

/**
 * Neprůhledné body ikony nástroje jako díly strany jejího čtverce (středy
 * vzorků mřížky). Spočítá se jednou na nástroj.
 */
export function opaqueIconPoints(tool: ToolId): readonly IconPoint[] {
  const cached = masks.get(tool);
  if (cached !== undefined) {
    return cached;
  }
  const mask = maskOfSvg(iconSvgOf(tool));
  const points: IconPoint[] = [];
  for (let row = 0; row < mask.samples; row += 1) {
    for (let column = 0; column < mask.samples; column += 1) {
      if (mask.opaque[row * mask.samples + column] === 1) {
        points.push({ u: (column + 0.5) / mask.samples, v: (row + 0.5) / mask.samples });
      }
    }
  }
  masks.set(tool, points);
  return points;
}

/**
 * O kolik se může skutečná hrana ikony lišit od středu vzorku: polovina
 * úhlopříčky vzorku jako díl strany ikony.
 */
export const SAMPLE_REACH_SHARE = Math.SQRT1_2 / MASK_SAMPLES;
