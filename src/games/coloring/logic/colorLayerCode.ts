/**
 * Kódování vrstvy barev Omalovánek do krátkého textu (#92 AC6), synchronně
 * a bez knihoven.
 *
 * - Pixely obrysu se přeskočí, jejich barvu dá obrys.
 * - Každý pixel se předpoví z jednoho ze dvou sousedů ve stejném sloupci:
 *   - „nad“: poslední neobrysový pixel nad ním (jako filtr „Up“ v PNG,
 *     i přes čáru obrysu),
 *   - „o dlaždici výš“: poslední neobrysový pixel nad ním, jehož řádek je
 *     od něj vzdálený násobek kroku (u formátu p2 výška dlaždice zrna
 *     pastelky, #93), takže zrno pastelky předpoví samo sebe.
 *   Kterého souseda použít, rozhodne poslední pixel, u kterého měl pravdu
 *   jen jeden z nich; na začátku platí „nad“. Rozhoduje jen to, co už je
 *   zakódované, dekodér tak volí stejně. Nahoře je předpověď „bez barvy“.
 * - Formát p1 (#92) má krok 1: oba sousedé jsou stejní a kódování je
 *   přesně původní, staré záznamy se tak čtou beze změny.
 * - Zapíšou se jen pixely, kde předpověď nesedí: počet správně
 *   předpovězených pixelů před nimi (Exp-Golomb kód) a skutečná hodnota
 *   jako jedna z 8 zbývajících (3 bity).
 * - Bity se skládají po 15 do jednoho znaku z rozsahu U+1000 až U+8FFF
 *   (žádné řídicí znaky ani půlky dvojic UTF-16), takže jde o obyčejný
 *   text pro `localStorage`.
 *
 * Svislé pruhy z AC6 se tak zapíšou jen v prvním řádku, okraj tahu
 * stojí zhruba jeden znak na řádek. Zrno pastelky stojí hlavně první
 * dlaždici řádků a pár znaků na řádek tam, kde zrnitá plocha začíná.
 * Čistý TypeScript bez Phaseru.
 */

import { NO_COLOR, emptyColorLayer } from './coloring';
import { PALETTE } from './palette';
import { OUTLINE_REGION } from './regionMap';
import type { RegionMap } from './regionMap';

/** Verze kódování: p1 z #92, p2 s předpovědí o dlaždici zrna výš (#93). */
export type LayerCodeVersion = 'p1' | 'p2';

/** Verze, ve které se ukládá. */
export const CURRENT_LAYER_CODE: LayerCodeVersion = 'p2';

/**
 * Krok předpovědi „o dlaždici výš“ v řádcích podle verze. U p2 je to pevné
 * číslo, ne výška dlaždice zrna: uložené záznamy se musí číst stejně, i kdyby
 * se zrno později změnilo (pak vznikne nová verze).
 */
export const PREDICTION_STEP: Record<LayerCodeVersion, number> = {
  p1: 1,
  p2: 16,
};

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

/** Který soused pixelu se použije jako předpověď. */
type Neighbour = 'above' | 'tileAbove';

/**
 * Předpověď pixelu ze sousedů ve sloupci. Kodér i dekodér volají pro každý
 * neobrysový pixel nejdřív `predict` a pak `record` se skutečnou hodnotou.
 */
class Predictor {
  /** Poslední neobrysová hodnota v každém sloupci. */
  private readonly above: Uint8Array;
  /** Poslední neobrysová hodnota v každém sloupci pro každý zbytek řádku po dělení krokem. */
  private readonly tileAbove: Uint8Array;
  private chosen: Neighbour = 'above';
  private fromAbove = EMPTY_VALUE;
  private fromTileAbove = EMPTY_VALUE;

  constructor(
    private readonly width: number,
    private readonly step: number,
  ) {
    this.above = new Uint8Array(width).fill(EMPTY_VALUE);
    this.tileAbove = new Uint8Array(width * step).fill(EMPTY_VALUE);
  }

  /** Předpověď pro pixel `index` vrstvy. */
  predict(index: number): number {
    const column = index % this.width;
    this.fromAbove = this.above[column] ?? EMPTY_VALUE;
    this.fromTileAbove = this.tileAbove[this.tileIndex(index)] ?? EMPTY_VALUE;
    return this.chosen === 'above' ? this.fromAbove : this.fromTileAbove;
  }

  /** Skutečná hodnota pixelu `index`, pro který se právě volalo `predict`. */
  record(index: number, value: number): void {
    const aboveRight = value === this.fromAbove;
    const tileAboveRight = value === this.fromTileAbove;
    if (aboveRight && !tileAboveRight) {
      this.chosen = 'above';
    } else if (tileAboveRight && !aboveRight) {
      this.chosen = 'tileAbove';
    }
    this.above[index % this.width] = value;
    this.tileAbove[this.tileIndex(index)] = value;
  }

  private tileIndex(index: number): number {
    const row = Math.floor(index / this.width);
    return (row % this.step) * this.width + (index % this.width);
  }
}

/** Hodnota různá od předpovědi jako číslo 0 až 7 (předpověď se vynechá). */
function valueCode(value: number, predicted: number): number {
  return value < predicted ? value : value - 1;
}

function valueFromCode(code: number, predicted: number): number {
  return code < predicted ? code : code + 1;
}

/**
 * Zakóduje vrstvu barev (index palety, `NO_COLOR` bez barvy) do textu
 * ve verzi `version` (bez ní v té, ve které se ukládá).
 */
export function encodeColorLayer(
  regions: RegionMap,
  layer: Uint8Array,
  version: LayerCodeVersion = CURRENT_LAYER_CODE,
): string {
  const { width, regionIds } = regions;
  const predictor = new Predictor(width, PREDICTION_STEP[version]);
  const writer = new BitWriter();
  let predictedRun = 0;
  for (let index = 0; index < regionIds.length; index += 1) {
    if (regionIds[index] === OUTLINE_REGION) {
      continue;
    }
    const predicted = predictor.predict(index);
    const value = valueOf(layer[index] ?? NO_COLOR);
    predictor.record(index, value);
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

/** Vrstva barev z textu verze `version`; `null`, když text nesedí na obrys omalovánky. */
export function decodeColorLayer(
  regions: RegionMap,
  text: string,
  version: LayerCodeVersion,
): Uint8Array | null {
  const { width, regionIds } = regions;
  const layer = emptyColorLayer(regions);
  const predictor = new Predictor(width, PREDICTION_STEP[version]);
  const reader = new BitReader(text);
  let predictedLeft = reader.readRunLength();
  for (let index = 0; index < regionIds.length; index += 1) {
    if (regionIds[index] === OUTLINE_REGION) {
      continue;
    }
    if (predictedLeft === null) {
      return null;
    }
    const predicted = predictor.predict(index);
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
    predictor.record(index, value);
    if (value !== EMPTY_VALUE) {
      layer[index] = value;
    }
  }
  return predictedLeft === 0 && reader.isAtPaddedEnd() ? layer : null;
}
