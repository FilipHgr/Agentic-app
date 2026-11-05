/**
 * Pevná sada 30 zápisů, které nejsou číslice (#41, AC5): 10 teček,
 * 10 krátkých čárek a 10 čmáranic v ploše 320 × 320 px. Sdílí ji
 * `digitRecognition.test.ts` a `phonePortraitRecognition.test.ts` (#56, AC6).
 */

import type { Stroke, StrokePoint } from '../../../src/games/counting/logic/digitRecognition';

import { WRITING_AREA } from './penDigits';

/** Strana plochy, pro kterou je sada nakreslená. */
const SIDE = WRITING_AREA.width;

/** Rovná čára z `from` do `to` jako tah prstem: `points` bodů včetně konců. */
function line(from: StrokePoint, to: StrokePoint, points: number): StrokePoint[] {
  return Array.from({ length: points }, (_, index) => {
    const t = points === 1 ? 0 : index / (points - 1);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/** Lomená čára přes zadané vrcholy, každý úsek zhuštěný na `pointsPerSegment` bodů. */
function polyline(vertices: readonly StrokePoint[], pointsPerSegment: number): StrokePoint[] {
  const points: StrokePoint[] = [];
  vertices.forEach((vertex, index) => {
    const next = vertices[index + 1];
    if (next) {
      points.push(...line(vertex, next, pointsPerSegment).slice(0, -1));
    } else {
      points.push(vertex);
    }
  });
  return points;
}

/**
 * 10 teček: samotné ťuknutí. Prst dá jeden bod, dva stejné body (dolů
 * a nahoru), nebo se při ťuknutí o pixel dva pohne.
 */
export const TAPS: Stroke[][] = [
  [[{ x: 160, y: 160 }]],
  [[{ x: 40, y: 40 }]],
  [[{ x: 280, y: 60 }]],
  [
    [
      { x: 60, y: 280 },
      { x: 60, y: 280 },
    ],
  ],
  [
    [
      { x: 300, y: 300 },
      { x: 300, y: 300 },
    ],
  ],
  [
    [
      { x: 100, y: 200 },
      { x: 101, y: 201 },
    ],
  ],
  [
    [
      { x: 220, y: 120 },
      { x: 221, y: 120 },
      { x: 222, y: 121 },
    ],
  ],
  [
    [
      { x: 160, y: 30 },
      { x: 160, y: 32 },
    ],
  ],
  [
    [
      { x: 20, y: 160 },
      { x: 21, y: 161 },
      { x: 21, y: 162 },
    ],
  ],
  [
    [
      { x: 250, y: 250 },
      { x: 252, y: 249 },
    ],
  ],
];

/** Krátká čárka ze `start` ve směru `angleDegrees`, dlouhá `length` px. */
function shortDash(start: StrokePoint, angleDegrees: number, length: number): Stroke[] {
  const angle = (angleDegrees * Math.PI) / 180;
  const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
  return [line(start, end, 6)];
}

/** 10 krátkých čárek, každá kratší než desetina výšky plochy (32 px). */
export const SHORT_DASHES: Stroke[][] = [
  shortDash({ x: 150, y: 160 }, 0, 20),
  shortDash({ x: 160, y: 140 }, 90, 25),
  shortDash({ x: 60, y: 60 }, 45, 28),
  shortDash({ x: 260, y: 80 }, 135, 30),
  shortDash({ x: 280, y: 280 }, 180, 15),
  shortDash({ x: 80, y: 260 }, 270, 22),
  shortDash({ x: 200, y: 200 }, 315, 31),
  shortDash({ x: 120, y: 100 }, 20, 12),
  shortDash({ x: 40, y: 200 }, 100, 18),
  shortDash({ x: 220, y: 40 }, 250, 26),
];

/** Okraj od kraje plochy, aby čmáranice šla přes celou plochu, ale ne přes její hranu. */
const EDGE = 10;

/**
 * Cikcak přes celou plochu: vrcholy střídavě u levého a pravého okraje
 * (nebo horního a dolního), postupně přes celou výšku (šířku).
 * `vertexCount` vrcholů dává `vertexCount - 2` obratů.
 */
function zigzag(vertexCount: number, vertical: boolean): Stroke[] {
  const far = SIDE - EDGE;
  const vertices = Array.from({ length: vertexCount }, (_, index) => {
    const across = index % 2 === 0 ? EDGE : far;
    const along = EDGE + ((far - EDGE) * index) / (vertexCount - 1);
    return vertical ? { x: along, y: across } : { x: across, y: along };
  });
  return [polyline(vertices, 8)];
}

/** Cikcak s nepravidelnými vrcholy, pořád přes celou plochu a se 7 obraty. */
const IRREGULAR_SCRIBBLES: Stroke[][] = [
  [
    polyline(
      [
        { x: 10, y: 10 },
        { x: 300, y: 60 },
        { x: 30, y: 90 },
        { x: 310, y: 150 },
        { x: 20, y: 170 },
        { x: 290, y: 230 },
        { x: 15, y: 260 },
        { x: 305, y: 280 },
        { x: 40, y: 310 },
      ],
      8,
    ),
  ],
  [
    polyline(
      [
        { x: 10, y: 300 },
        { x: 50, y: 15 },
        { x: 90, y: 310 },
        { x: 140, y: 20 },
        { x: 170, y: 305 },
        { x: 220, y: 10 },
        { x: 260, y: 300 },
        { x: 290, y: 25 },
        { x: 310, y: 310 },
      ],
      8,
    ),
  ],
];

/** 10 čmáranic: cikcak aspoň se 6 obraty přes celou plochu. */
export const SCRIBBLES: Stroke[][] = [
  zigzag(8, false),
  zigzag(9, false),
  zigzag(10, false),
  zigzag(12, false),
  zigzag(8, true),
  zigzag(9, true),
  zigzag(10, true),
  zigzag(12, true),
  ...IRREGULAR_SCRIBBLES,
];

export const NOT_DIGITS: Stroke[][] = [...TAPS, ...SHORT_DASHES, ...SCRIBBLES];
