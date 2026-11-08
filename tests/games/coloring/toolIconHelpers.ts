/**
 * Pomůcky pro testy ikon nástrojů Omalovánek (#106, schválený styl D
 * „skutečné nástroje šikmo“: štětec, guma, pastelka, čtyři fixy s bílým
 * tělem a víčkem v barvě, lahvička třpytek a plechovka spreje). Ikona je
 * čistá data: seznam tvarů z navržené funkce
 * `toolIconShapes(tool, colorHex, side)` v `src/games/coloring/logic/toolIcons.ts`.
 * Scéna tvary jen kreslí, testy si je samy „nakreslí“ na mřížku
 * (rasterizace níže), aby šlo měřit pixely bez Phaseru a nezávisle na kódu hry.
 *
 * Navržené tvary (souřadnice v CSS px od levého horního rohu čtverce ikony
 * o straně `side`; tvar smí přesahovat čtverec, pozdější tvar kreslí přes
 * dřívější):
 * - `circle` kruh se středem `x`, `y` a poloměrem `radius`,
 * - `polygon` mnohoúhelník z bodů `points` (oblouky a křivky makety jsou
 *   nahrazené body, ořez je spočítaný předem),
 * - `line` lomená čára přes `points` o tloušťce `width` se zaoblenými konci
 *   a spoji,
 * - `star` hvězda se středem `x`, `y`, `tips` cípy, vnější poloměr
 *   `outerRadius`, vnitřní `innerRadius`, první cíp natočený o `rotation`
 *   radiánů od směru nahoru po směru hodinových ručiček (hvězdička
 *   razítkového fixu, jiskry třpytek).
 * Každý tvar má neprůhlednou barvu `color` `#RRGGBB` (žádná průhlednost,
 * odlesk je samostatná světlejší barva) a volitelně `outline`: tloušťku
 * tmavého obrysu #1D1D1F v CSS px vně tvaru (scéna obtáhne tvar čarou
 * 2 × `outline` a pak ho vyplní, jako `paint-order: stroke` v maketě).
 * Tvar v barvě #1D1D1F je také obrys (tmavé dělicí čáry).
 *
 * Rasterizace: mřížka má `samples` vzorků na CSS px, vzorek patří tvaru,
 * když jeho střed leží uvnitř, a obrysu, když je vně a blíž než `outline`.
 * Kolem ikony je okraj `pad` vzorků, aby byl vidět i přesah a pozadí za ním.
 */

import { toolSlotIcon, handleFace } from '../../../src/games/coloring/logic/coloringLayout';
import { PALETTE, RAINBOW_COLORS } from '../../../src/games/coloring/logic/palette';
import { toolIconShapes } from '../../../src/games/coloring/logic/toolIcons';
import type { IconShape } from '../../../src/games/coloring/logic/toolIcons';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { boxOfRect } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { TOOL_NAMES } from './lineSizeHelpers';

export { TOOL_NAMES };

/** Tmavý obrys ikon (otázka 3: každá barva má obrys #1D1D1F). */
export const OUTLINE = '#1D1D1F';

/** Pozadí míst v panelu i úchytu (otázka 4: zůstává #E5F0FF). */
export const SLOT_BACKGROUND = '#E5F0FF';

/** Nejmenší kontrast barevné části nebo obrysu vůči pozadí (AC3). */
export const MIN_CONTRAST = 3;

/** Nejmenší rozměr části, mezery i obrysu v CSS px (AC5). */
export const MIN_PART_CSS = 3;

/** Hvězdička razítka a jiskra třpytek: průměr a šířka cípu u základny (AC5). */
export const MIN_STAR_DIAMETER_CSS = 6;
export const MIN_TIP_BASE_CSS = 3;

/** Odstup ikony od okraje místa jako díl strany místa (AC2). */
export const MIN_MARGIN_SHARE = 0.1;

/**
 * Navržené hranice AC5 pro styl D (viz PROBLÉMY V ZADÁNÍ): původní strop
 * 2 barev a 7 částí byl psaný pro styl B. Předmět D má kromě vybrané
 * barvy materiál (bílé tělo fixu, dřevo a kov štětce, ořezané dřevo
 * pastelky), fixy mají víčko, proužek a úchop. Podle makety D bez
 * tenkých odlesků: nejvýš 3 barvy a 10 částí, duha 6 barev duhy a nejvýš
 * 2 další, guma podle AC nejvýš 3 části.
 */
export const MAX_COLORS = 3;
export const MAX_RAINBOW_EXTRA_COLORS = 2;
export const MAX_PARTS = 10;
export const MAX_ERASER_PARTS = 3;

/**
 * Navržená hranice AC4 pro styl D (viz PROBLÉMY V ZADÁNÍ): rozdíl se měří
 * včetně barev (pixel se liší, když ho má jen jedna ikona, nebo ho obě
 * mají v jiné barvě). Dvojice se stejným tělem a jiným hrotem (fix,
 * razítkový a proužkový fix, štětec a duhový štětec) mají v maketě D
 * rozdíl 14 až 20 %, proto u nich stačí 10 %, u ostatních platí 25 % z AC.
 */
export const MIN_DIFFERENCE = 0.25;
export const MIN_SAME_BODY_DIFFERENCE = 0.1;
export const SAME_BODY_PAIRS: ReadonlyArray<readonly [ToolId, ToolId]> = [
  ['marker', 'stamp'],
  ['marker', 'stripes'],
  ['stamp', 'stripes'],
  ['brush', 'rainbow'],
];

/** Pozadí, vůči kterým se měří kontrast (AC3), s šířkou modrého okraje v CSS px. */
export interface IconBackground {
  readonly name: string;
  readonly color: string;
  readonly borderCss: number;
}

/** Modrý okraj označeného místa (AC3, #105) a úchytu (#96) v CSS px. */
export const MARKED_BORDER_CSS = 5;
export const HANDLE_BORDER_CSS = 3;

export const ICON_BACKGROUNDS: readonly IconBackground[] = [
  { name: 'místo v panelu', color: SLOT_BACKGROUND, borderCss: 2 },
  { name: 'označené místo v panelu', color: SLOT_BACKGROUND, borderCss: MARKED_BORDER_CSS },
  { name: 'úchyt', color: SLOT_BACKGROUND, borderCss: HANDLE_BORDER_CSS },
];

/** Barva, se kterou se ikona kreslí: 12 barev palety a „bez barvy“ (`null`). */
export interface IconColor {
  readonly name: string;
  readonly hex: string | null;
}

export const ICON_COLORS: readonly IconColor[] = [
  ...PALETTE.map((color) => ({ name: color.id, hex: color.hex })),
  { name: 'bez barvy', hex: null },
];

/** Odstíny duhy (#97) jako `#RRGGBB`. */
export const RAINBOW_HEXES: readonly string[] = RAINBOW_COLORS.map(
  (index) => PALETTE[index]?.hex ?? '',
);

export const TOOLS: readonly ToolId[] = PANEL_TOOLS;

/** Nástroje, které malují vybranou barvou (guma je bez barvy, duha v duze). */
export const COLOR_TOOLS: readonly ToolId[] = TOOLS.filter(
  (tool) => tool !== 'eraser' && tool !== 'rainbow',
);

/** Nejvýš tolik problémů se vypíše, aby zpráva zůstala čitelná. */
const MAX_PROBLEMS = 5;

export function limited(problems: string[]): string[] {
  return problems.length > MAX_PROBLEMS
    ? [...problems.slice(0, MAX_PROBLEMS), `… a dalších ${problems.length - MAX_PROBLEMS}`]
    : problems;
}

export function sameHex(first: string, second: string): boolean {
  return first.toUpperCase() === second.toUpperCase();
}

// ---------------------------------------------------------------------------
// Tvary
// ---------------------------------------------------------------------------

export interface Point {
  readonly x: number;
  readonly y: number;
}

type StarShape = Extract<IconShape, { kind: 'star' }>;

/** Obrys tvaru v CSS px (0 = bez obrysu). */
export function outlineOf(shape: IconShape): number {
  return shape.outline ?? 0;
}

/** Vrcholy hvězdy: střídavě vnější a vnitřní poloměr, první cíp natočený o `rotation`. */
export function starPoints(shape: StarShape): Point[] {
  const count = 2 * shape.tips;
  return Array.from({ length: count }, (_, index) => {
    const angle = shape.rotation + (index * Math.PI) / shape.tips;
    const radius = index % 2 === 0 ? shape.outerRadius : shape.innerRadius;
    return { x: shape.x + radius * Math.sin(angle), y: shape.y - radius * Math.cos(angle) };
  });
}

/** Šířka cípu hvězdy u základny: vzdálenost dvou sousedních vnitřních vrcholů. */
export function tipBaseWidth(shape: StarShape): number {
  return 2 * shape.innerRadius * Math.sin(Math.PI / shape.tips);
}

/** Obdélník, do kterého se tvar celý vejde i s obrysem (u čáry i s tloušťkou). */
export function shapeBounds(shape: IconShape): Box {
  const outline = outlineOf(shape);
  switch (shape.kind) {
    case 'circle':
      return {
        left: shape.x - shape.radius - outline,
        right: shape.x + shape.radius + outline,
        top: shape.y - shape.radius - outline,
        bottom: shape.y + shape.radius + outline,
      };
    case 'polygon':
      return boundsOfPoints(shape.points, outline);
    case 'line':
      return boundsOfPoints(shape.points, shape.width / 2 + outline);
    case 'star':
      return boundsOfPoints(starPoints(shape), outline);
  }
}

function boundsOfPoints(points: readonly Point[], grow: number): Box {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: Math.min(...xs) - grow,
    right: Math.max(...xs) + grow,
    top: Math.min(...ys) - grow,
    bottom: Math.max(...ys) + grow,
  };
}

/** Obdélník celé ikony (všech tvarů i s obrysem). */
export function iconBounds(shapes: readonly IconShape[]): Box {
  const all = shapes.map(shapeBounds);
  return {
    left: Math.min(...all.map((bounds) => bounds.left)),
    right: Math.max(...all.map((bounds) => bounds.right)),
    top: Math.min(...all.map((bounds) => bounds.top)),
    bottom: Math.max(...all.map((bounds) => bounds.bottom)),
  };
}

/** Ikona zvětšená `factor`krát i s obrysem (přepočet na jinou velikost, AC1). */
export function scaledShapes(shapes: readonly IconShape[], factor: number): IconShape[] {
  const point = (p: Point): Point => ({ x: p.x * factor, y: p.y * factor });
  return shapes.map((shape): IconShape => {
    const outline = shape.outline === undefined ? {} : { outline: shape.outline * factor };
    switch (shape.kind) {
      case 'circle':
        return {
          ...shape,
          ...outline,
          x: shape.x * factor,
          y: shape.y * factor,
          radius: shape.radius * factor,
        };
      case 'polygon':
        return { ...shape, ...outline, points: shape.points.map(point) };
      case 'line':
        return {
          ...shape,
          ...outline,
          points: shape.points.map(point),
          width: shape.width * factor,
        };
      case 'star':
        return {
          ...shape,
          ...outline,
          x: shape.x * factor,
          y: shape.y * factor,
          outerRadius: shape.outerRadius * factor,
          innerRadius: shape.innerRadius * factor,
        };
    }
  });
}

/** Ikona posunutá o `dx`, `dy` CSS px (do místa v panelu, AC4). */
export function movedShapes(shapes: readonly IconShape[], dx: number, dy: number): IconShape[] {
  const point = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  return shapes.map((shape): IconShape => {
    switch (shape.kind) {
      case 'circle':
      case 'star':
        return { ...shape, x: shape.x + dx, y: shape.y + dy };
      case 'polygon':
      case 'line':
        return { ...shape, points: shape.points.map(point) };
    }
  });
}

/** Ikona nástroje `tool` v barvě `color` pro čtverec o straně `side` CSS px (s mezipamětí). */
const shapeCache = new Map<string, readonly IconShape[]>();

export function iconOf(tool: ToolId, color: string | null, side: number): readonly IconShape[] {
  const key = `${tool}|${String(color)}|${side}`;
  let shapes = shapeCache.get(key);
  if (shapes === undefined) {
    shapes = toolIconShapes(tool, color, side);
    shapeCache.set(key, shapes);
  }
  return shapes;
}

// ---------------------------------------------------------------------------
// Rasterizace
// ---------------------------------------------------------------------------

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function insidePolygon(p: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i] as Point;
    const b = points[j] as Point;
    const crosses =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToPolyline(p: Point, points: readonly Point[], closed: boolean): number {
  if (points.length === 1) {
    const only = points[0] as Point;
    return Math.hypot(p.x - only.x, p.y - only.y);
  }
  let nearest = Infinity;
  const segments = closed ? points.length : points.length - 1;
  for (let index = 0; index < segments; index += 1) {
    const a = points[index] as Point;
    const b = points[(index + 1) % points.length] as Point;
    nearest = Math.min(nearest, distanceToSegment(p, a, b));
  }
  return nearest;
}

/** Vzdálenost bodu od výplně tvaru v CSS px (0 uvnitř). */
function distanceOutside(shape: IconShape, p: Point): number {
  switch (shape.kind) {
    case 'circle':
      return Math.max(0, Math.hypot(p.x - shape.x, p.y - shape.y) - shape.radius);
    case 'polygon':
      return insidePolygon(p, shape.points) ? 0 : distanceToPolyline(p, shape.points, true);
    case 'line':
      return Math.max(0, distanceToPolyline(p, shape.points, false) - shape.width / 2);
    case 'star': {
      const points = starPoints(shape);
      return insidePolygon(p, points) ? 0 : distanceToPolyline(p, points, true);
    }
  }
}

/** Ikona nakreslená na mřížku: index barvy v `colors`, nebo -1 (průhledné, pozadí). */
export interface IconRaster {
  /** Počet vzorků na straně mřížky včetně okraje. */
  readonly size: number;
  readonly samples: number;
  readonly pad: number;
  readonly colors: readonly string[];
  readonly cells: Int16Array;
}

export const TRANSPARENT = -1;

/** Střed vzorku `index` v CSS px od rohu čtverce ikony. */
export function cellCenter(raster: IconRaster, index: number): Point {
  const column = index % raster.size;
  const row = Math.floor(index / raster.size);
  return {
    x: (column - raster.pad + 0.5) / raster.samples,
    y: (row - raster.pad + 0.5) / raster.samples,
  };
}

function colorIndexOf(colors: string[], color: string): number {
  const upper = color.toUpperCase();
  const found = colors.indexOf(upper);
  if (found >= 0) {
    return found;
  }
  colors.push(upper);
  return colors.length - 1;
}

/**
 * Nakreslí tvary na mřížku čtverce o straně `side` CSS px s `samples`
 * vzorky na CSS px a okrajem `padCss` CSS px kolem.
 */
export function rasterize(
  shapes: readonly IconShape[],
  side: number,
  samples = 1,
  padCss = 0,
): IconRaster {
  const pad = Math.ceil(padCss * samples);
  const size = Math.ceil(side * samples) + 2 * pad;
  const cells = new Int16Array(size * size).fill(TRANSPARENT);
  const colors: string[] = [];
  const outlineIndex = colorIndexOf(colors, OUTLINE);
  for (const shape of shapes) {
    const colorIndex = colorIndexOf(colors, shape.color);
    const outline = outlineOf(shape);
    const bounds = shapeBounds(shape);
    const fromColumn = Math.max(0, Math.floor(bounds.left * samples) + pad - 1);
    const toColumn = Math.min(size - 1, Math.ceil(bounds.right * samples) + pad + 1);
    const fromRow = Math.max(0, Math.floor(bounds.top * samples) + pad - 1);
    const toRow = Math.min(size - 1, Math.ceil(bounds.bottom * samples) + pad + 1);
    for (let row = fromRow; row <= toRow; row += 1) {
      for (let column = fromColumn; column <= toColumn; column += 1) {
        const p = { x: (column - pad + 0.5) / samples, y: (row - pad + 0.5) / samples };
        const distance = distanceOutside(shape, p);
        if (distance === 0) {
          cells[row * size + column] = colorIndex;
        } else if (distance < outline) {
          cells[row * size + column] = outlineIndex;
        }
      }
    }
  }
  return { size, samples, pad, colors, cells };
}

/** Barva vzorku, nebo `null` u pozadí. */
export function colorOfCell(raster: IconRaster, index: number): string | null {
  const value = raster.cells[index] ?? TRANSPARENT;
  return value === TRANSPARENT ? null : (raster.colors[value] ?? null);
}

export function isOutlineCell(raster: IconRaster, index: number): boolean {
  const color = colorOfCell(raster, index);
  return color !== null && sameHex(color, OUTLINE);
}

/** Barevný vzorek: neprůhledný a ne obrys. */
export function isColorCell(raster: IconRaster, index: number): boolean {
  const color = colorOfCell(raster, index);
  return color !== null && !sameHex(color, OUTLINE);
}

/** Neprůhledné vzorky (maska ikony včetně obrysu). */
export function maskOf(raster: IconRaster): Uint8Array {
  return Uint8Array.from(raster.cells, (value) => (value === TRANSPARENT ? 0 : 1));
}

/** Barvy, které jsou v ikoně opravdu vidět, bez obrysu. */
export function visibleColors(raster: IconRaster): string[] {
  const seen = new Set<string>();
  raster.cells.forEach((value) => {
    const color = value === TRANSPARENT ? null : raster.colors[value];
    if (color !== undefined && color !== null && !sameHex(color, OUTLINE)) {
      seen.add(color);
    }
  });
  return [...seen];
}

// ---------------------------------------------------------------------------
// Měření na mřížce
// ---------------------------------------------------------------------------

const NEIGHBOURS_8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** Posuny vzorků do vzdálenosti `radius` (Euklidovsky, ve vzorcích). */
export function discOffsets(radius: number): Array<readonly [number, number]> {
  const reach = Math.floor(radius);
  const offsets: Array<readonly [number, number]> = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (dx * dx + dy * dy <= radius * radius) {
        offsets.push([dx, dy]);
      }
    }
  }
  return offsets;
}

/**
 * Souvislé skupiny vzorků (sousedství 8) splňující `include`, kde sousedi
 * patří k sobě, když `together(a, b)`.
 */
export function components(
  raster: IconRaster,
  include: (index: number) => boolean,
  together: (first: number, second: number) => boolean = () => true,
): number[][] {
  const { size } = raster;
  const seen = new Uint8Array(size * size);
  const found: number[][] = [];
  for (let start = 0; start < size * size; start += 1) {
    if (seen[start] === 1 || !include(start)) {
      continue;
    }
    const group: number[] = [];
    const queue = [start];
    seen[start] = 1;
    while (queue.length > 0) {
      const index = queue.pop() as number;
      group.push(index);
      const column = index % size;
      const row = Math.floor(index / size);
      for (const [dx, dy] of NEIGHBOURS_8) {
        const x = column + dx;
        const y = row + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) {
          continue;
        }
        const next = y * size + x;
        if (seen[next] === 0 && include(next) && together(index, next)) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    found.push(group);
  }
  return found;
}

/**
 * Oddělené části ikony (výklad AC5 podle story-revieweru): souvislá plocha
 * jedné barvy bez obrysu. Bílé tělo fixu je také část.
 */
export function colorParts(raster: IconRaster): number[][] {
  return components(
    raster,
    (index) => isColorCell(raster, index),
    (first, second) => raster.cells[first] === raster.cells[second],
  );
}

/** Díry: průhledné plochy, které se nedotýkají okraje mřížky (mezery uvnitř ikony). */
export function holes(raster: IconRaster): number[][] {
  const { size } = raster;
  const touchesEdge = (index: number): boolean => {
    const column = index % size;
    const row = Math.floor(index / size);
    return column === 0 || row === 0 || column === size - 1 || row === size - 1;
  };
  return components(raster, (index) => raster.cells[index] === TRANSPARENT).filter(
    (group) => !group.some(touchesEdge),
  );
}

/**
 * Vejde se do skupiny kruh o průměru `diameterCss`? Hledá vzorek, kolem
 * kterého jsou do vzdálenosti `diameter / 2 − 1 vzorek` jen vzorky skupiny
 * (rezerva na mřížku).
 */
export function fitsDisc(
  raster: IconRaster,
  group: readonly number[],
  diameterCss: number,
): boolean {
  const { size } = raster;
  const member = new Uint8Array(size * size);
  group.forEach((index) => {
    member[index] = 1;
  });
  const offsets = discOffsets((diameterCss / 2) * raster.samples - 1);
  return group.some((index) => {
    const column = index % size;
    const row = Math.floor(index / size);
    return offsets.every(([dx, dy]) => {
      const x = column + dx;
      const y = row + dy;
      return x >= 0 && y >= 0 && x < size && y < size && member[y * size + x] === 1;
    });
  });
}

/**
 * Vzorky, které mají do vzdálenosti `distanceCss` (méně 1 vzorek rezervy)
 * pozadí. Mřížka musí mít okraj, aby pozadí za hranou ikony bylo vidět.
 */
export function nearBackground(raster: IconRaster, distanceCss: number): Uint8Array {
  const { size } = raster;
  const near = new Uint8Array(size * size);
  const offsets = discOffsets(distanceCss * raster.samples - 1);
  for (let index = 0; index < size * size; index += 1) {
    if (raster.cells[index] !== TRANSPARENT || !touchesOpaque(raster, index)) {
      continue;
    }
    const column = index % size;
    const row = Math.floor(index / size);
    for (const [dx, dy] of offsets) {
      const x = column + dx;
      const y = row + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) {
        near[y * size + x] = 1;
      }
    }
  }
  return near;
}

function touchesOpaque(raster: IconRaster, index: number): boolean {
  const { size } = raster;
  const column = index % size;
  const row = Math.floor(index / size);
  return NEIGHBOURS_8.some(([dx, dy]) => {
    const x = column + dx;
    const y = row + dy;
    return x >= 0 && y >= 0 && x < size && y < size && raster.cells[y * size + x] !== TRANSPARENT;
  });
}

/**
 * Dvojice oddělených kusů ikony (souvislé neprůhledné plochy), které jsou
 * k sobě blíž než `gapCss` (méně 1 vzorek rezervy): mezera mezi nimi je
 * užší, než dovoluje AC5.
 */
export function narrowGaps(raster: IconRaster, gapCss: number): string[] {
  const { size } = raster;
  const pieces = components(raster, (index) => raster.cells[index] !== TRANSPARENT);
  const label = new Int32Array(size * size).fill(-1);
  pieces.forEach((piece, number) => {
    piece.forEach((index) => {
      label[index] = number;
    });
  });
  const offsets = discOffsets(gapCss * raster.samples - 1);
  const problems = new Set<string>();
  pieces.forEach((piece, number) => {
    for (const index of piece) {
      const column = index % size;
      const row = Math.floor(index / size);
      for (const [dx, dy] of offsets) {
        const x = column + dx;
        const y = row + dy;
        const other = x >= 0 && y >= 0 && x < size && y < size ? (label[y * size + x] ?? -1) : -1;
        if (other >= 0 && other !== number) {
          problems.add(`kusy ${Math.min(number, other) + 1} a ${Math.max(number, other) + 1}`);
        }
      }
    }
  });
  return [...problems];
}

/**
 * Podíl pixelů, ve kterých se dvě ikony na stejné mřížce liší: pixel má
 * jen jedna z nich, nebo ho obě mají v jiné barvě (obrys je také barva).
 * Dělí se počtem pixelů, které má aspoň jedna ikona.
 */
export function differenceShare(first: IconRaster, second: IconRaster): number {
  let differing = 0;
  let union = 0;
  for (let index = 0; index < first.cells.length; index += 1) {
    const a = colorOfCell(first, index);
    const b = colorOfCell(second, index);
    if (a === null && b === null) {
      continue;
    }
    union += 1;
    if (a === null || b === null || !sameHex(a, b)) {
      differing += 1;
    }
  }
  return union === 0 ? 0 : differing / union;
}

// ---------------------------------------------------------------------------
// Velikosti ikon v rozložení (CSS px)
// ---------------------------------------------------------------------------

/** Čtverec ikony v úchytu v CSS px okna. */
export function handleIconBox(testCase: ColoringCase): Box {
  return toCss(boxOfRect(handleFace(testCase.layout.handle, 'medium').icon), testCase.area);
}

/** Čtverec ikony v místě nástroje `index` v panelu v CSS px okna. */
export function slotIconBox(testCase: ColoringCase, index: number): Box {
  const slot = testCase.layout.toolSlots[index];
  if (slot === undefined) {
    throw new Error(`místo nástroje ${index + 1} v rozložení chybí`);
  }
  return toCss(boxOfRect(toolSlotIcon(slot)), testCase.area);
}

/** Čtverec ikony vybraného nástroje v hlavičce kroku barev (#105) v CSS px okna. */
export function colorStepIconBox(testCase: ColoringCase): Box {
  return toCss(boxOfRect(toolSlotIcon(testCase.layout.colorStepTool)), testCase.area);
}

export function sideOfBox(box: Box): number {
  return Math.min(box.right - box.left, box.bottom - box.top);
}
