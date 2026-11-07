/**
 * Kódování vrstvy barev Omalovánek do krátkého textu (#92 AC6), synchronně
 * a bez knihoven.
 *
 * - Pixely obrysu se přeskočí, jejich barvu dá obrys.
 * - Každý pixel se předpoví z posledního neobrysového pixelu ve stejném
 *   sloupci nad ním (jako filtr „Up“ v PNG, i přes čáru obrysu). Nahoře
 *   je předpověď „bez barvy“.
 * - Zapíšou se jen pixely, kde předpověď nesedí: počet správně
 *   předpovězených pixelů před nimi (Exp-Golomb kód) a skutečná hodnota
 *   jako jedna z 8 zbývajících (3 bity).
 * - Bity se skládají po 15 do jednoho znaku z rozsahu U+1000 až U+8FFF
 *   (žádné řídicí znaky ani půlky dvojic UTF-16), takže jde o obyčejný
 *   text pro `localStorage`.
 *
 * Svislé pruhy z AC6 se tak zapíšou jen v prvním řádku, okraj tahu
 * stojí zhruba jeden znak na řádek. Čistý TypeScript bez Phaseru.
 */

import { NO_COLOR, emptyColorLayer } from './coloring';
import { PALETTE } from './palette';
import { OUTLINE_REGION } from './regionMap';
import type { RegionMap } from './regionMap';

/** Hodnota pixelu v kódování: 0 až 7 barvy palety, 8 bez barvy. */
const EMPTY_VALUE = PALETTE.length;

/** Kolik bitů nese hodnota pixelu, když se liší od předpovědi (8 možností). */
const VALUE_BITS = 3;

/** Řád Exp-Golomb kódu pro počet správně předpovězených pixelů. */
const RUN_CODE_ORDER = 3;

/** Nejvíc nul před číslem Exp-Golomb kódu, které dekodér přijme. */
const MAX_RUN_CODE_ZEROS = 26;

const BITS_PER_CHAR = 15;
const FIRST_CHAR_CODE = 0x1000;
const CHAR_VALUE_COUNT = 1 << BITS_PER_CHAR;

/** Hodnota pixelu vrstvy v kódování (barva 0 až 7, jinak bez barvy). */
function valueOf(layerValue: number): number {
  return layerValue < PALETTE.length ? layerValue : EMPTY_VALUE;
}

/** Zápis bitů po 15 do znaků. */
class BitWriter {
  private readonly chars: string[] = [];
  private current = 0;
  private used = 0;

  write(value: number, bitCount: number): void {
    for (let bit = bitCount - 1; bit >= 0; bit -= 1) {
      this.current = (this.current << 1) | (Math.floor(value / 2 ** bit) % 2);
      this.used += 1;
      if (this.used === BITS_PER_CHAR) {
        this.chars.push(String.fromCharCode(FIRST_CHAR_CODE + this.current));
        this.current = 0;
        this.used = 0;
      }
    }
  }

  /** Exp-Golomb kód čísla `value` (0 a víc). */
  writeRunLength(value: number): void {
    const shifted = value + 2 ** RUN_CODE_ORDER;
    const bitLength = Math.floor(Math.log2(shifted)) + 1;
    this.write(0, bitLength - RUN_CODE_ORDER - 1);
    this.write(shifted, bitLength);
  }

  /** Celý text; poslední znak se doplní nulami. */
  finish(): string {
    if (this.used > 0) {
      this.write(0, BITS_PER_CHAR - this.used);
    }
    return this.chars.join('');
  }
}

/** Čtení bitů ze znaků; `null` při konci textu nebo neplatném znaku. */
class BitReader {
  private position = 0;
  private current = 0;
  private left = 0;

  constructor(private readonly text: string) {}

  read(bitCount: number): number | null {
    let value = 0;
    for (let bit = 0; bit < bitCount; bit += 1) {
      if (this.left === 0 && !this.nextChar()) {
        return null;
      }
      this.left -= 1;
      value = value * 2 + ((this.current >> this.left) & 1);
    }
    return value;
  }

  readRunLength(): number | null {
    let zeros = 0;
    for (;;) {
      const bit = this.read(1);
      if (bit === null || zeros > MAX_RUN_CODE_ZEROS) {
        return null;
      }
      if (bit === 1) {
        break;
      }
      zeros += 1;
    }
    const rest = this.read(zeros + RUN_CODE_ORDER);
    if (rest === null) {
      return null;
    }
    return 2 ** (zeros + RUN_CODE_ORDER) + rest - 2 ** RUN_CODE_ORDER;
  }

  /** Zbyly už jen doplňující nuly posledního znaku? */
  isAtPaddedEnd(): boolean {
    const padding = this.current & ((1 << this.left) - 1);
    return this.position === this.text.length && padding === 0;
  }

  private nextChar(): boolean {
    if (this.position >= this.text.length) {
      return false;
    }
    const value = this.text.charCodeAt(this.position) - FIRST_CHAR_CODE;
    this.position += 1;
    if (value < 0 || value >= CHAR_VALUE_COUNT) {
      return false;
    }
    this.current = value;
    this.left = BITS_PER_CHAR;
    return true;
  }
}

/** Hodnota různá od předpovědi jako číslo 0 až 7 (předpověď se vynechá). */
function valueCode(value: number, predicted: number): number {
  return value < predicted ? value : value - 1;
}

function valueFromCode(code: number, predicted: number): number {
  return code < predicted ? code : code + 1;
}

/** Zakóduje vrstvu barev (index palety, `NO_COLOR` bez barvy) do textu. */
export function encodeColorLayer(regions: RegionMap, layer: Uint8Array): string {
  const { width, regionIds } = regions;
  const above = new Uint8Array(width).fill(EMPTY_VALUE);
  const writer = new BitWriter();
  let predictedRun = 0;
  for (let index = 0; index < regionIds.length; index += 1) {
    if (regionIds[index] === OUTLINE_REGION) {
      continue;
    }
    const column = index % width;
    const predicted = above[column] ?? EMPTY_VALUE;
    const value = valueOf(layer[index] ?? NO_COLOR);
    above[column] = value;
    if (value === predicted) {
      predictedRun += 1;
      continue;
    }
    writer.writeRunLength(predictedRun);
    writer.write(valueCode(value, predicted), VALUE_BITS);
    predictedRun = 0;
  }
  // Konec: zbylé pixely odpovídají předpovědi.
  writer.writeRunLength(predictedRun);
  return writer.finish();
}

/** Vrstva barev z textu; `null`, když text nesedí na obrys omalovánky. */
export function decodeColorLayer(regions: RegionMap, text: string): Uint8Array | null {
  const { width, regionIds } = regions;
  const layer = emptyColorLayer(regions);
  const above = new Uint8Array(width).fill(EMPTY_VALUE);
  const reader = new BitReader(text);
  let predictedLeft = reader.readRunLength();
  for (let index = 0; index < regionIds.length; index += 1) {
    if (regionIds[index] === OUTLINE_REGION) {
      continue;
    }
    if (predictedLeft === null) {
      return null;
    }
    const column = index % width;
    const predicted = above[column] ?? EMPTY_VALUE;
    let value = predicted;
    if (predictedLeft > 0) {
      predictedLeft -= 1;
    } else {
      const code = reader.read(VALUE_BITS);
      if (code === null) {
        return null;
      }
      value = valueFromCode(code, predicted);
      predictedLeft = reader.readRunLength();
    }
    above[column] = value;
    if (value !== EMPTY_VALUE) {
      layer[index] = value;
    }
  }
  return predictedLeft === 0 && reader.isAtPaddedEnd() ? layer : null;
}
