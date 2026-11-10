/// <reference types="vite/client" />
/**
 * Testovací část veřejné sady UCI „Pen-Based Recognition of Handwritten
 * Digits“ (CC BY 4.0) převedená na tahy, jak je hře předá Phaser (#41, AC2).
 *
 * Používá se jen `pendigits.tes` (14 pisatelů). `pendigits.tra` slouží jen
 * k přípravě vzorů rozpoznávání a sem nepatří.
 *
 * Soubor se načítá přes Vite (`?raw`), protože projekt nemá typy pro Node
 * a `tsc` kontroluje i testy. Do buildu hry se tím nedostane.
 */

import testSetText from '../../../data/pendigits/pendigits.tes?raw';

/** Bod tahu v pixelech plochy na psaní, osa y míří dolů (Phaser pointer). */
export interface PenPoint {
  readonly x: number;
  readonly y: number;
}

export type PenStroke = readonly PenPoint[];

export interface PenArea {
  readonly width: number;
  readonly height: number;
}

/** Jedna napsaná číslice ze sady: jeden tah s 8 body a správná odpověď. */
export interface PenDigitSample {
  readonly digit: number;
  readonly stroke: PenStroke;
}

/** Plocha na psaní, do které se číslice ze sady zvětší (nejmenší podle AC7). */
export const WRITING_AREA: PenArea = { width: 320, height: 320 };

/** Rozsah souřadnic v sadě UCI. */
const UCI_MAX = 100;

/** Počet čísel na řádku: 8 bodů (x, y) a číslice. */
const VALUES_PER_LINE = 17;

/**
 * Převede jeden řádek UCI na tah v ploše `area`: zvětší 0–100 na pixely
 * a překlopí osu y (v UCI míří nahoru, ve hře dolů).
 */
export function parsePenDigitLine(line: string, area: PenArea = WRITING_AREA): PenDigitSample {
  const values = line.split(',').map((value) => Number(value.trim()));
  if (values.length !== VALUES_PER_LINE || values.some((value) => !Number.isInteger(value))) {
    throw new Error(`Neplatný řádek sady UCI: „${line}“`);
  }

  const stroke: PenPoint[] = [];
  for (let index = 0; index < 16; index += 2) {
    const x = values[index] ?? 0;
    const y = values[index + 1] ?? 0;
    stroke.push({
      x: (x / UCI_MAX) * area.width,
      y: ((UCI_MAX - y) / UCI_MAX) * area.height,
    });
  }

  return { digit: values[16] ?? -1, stroke };
}

/** Všechny číslice testovací části sady (14 pisatelů, 3 498 číslic). */
export function uciTestSamples(area: PenArea = WRITING_AREA): PenDigitSample[] {
  return testSetText
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => parsePenDigitLine(line, area));
}

/**
 * Zhustí tah: mezi každé dva sousední body vloží `steps - 1` bodů na úsečce.
 * Prst v Phaseru dá mnohem víc bodů než 8, rozpoznávání to nesmí rozhodit.
 */
export function densify(stroke: PenStroke, steps: number): PenStroke {
  const dense: PenPoint[] = [];
  stroke.forEach((point, index) => {
    const next = stroke[index + 1];
    if (!next) {
      dense.push(point);
      return;
    }
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      dense.push({ x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * t });
    }
  });
  return dense;
}

/** Zmenší tah na `scale` a posune ho o `dx`, `dy` (třeba do levé půlky plochy). */
export function placeStroke(stroke: PenStroke, scale: number, dx: number, dy: number): PenStroke {
  return stroke.map((point) => ({ x: point.x * scale + dx, y: point.y * scale + dy }));
}
