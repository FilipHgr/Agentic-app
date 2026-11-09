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
 *   jako jedna ze zbývajících hodnot (u p1 a p2 jedna z 8, tedy 3 bity,
 *   u p3 jedna z 12, tedy 4 bity).
 * - Formát p4 (#115) zná 64 barev. Pevný počet bitů by u 64 barev stál
 *   6 bitů na hodnotu a nejhorší obrázky by se do limitu nevešly. Hodnota
 *   se proto zapíše jako pořadí v seznamu naposledy zapsaných hodnot
 *   (move-to-front, předpovězená hodnota se v pořadí přeskočí) kódem
 *   Elias gamma: hodnota zapsaná nedávno stojí 1 až 3 bity, nejdál
 *   13 bitů. Předpověď, kroky a délky úseků jsou stejné jako u p3.
 * - Formáty p1 a p2 znají jen 8 barev z #88 a čtou se tak navždy, i když
 *   paleta od #100 má 12 barev. Formát p3 (#100) má hodnotu pixelu pro
 *   12 barev a prázdno, jinak je stejný jako p2. Počet barev každé verze
 *   je pevné číslo, ne délka `PALETTE`, aby se staré záznamy četly stejně.
 *   Formát p4 zná 64 barev bez ohledu na to, kolik jich má paleta; jestli
 *   barvy záznamu paleta zná, kontroluje `savedPicture.ts`.
 * - Bity se skládají po 15 do jednoho znaku z rozsahu U+1000 až U+8FFF
 *   (žádné řídicí znaky ani půlky dvojic UTF-16), takže jde o obyčejný
 *   text pro `localStorage`.
 *
 * Svislé pruhy z AC6 se tak zapíšou jen v prvním řádku, okraj tahu
 * stojí zhruba jeden znak na řádek. Zrno pastelky stojí hlavně první
 * dlaždici řádků a pár znaků na řádek tam, kde zrnitá plocha začíná.
 * Kódování i čtení projde vrstvu jednou (lineární čas) a kromě výsledku
 * alokuje jen pole sousedů (16 řádků) a seznam 65 hodnot.
 * Čistý TypeScript bez Phaseru.
 */

import { NO_COLOR, emptyColorLayer } from './coloring';
import { OUTLINE_REGION } from './regionMap';
import type { RegionMap } from './regionMap';

/**
 * Verze kódování: p1 z #92, p2 s předpovědí o dlaždici zrna výš (#93),
 * p3 jako p2, ale s 12 barvami (#100), p4 jako p3, ale s 64 barvami
 * a hodnotou podle naposledy zapsaných hodnot (#115).
 */
export type LayerCodeVersion = 'p1' | 'p2' | 'p3' | 'p4';

/** Verze, ve které se ukládá. */
export const CURRENT_LAYER_CODE: LayerCodeVersion = 'p4';

/**
 * Krok předpovědi „o dlaždici výš“ v řádcích podle verze. U p2 je to pevné
 * číslo, ne výška dlaždice zrna: uložené záznamy se musí číst stejně, i kdyby
 * se zrno později změnilo (pak vznikne nová verze).
 */
export const PREDICTION_STEP: Record<LayerCodeVersion, number> = {
  p1: 1,
  p2: 16,
  p3: 16,
  p4: 16,
};

/**
 * Kolik barev palety verze zná. Hodnota pixelu v kódování je 0 až
 * počet − 1 pro barvy a hodnota rovná počtu pro „bez barvy“. Pevná čísla:
 * záznamy p1 a p2 vznikly s 8 barvami a tak se musí číst i dál.
 */
export const LAYER_COLOR_COUNT: Record<LayerCodeVersion, number> = {
  p1: 8,
  p2: 8,
  p3: 12,
  p4: 64,
};

/** Kolik barev zná ukládaná verze; víc barev paleta mít nesmí (#115 AC1). */
export const MAX_LAYER_COLOR_COUNT: number = LAYER_COLOR_COUNT[CURRENT_LAYER_CODE];

/**
 * Jak se zapíše hodnota pixelu, který se liší od předpovědi: pevným počtem
 * bitů (p1 až p3), nebo pořadím mezi naposledy zapsanými hodnotami (p4).
 */
type ValueCoding = 'fixedBits' | 'recentRank';

const VALUE_CODING: Record<LayerCodeVersion, ValueCoding> = {
  p1: 'fixedBits',
  p2: 'fixedBits',
  p3: 'fixedBits',
  p4: 'recentRank',
};

/**
 * Kolik bitů nese hodnota pixelu, když se liší od předpovědi: možností je
 * tolik, kolik je barev (všechny hodnoty kromě předpovězené), u 8 barev
 * 3 bity, u 12 barev 4 bity.
 */
function valueBitsFor(colorCount: number): number {
  return Math.ceil(Math.log2(colorCount));
}

/** Řád Exp-Golomb kódu pro počet správně předpovězených pixelů. */
const RUN_CODE_ORDER = 3;

/** Nejvíc nul před číslem Exp-Golomb kódu, které dekodér přijme. */
const MAX_RUN_CODE_ZEROS = 26;

const BITS_PER_CHAR = 15;
const FIRST_CHAR_CODE = 0x1000;
const CHAR_VALUE_COUNT = 1 << BITS_PER_CHAR;

/** Hodnota pixelu vrstvy v kódování (barva, kterou verze zná, jinak bez barvy). */
function valueOf(layerValue: number, colorCount: number): number {
  return layerValue < colorCount ? layerValue : colorCount;
}

/** Zápis bitů po 15 do znaků. */
class BitWriter {
  private readonly chars: string[] = [];
  private current = 0;
  private used = 0;

  /** Zapíše `bitCount` nejnižších bitů čísla `value` (nejvýš 31 bitů). */
  write(value: number, bitCount: number): void {
    for (let bit = bitCount - 1; bit >= 0; bit -= 1) {
      this.current = (this.current << 1) | ((value >>> bit) & 1);
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

  /** Elias gamma kód čísla `value` (1 a víc). */
  writeGamma(value: number): void {
    const bitLength = Math.floor(Math.log2(value)) + 1;
    this.write(0, bitLength - 1);
    this.write(value, bitLength);
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

  /** Elias gamma kód; `null` při konci textu nebo víc než `maxZeros` nulách. */
  readGamma(maxZeros: number): number | null {
    let zeros = 0;
    for (;;) {
      const bit = this.read(1);
      if (bit === null || zeros > maxZeros) {
        return null;
      }
      if (bit === 1) {
        break;
      }
      zeros += 1;
    }
    const rest = this.read(zeros);
    return rest === null ? null : 2 ** zeros + rest;
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
 * Místo pixelu v polích sousedů spočítá `predict` jednou a `record` ho
 * použije znovu (ukládání po tahu má být rychlé, #115 AC5).
 */
class Predictor {
  /** Poslední neobrysová hodnota v každém sloupci. */
  private readonly above: Uint8Array;
  /** Poslední neobrysová hodnota v každém sloupci pro každý zbytek řádku po dělení krokem. */
  private readonly tileAbove: Uint8Array;
  private chosen: Neighbour = 'above';
  private fromAbove: number;
  private fromTileAbove: number;
  /** Sloupec pixelu z posledního `predict`. */
  private column = 0;
  /** Místo pixelu z posledního `predict` v `tileAbove`. */
  private tile = 0;

  constructor(
    private readonly width: number,
    private readonly step: number,
    /** Hodnota „bez barvy“ ve verzi kódování. */
    private readonly emptyValue: number,
  ) {
    this.above = new Uint8Array(width).fill(emptyValue);
    this.tileAbove = new Uint8Array(width * step).fill(emptyValue);
    this.fromAbove = emptyValue;
    this.fromTileAbove = emptyValue;
  }

  /** Předpověď pro pixel `index` vrstvy. */
  predict(index: number): number {
    this.column = index % this.width;
    const row = (index - this.column) / this.width;
    this.tile = (row % this.step) * this.width + this.column;
    this.fromAbove = this.above[this.column] ?? this.emptyValue;
    this.fromTileAbove = this.tileAbove[this.tile] ?? this.emptyValue;
    return this.chosen === 'above' ? this.fromAbove : this.fromTileAbove;
  }

  /** Skutečná hodnota pixelu, pro který se právě volalo `predict`. */
  record(value: number): void {
    const aboveRight = value === this.fromAbove;
    const tileAboveRight = value === this.fromTileAbove;
    if (aboveRight && !tileAboveRight) {
      this.chosen = 'above';
    } else if (tileAboveRight && !aboveRight) {
      this.chosen = 'tileAbove';
    }
    this.above[this.column] = value;
    this.tileAbove[this.tile] = value;
  }
}

/**
 * Zápis a čtení hodnoty pixelu, který se liší od předpovědi. Kodér
 * i dekodér volají pro každý takový pixel jednou `write`, nebo `read`.
 */
interface ValueCoder {
  write(writer: BitWriter, value: number, predicted: number): void;
  /** Hodnota pixelu; `null` u kódu, který žádnou hodnotu nemá. */
  read(reader: BitReader, predicted: number): number | null;
}

/**
 * Pevný počet bitů (p1 až p3): hodnota jako jedna z hodnot kromě
 * předpovězené, tedy číslo 0 až počet barev − 1.
 */
function fixedBitsCoder(colorCount: number): ValueCoder {
  const valueBits = valueBitsFor(colorCount);
  return {
    write(writer, value, predicted) {
      writer.write(value < predicted ? value : value - 1, valueBits);
    },
    read(reader, predicted) {
      const code = reader.read(valueBits);
      // U 12 barev nesou 4 bity i kódy 12 až 15, které žádnou hodnotu nemají.
      if (code === null || code >= colorCount) {
        return null;
      }
      return code < predicted ? code : code + 1;
    },
  };
}

/**
 * Pořadí mezi naposledy zapsanými hodnotami (p4, move-to-front): seznam
 * všech hodnot od naposledy zapsané. Hodnota se zapíše jako její pořadí
 * v seznamu bez předpovězené hodnoty (ta to být nemůže) kódem Elias gamma
 * a přesune se na začátek. Na začátku je první „bez barvy“, pak barvy
 * od 0. Seznam má 65 míst, hledání v něm je tedy omezené a celé kódování
 * zůstává lineární v počtu pixelů.
 */
function recentRankCoder(colorCount: number): ValueCoder {
  const valueCount = colorCount + 1;
  const order = new Uint8Array(valueCount);
  order[0] = colorCount;
  for (let color = 0; color < colorCount; color += 1) {
    order[color + 1] = color;
  }
  // Nejvyšší pořadí je počet hodnot − 2, gamma kód čísla o jedna většího má tolik nul.
  const maxZeros = Math.floor(Math.log2(valueCount - 1));

  const moveToFront = (position: number): void => {
    const value = order[position] ?? colorCount;
    order.copyWithin(1, 0, position);
    order[0] = value;
  };

  return {
    write(writer, value, predicted) {
      let rank = 0;
      let position = 0;
      // Hodnota v seznamu vždy je (valueOf ji omezí), mez je jen pojistka proti zaseknutí.
      while (position < valueCount - 1 && order[position] !== value) {
        if (order[position] !== predicted) {
          rank += 1;
        }
        position += 1;
      }
      writer.writeGamma(rank + 1);
      moveToFront(position);
    },
    read(reader, predicted) {
      const code = reader.readGamma(maxZeros);
      if (code === null) {
        return null;
      }
      let left = code - 1;
      for (let position = 0; position < valueCount; position += 1) {
        const value = order[position] ?? colorCount;
        if (value === predicted) {
          continue;
        }
        if (left === 0) {
          moveToFront(position);
          return value;
        }
        left -= 1;
      }
      // Pořadí za koncem seznamu žádnou hodnotu nemá.
      return null;
    },
  };
}

function valueCoderFor(version: LayerCodeVersion): ValueCoder {
  const colorCount = LAYER_COLOR_COUNT[version];
  return VALUE_CODING[version] === 'recentRank'
    ? recentRankCoder(colorCount)
    : fixedBitsCoder(colorCount);
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
  const colorCount = LAYER_COLOR_COUNT[version];
  const valueCoder = valueCoderFor(version);
  const predictor = new Predictor(width, PREDICTION_STEP[version], colorCount);
  const writer = new BitWriter();
  let predictedRun = 0;
  for (let index = 0; index < regionIds.length; index += 1) {
    if (regionIds[index] === OUTLINE_REGION) {
      continue;
    }
    const predicted = predictor.predict(index);
    const value = valueOf(layer[index] ?? NO_COLOR, colorCount);
    predictor.record(value);
    if (value === predicted) {
      predictedRun += 1;
      continue;
    }
    writer.writeRunLength(predictedRun);
    valueCoder.write(writer, value, predicted);
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
  const colorCount = LAYER_COLOR_COUNT[version];
  const valueCoder = valueCoderFor(version);
  const predictor = new Predictor(width, PREDICTION_STEP[version], colorCount);
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
      const read = valueCoder.read(reader, predicted);
      if (read === null) {
        return null;
      }
      value = read;
      predictedLeft = reader.readRunLength();
    }
    predictor.record(value);
    if (value !== colorCount) {
      layer[index] = value;
    }
  }
  return predictedLeft === 0 && reader.isAtPaddedEnd() ? layer : null;
}
