/**
 * Ikony nástrojů Omalovánek (#106, schválený styl D „skutečné nástroje
 * šikmo“): štětec, guma, fix, pastelka, duhový štětec, razítkový,
 * puntíkový a proužkový fix, třpytky a sprej jako skutečné předměty
 * s tmavým obrysem. Vybraná barva je na části, která maluje (štětiny,
 * víčko a hrot fixu, tuha, náplň), guma je vždy bez barvy a duhový štětec
 * v barvách duhy. Nástroje leží šikmo hrotem vlevo dolů, sprej stojí.
 *
 * Ikona je čistá data: seznam tvarů v CSS px od levého horního rohu
 * čtverce ikony. Pozdější tvar se kreslí přes dřívější. Tvar s obrysem
 * scéna nejdřív obtáhne tmavou čarou 2 × `outline` a pak vyplní. Úchyt,
 * místa v panelu i hlavička kroku barev kreslí stejné tvary, jen pro jinou
 * velikost čtverce. Čistý TypeScript bez Phaseru.
 *
 * Předměty jsou popsané ve svislém rámu 40 × 40 jednotek hrotem dolů
 * (jako maketa D), oblouky a křivky jsou nahrazené body a výplně uvnitř
 * předmětu (štětiny duhy, náplně, proužky) jsou předem ořezané jeho tvarem.
 */

import { PALETTE, RAINBOW_COLORS } from './palette';
import { TOOL_ICON_STYLE, rgbOf } from './theme';
import type { HandleView, ToolId } from './toolPanel';

/** Bod v CSS px (nebo v jednotkách rámu předmětu). */
export interface IconPoint {
  readonly x: number;
  readonly y: number;
}

/** Barva neprůhledná `#RRGGBB`, `outline` tloušťka tmavého obrysu vně tvaru v CSS px. */
interface ShapeLook {
  readonly color: string;
  readonly outline?: number;
}

/** Tvar ikony: kruh, mnohoúhelník, lomená čára se zaoblenými konci, nebo hvězda. */
export type IconShape =
  | (ShapeLook & {
      readonly kind: 'circle';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    })
  | (ShapeLook & { readonly kind: 'polygon'; readonly points: readonly IconPoint[] })
  | (ShapeLook & {
      readonly kind: 'line';
      readonly points: readonly IconPoint[];
      readonly width: number;
    })
  | (ShapeLook & {
      readonly kind: 'star';
      readonly x: number;
      readonly y: number;
      readonly tips: number;
      readonly outerRadius: number;
      readonly innerRadius: number;
      /** Natočení prvního cípu v radiánech od směru nahoru po směru hodinových ručiček. */
      readonly rotation: number;
    });

/** Ikona nástroje `tool` v barvě `colorHex` (`null` bez barvy) pro čtverec o straně `side` CSS px. */
export function toolIconShapes(
  tool: ToolId,
  colorHex: string | null,
  side: number,
): readonly IconShape[] {
  const paint = colorHex ?? TOOL_ICON_STYLE.noColor;
  return placeOnIcon(TOOL_DRAWINGS[tool](paint), PLACEMENTS[tool], side);
}

/** Hvězda ikony (hvězdička razítkového fixu, jiskra třpytek). */
export type IconStar = Extract<IconShape, { kind: 'star' }>;

/** Vrcholy hvězdy: střídavě vnější a vnitřní poloměr, první cíp natočený o `rotation`. */
export function starPoints(
  star: Pick<IconStar, 'x' | 'y' | 'tips' | 'outerRadius' | 'innerRadius' | 'rotation'>,
): IconPoint[] {
  const count = 2 * star.tips;
  return Array.from({ length: count }, (_, index) => {
    const angle = star.rotation + (index * Math.PI) / star.tips;
    const radius = index % 2 === 0 ? star.outerRadius : star.innerRadius;
    return { x: star.x + radius * Math.sin(angle), y: star.y - radius * Math.cos(angle) };
  });
}

/** Ikona, kterou ukazuje úchyt (#96 AC5, #106 AC6): vybraný nástroj ve vybrané barvě. */
export function handleIconShapes(view: HandleView, side: number): readonly IconShape[] {
  const hex = view.color === null ? null : (PALETTE[view.color]?.hex ?? null);
  return toolIconShapes(view.tool, hex, side);
}

// ---------------------------------------------------------------------------
// Tvary v rámu předmětu (jednotky rámu 40 × 40, hrot dolů)
// ---------------------------------------------------------------------------

/**
 * Tvar v rámu předmětu. `outlined` znamená tmavý obrys, `lineCss` je
 * tloušťka čáry v CSS px (odlesky mají stejnou tloušťku v každé velikosti).
 */
type FrameShape =
  | {
      readonly kind: 'polygon';
      readonly points: readonly IconPoint[];
      readonly color: string;
      readonly outlined: boolean;
    }
  | {
      readonly kind: 'circle';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly color: string;
      readonly outlined: boolean;
    }
  | {
      readonly kind: 'line';
      readonly points: readonly IconPoint[];
      readonly color: string;
      readonly lineCss: number;
    }
  | {
      readonly kind: 'star';
      readonly x: number;
      readonly y: number;
      readonly tips: number;
      readonly outerRadius: number;
      readonly innerRadius: number;
      readonly rotation: number;
      readonly color: string;
      readonly outlined: boolean;
    };

const STYLE = TOOL_ICON_STYLE;

/** Odlesk: neprůhledná bílá čára silná jako obrys. */
const SHINE_CSS = STYLE.outlineCss;

/** Kolik bodů nahradí čtvrtkruh a kolik úsek křivky. */
const QUARTER_STEPS = 4;
const CURVE_STEPS = 8;

function point(x: number, y: number): IconPoint {
  return { x, y };
}

function filled(points: readonly IconPoint[], color: string): FrameShape {
  return { kind: 'polygon', points, color, outlined: true };
}

function inner(points: readonly IconPoint[], color: string): FrameShape {
  return { kind: 'polygon', points, color, outlined: false };
}

function shine(points: readonly IconPoint[], color: string = STYLE.white): FrameShape {
  return { kind: 'line', points, color, lineCss: SHINE_CSS };
}

/** Body oblouku se středem `cx`, `cy` od úhlu `from` do `to` (radiány, 0 = doprava, po směru y dolů). */
function arc(cx: number, cy: number, radius: number, from: number, to: number): IconPoint[] {
  const steps = Math.max(2, Math.ceil((Math.abs(to - from) / (Math.PI / 2)) * QUARTER_STEPS));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / steps;
    return point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  });
}

/** Body kubické křivky od `start` přes kontrolní body `c1`, `c2` do `end` (bez počátečního bodu). */
function curve(start: IconPoint, c1: IconPoint, c2: IconPoint, end: IconPoint): IconPoint[] {
  return Array.from({ length: CURVE_STEPS }, (_, index) => {
    const t = (index + 1) / CURVE_STEPS;
    const u = 1 - t;
    const weight = (a: number, b: number, c: number, d: number): number =>
      u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    return point(weight(start.x, c1.x, c2.x, end.x), weight(start.y, c1.y, c2.y, end.y));
  });
}

/** Obdélník se zaoblenými rohy. */
function roundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): IconPoint[] {
  const r = Math.min(radius, width / 2, height / 2);
  const half = Math.PI / 2;
  return [
    ...arc(x + width - r, y + r, r, -half, 0),
    ...arc(x + width - r, y + height - r, r, 0, half),
    ...arc(x + r, y + height - r, r, half, Math.PI),
    ...arc(x + r, y + r, r, Math.PI, Math.PI + half),
  ];
}

function rect(x: number, y: number, width: number, height: number): IconPoint[] {
  return [point(x, y), point(x + width, y), point(x + width, y + height), point(x, y + height)];
}

/**
 * Průnik mnohoúhelníku `subject` s vypuklým mnohoúhelníkem `clip`
 * (Sutherland–Hodgman): výplň uvnitř předmětu ořezaná jeho tvarem.
 */
function clipPolygon(subject: readonly IconPoint[], clip: readonly IconPoint[]): IconPoint[] {
  const area = signedArea(clip);
  let result: IconPoint[] = [...subject];
  clip.forEach((a, index) => {
    const b = clip[(index + 1) % clip.length] as IconPoint;
    const inside = (p: IconPoint): boolean =>
      ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) * area >= 0;
    const input = result;
    result = [];
    input.forEach((current, currentIndex) => {
      const previous = input[(currentIndex + input.length - 1) % input.length] as IconPoint;
      if (inside(current)) {
        if (!inside(previous)) {
          result.push(crossing(previous, current, a, b));
        }
        result.push(current);
      } else if (inside(previous)) {
        result.push(crossing(previous, current, a, b));
      }
    });
  });
  return result;
}

function signedArea(points: readonly IconPoint[]): number {
  return points.reduce((sum, p, index) => {
    const next = points[(index + 1) % points.length] as IconPoint;
    return sum + p.x * next.y - next.x * p.y;
  }, 0);
}

/** Průsečík úsečky `p`–`q` s přímkou `a`–`b`. */
function crossing(p: IconPoint, q: IconPoint, a: IconPoint, b: IconPoint): IconPoint {
  const side = (s: IconPoint): number => (b.x - a.x) * (s.y - a.y) - (b.y - a.y) * (s.x - a.x);
  const t = side(p) / (side(p) - side(q));
  return point(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
}

/** Pás napříč předmětem od `top` do `bottom` (dost široký, ořízne se tvarem). */
function band(top: number, bottom: number): IconPoint[] {
  return rect(-20, top, 80, bottom - top);
}

/** Barva smíchaná s bílou: díl `share` bílé. */
function lighter(hex: string, share: number): string {
  const channels = rgbOf(hex).map((channel) => Math.round(channel + (255 - channel) * share));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Předměty
// ---------------------------------------------------------------------------

/** Štětec: dřevěná násada a kovová objímka, delší u duhového štětce kvůli větším štětinám. */
function brushBody(ferruleBottom: number): FrameShape[] {
  const ferruleTop = ferruleBottom - 9;
  return [
    filled(
      [point(17.6, -6), point(22.4, -6), point(23.4, ferruleTop + 1), point(16.6, ferruleTop + 1)],
      STYLE.wood,
    ),
    filled(roundedRect(15, ferruleTop, 10, 9, 1.5), STYLE.metal),
  ];
}

const BRISTLES_START = point(15.2, 30);
const BRISTLES: IconPoint[] = [
  BRISTLES_START,
  ...curve(BRISTLES_START, point(13.4, 37), point(16.4, 42.5), point(20, 47)),
  ...curve(point(20, 47), point(23.6, 42.5), point(26.6, 37), point(24.8, 30)),
];

/** Štětec: štětiny namočené v barvě se světlým odleskem. */
function brush(paint: string): FrameShape[] {
  return [
    ...brushBody(30),
    filled(BRISTLES, paint),
    shine([point(17.9, 33.5), point(18.4, 37.5)], STYLE.metal),
  ];
}

/** Velké štětiny duhového štětce: 6 pásů duhy napříč, každý aspoň 3 px i v nejmenším úchytu. */
const RAINBOW_TOP = 22;
const RAINBOW_BAND = 4.6;
const RAINBOW_BRISTLES: IconPoint[] = [
  point(14, RAINBOW_TOP),
  point(26, RAINBOW_TOP),
  ...curve(
    point(26, RAINBOW_TOP),
    point(27.5, 34),
    point(27.5, 44),
    point(20, RAINBOW_TOP + 6 * RAINBOW_BAND + 1),
  ).slice(0, -1),
  ...curve(
    point(20, RAINBOW_TOP + 6 * RAINBOW_BAND + 1),
    point(12.5, 44),
    point(12.5, 34),
    point(14, RAINBOW_TOP),
  ).slice(0, -1),
];

function rainbowBrush(): FrameShape[] {
  const bands = RAINBOW_COLORS.map((colorIndex, index) => {
    const top = RAINBOW_TOP + index * RAINBOW_BAND;
    const bottom = index === RAINBOW_COLORS.length - 1 ? 60 : top + RAINBOW_BAND;
    return inner(
      clipPolygon(RAINBOW_BRISTLES, band(top, bottom)),
      PALETTE[colorIndex]?.hex ?? STYLE.noColor,
    );
  });
  return [...brushBody(RAINBOW_TOP), filled(RAINBOW_BRISTLES, STYLE.white), ...bands];
}

/** Pastelka: tělo v barvě se světlou ploškou, ořezané dřevo a tuha v barvě. */
function crayon(paint: string): FrameShape[] {
  return [
    filled(rect(14, -4, 12, 34), paint),
    inner(rect(18, -4, 4, 34), lighter(paint, STYLE.crayonFacetWhiteShare)),
    filled([point(14, 30), point(26, 30), point(23.5, 40), point(16.5, 40)], STYLE.woodCut),
    filled([point(16.5, 40), point(23.5, 40), point(20, 48)], paint),
  ];
}

/** Fix: bílé tělo, víčko vzadu v barvě s odleskem a bílý úchop k hrotu (končí u `gripTo`). */
function markerBody(paint: string, gripTo: number | null): FrameShape[] {
  const body = [
    filled(roundedRect(13, -6, 14, 32, 4), STYLE.white),
    filled(roundedRect(12, -6, 16, 10, 3.5), paint),
    shine([point(15.6, -2.5), point(15.6, 0.5)]),
  ];
  if (gripTo === null) {
    return body;
  }
  const grip = [point(14.5, 26), point(25.5, 26), point(23.5, gripTo), point(16.5, gripTo)];
  return [...body, filled(grip, STYLE.white)];
}

/** Fix: kulatý hrot v barvě. */
function marker(paint: string): FrameShape[] {
  return [
    ...markerBody(paint, 34),
    filled([point(17.2, 34), point(22.8, 34), ...arc(20, 41.5, 2.8, 0, Math.PI)], paint),
  ];
}

/** Razítkový fix: místo hrotu velká hvězdička. */
function stampMarker(paint: string): FrameShape[] {
  return [
    ...markerBody(paint, 33),
    {
      kind: 'star',
      x: 20,
      y: 39.5,
      tips: 5,
      outerRadius: 7.5,
      innerRadius: 4.2,
      rotation: Math.PI,
      color: paint,
      outlined: true,
    },
  ];
}

/** Puntíkový fix: baňatá lahvička s náplní v barvě, bílý krček a kulatá houbička. */
const DOTS_BOTTLE: IconPoint[] = [
  ...arc(26.5, -1, 3, -Math.PI / 2, 0),
  point(29.5, 18),
  ...curve(point(29.5, 18), point(29.5, 24), point(25, 26), point(24, 28)),
  point(16, 28),
  ...curve(point(16, 28), point(15, 26), point(10.5, 24), point(10.5, 18)),
  ...arc(13.5, -1, 3, Math.PI, (3 * Math.PI) / 2),
];

function dotsMarker(paint: string): FrameShape[] {
  return [
    filled(DOTS_BOTTLE, STYLE.white),
    filled(clipPolygon(DOTS_BOTTLE, band(6, 40)), paint),
    shine([point(14.2, 11), point(14.2, 18)]),
    filled(roundedRect(15, 26.5, 10, 8.5, 1.5), STYLE.white),
    filled([point(12, 35), point(28, 35), ...arc(20, 38, 8, 0, Math.PI)], paint),
  ];
}

/** Proužkový fix: široký plochý hrot s proužky napříč, bez úchopu. */
const STRIPES_TIP: IconPoint[] = [
  point(14.5, 27),
  point(25.5, 27),
  point(27.5, 42),
  point(12.5, 42),
];
const STRIPES_TOP = 27;
const STRIPE_HEIGHT = 5;

function stripesMarker(paint: string): FrameShape[] {
  return [
    ...markerBody(paint, null),
    filled(STRIPES_TIP, STYLE.white),
    inner(clipPolygon(STRIPES_TIP, band(STRIPES_TOP, STRIPES_TOP + STRIPE_HEIGHT)), paint),
    inner(clipPolygon(STRIPES_TIP, band(STRIPES_TOP + 2 * STRIPE_HEIGHT, 60)), paint),
  ];
}

/** Guma: modrý obal a bílá pryž s ohlazeným rohem, vždy bez barvy. */
const ERASER: IconPoint[] = [
  ...arc(15, 0, 3, Math.PI, (3 * Math.PI) / 2),
  ...arc(25, 0, 3, -Math.PI / 2, 0),
  point(28, 36),
  point(23.5, 41),
  ...arc(15, 38, 3, Math.PI / 2, Math.PI),
];

function eraser(): FrameShape[] {
  return [
    filled(ERASER, STYLE.white),
    filled(clipPolygon(ERASER, band(-20, 19)), STYLE.eraserSleeve),
    shine([point(17.5, 3), point(17.5, 10)]),
  ];
}

/** Čtyřcípá jiskra třpytek: baculaté cípy, aby byly u základny aspoň 3 px. */
const SPARKLE_INNER_SHARE = 0.55;

function sparkle(
  x: number,
  y: number,
  radius: number,
  color: string,
  outlined: boolean,
): FrameShape {
  return {
    kind: 'star',
    x,
    y,
    tips: 4,
    outerRadius: radius,
    innerRadius: radius * SPARKLE_INNER_SHARE,
    rotation: 0,
    color,
    outlined,
  };
}

/** Třpytky: lahvička s třpytkami v barvě a bílými jiskrami, z hrdla padají jiskry. */
function glitter(paint: string): FrameShape[] {
  return [
    filled(roundedRect(12.5, -3, 15, 27, 5), paint),
    sparkle(17.5, 4.5, 5.6, STYLE.white, false),
    sparkle(22.5, 15.5, 5.6, STYLE.white, false),
    filled([point(15, 24), point(25, 24), point(22.5, 32), point(17.5, 32)], STYLE.white),
    sparkle(14, 40, 5.6, paint, true),
    sparkle(26, 41, 5.6, paint, true),
  ];
}

/** Sprej: plechovka v barvě s bílým štítkem, bílá hlavička a obláček kapek. */
const SPRAY_CAN: IconPoint[] = [
  point(14, 13),
  ...curve(point(14, 13), point(14, 10), point(27, 10), point(27, 13)),
  ...arc(24, 37, 3, 0, Math.PI / 2),
  ...arc(17, 37, 3, Math.PI / 2, Math.PI),
];

function spray(paint: string): FrameShape[] {
  const drop = (x: number, y: number, radius: number): FrameShape => ({
    kind: 'circle',
    x,
    y,
    radius,
    color: paint,
    outlined: true,
  });
  return [
    filled(roundedRect(16, 2, 9, 9, 1.6), STYLE.white),
    filled(SPRAY_CAN, paint),
    filled(clipPolygon(SPRAY_CAN, band(22, 28)), STYLE.white),
    drop(10.5, 4, 2.4),
    drop(3.5, 7.5, 2.4),
    drop(5, -1, 2.4),
  ];
}

const TOOL_DRAWINGS: Readonly<Record<ToolId, (paint: string) => FrameShape[]>> = {
  brush,
  eraser,
  marker,
  crayon,
  rainbow: rainbowBrush,
  stamp: stampMarker,
  dots: dotsMarker,
  stripes: stripesMarker,
  glitter,
  spray,
};

// ---------------------------------------------------------------------------
// Umístění předmětu do čtverce ikony
// ---------------------------------------------------------------------------

/**
 * Jak předmět leží v ikoně: bod rámu `pivot` přijde do bodu `center`
 * čtverce 40 × 40, předmět se zmenší `scale` a otočí o `angle` radiánů
 * po směru hodinových ručiček (hrot dolů → hrot vlevo dolů).
 */
interface Placement {
  readonly pivot: IconPoint;
  readonly center: IconPoint;
  readonly scale: number;
  readonly angle: number;
}

/** Strana rámu předmětu v jednotkách. */
const FRAME = 40;

/** Šikmé nástroje: o 35° od svislice, aby hrot nezasahoval do šipky otevřeného panelu v úchytu. */
const TILT = (35 * Math.PI) / 180;
const TILTED_SCALE = 0.8;

/** Šikmý nástroj se středem rámu v bodě `x`, `y` čtverce 40 × 40 (vpravo nahoře je víc místa). */
function tilted(x: number, y: number): Placement {
  return { pivot: point(20, 21), center: point(x, y), scale: TILTED_SCALE, angle: TILT };
}

const PLACEMENTS: Readonly<Record<ToolId, Placement>> = {
  brush: tilted(24, 20.5),
  eraser: tilted(25.5, 19.5),
  marker: tilted(24, 21.5),
  crayon: tilted(24, 20.5),
  rainbow: tilted(25, 19),
  stamp: tilted(25.5, 20.5),
  dots: tilted(25, 20),
  stripes: tilted(25.5, 20.5),
  glitter: tilted(27.5, 18),
  // Sprej stojí, jinak by obláček kapek nebyl nad plechovkou.
  spray: { pivot: point(18, 19), center: point(27, 20), scale: 0.86, angle: 0 },
};

function placeOnIcon(
  shapes: readonly FrameShape[],
  placement: Placement,
  side: number,
): IconShape[] {
  const unit = side / FRAME;
  const cos = Math.cos(placement.angle);
  const sin = Math.sin(placement.angle);
  const toIcon = (p: IconPoint): IconPoint => {
    const x = (p.x - placement.pivot.x) * placement.scale;
    const y = (p.y - placement.pivot.y) * placement.scale;
    return point(
      (placement.center.x + x * cos - y * sin) * unit,
      (placement.center.y + x * sin + y * cos) * unit,
    );
  };
  const length = (value: number): number => value * placement.scale * unit;
  const outlineOf = (outlined: boolean): { outline?: number } =>
    outlined ? { outline: STYLE.outlineCss } : {};
  return shapes.map((shape): IconShape => {
    switch (shape.kind) {
      case 'polygon':
        return {
          kind: 'polygon',
          points: shape.points.map(toIcon),
          color: shape.color,
          ...outlineOf(shape.outlined),
        };
      case 'circle': {
        const center = toIcon(shape);
        return {
          kind: 'circle',
          x: center.x,
          y: center.y,
          radius: length(shape.radius),
          color: shape.color,
          ...outlineOf(shape.outlined),
        };
      }
      case 'line':
        return {
          kind: 'line',
          points: shape.points.map(toIcon),
          width: shape.lineCss,
          color: shape.color,
        };
      case 'star': {
        const center = toIcon(shape);
        return {
          kind: 'star',
          x: center.x,
          y: center.y,
          tips: shape.tips,
          outerRadius: length(shape.outerRadius),
          innerRadius: length(shape.innerRadius),
          rotation: shape.rotation + placement.angle,
          color: shape.color,
          ...outlineOf(shape.outlined),
        };
      }
    }
  });
}
