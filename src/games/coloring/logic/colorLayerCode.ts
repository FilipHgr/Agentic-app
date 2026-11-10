/**
 * Kódování vrstvy barev Omalovánek do krátkého textu (#92 AC6), synchronně
 * a bez knihoven.
 *
 * - Pixely obrysu se přeskočí, jejich barvu dá obrys.
 * - U formátů p1 až p4 se každý pixel předpoví z jednoho ze dvou sousedů
 *   ve stejném sloupci:
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
 *
 * Formát p5 (#119), ve kterém se ukládá, řeší těsné vodorovné tahy
 * pastelkou, u kterých p4 přetekl limit (o dlaždici výš je jiný tah):
 * - Předpověď má pět kandidátů: nad, vlevo, o dlaždici zrna výš a nad
 *   a vlevo se stejným druhem zrna (mezera, nebo barva zrna). Předpovídá
 *   vybraný kandidát; zůstává, dokud má pravdu, po chybě se vybere první
 *   kandidát, který pravdu měl.
 * - Místo úseků v bitech se každý pixel zapíše adaptivním binárním
 *   aritmetickým kódováním jako v LZMA (15bitové pravděpodobnosti,
 *   posun 5, celočíselně, bez knihovny): bit „předpověď sedí“ ve 20
 *   kontextech (vybraný kandidát × kolik kandidátů se s ním shoduje),
 *   u chyby hodnota jako move-to-front pořadí (jako p4) 6bitovým
 *   adaptivním stromem. Pixel, který předpověď téměř jistě trefí, tak
 *   stojí zlomek bitu.
 * - Výstupní bajty se skládají po 15 bitech do stejné znakové sady.
 *   Dekodér musí přečíst přesně celý text: zkrácený nebo prodloužený
 *   záznam odmítne (`null`).
 *
 * Kódování i čtení projde vrstvu jednou (lineární čas) a kromě výsledku
 * alokuje jen pole sousedů (16 řádků, u p5 navíc 2 řádky podle zrna),
 * seznam 65 hodnot a u p5 výstupní znaky. Čtení poškozeného záznamu
 * skončí nejpozději po posledním pixelu obrázku.
 * Čistý TypeScript bez Phaseru.
 */

import { NO_COLOR, emptyColorLayer } from './coloring';
import { OUTLINE_REGION } from './regionMap';
import type { RegionMap } from './regionMap';

/**
 * Verze kódování: p1 z #92, p2 s předpovědí o dlaždici zrna výš (#93),
 * p3 jako p2, ale s 12 barvami (#100), p4 jako p3, ale s 64 barvami
 * a hodnotou podle naposledy zapsaných hodnot (#115), p5 s pěti kandidáty
 * předpovědi a aritmetickým kódováním (#119).
 */
export type LayerCodeVersion = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';

/** Verze, ve které se ukládá. */
export const CURRENT_LAYER_CODE: LayerCodeVersion = 'p5';

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
  p5: 16,
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
  p5: 64,
};

/** Kolik barev zná ukládaná verze; víc barev paleta mít nesmí (#115 AC1). */
export const MAX_LAYER_COLOR_COUNT: number = LAYER_COLOR_COUNT[CURRENT_LAYER_CODE];

/**
 * Jak se zapíše hodnota pixelu, který se liší od předpovědi: pevným počtem
 * bitů (p1 až p3), nebo pořadím mezi naposledy zapsanými hodnotami (p4).
 */
type ValueCoding = 'fixedBits' | 'recentRank';

/** Verze s bitovým zápisem úseků správně předpovězených pixelů (p1 až p4). */
type RunLengthVersion = Exclude<LayerCodeVersion, 'p5'>;

const VALUE_CODING: Record<RunLengthVersion, ValueCoding> = {
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

function valueCoderFor(version: RunLengthVersion): ValueCoder {
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
  if (version === 'p5') {
    return encodeP5Layer(regions, layer);
  }
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
  if (version === 'p5') {
    return decodeP5Layer(regions, text);
  }
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

// ---------------------------------------------------------------------------
// Formát p5 (#119): pět kandidátů předpovědi a adaptivní aritmetické kódování.
// ---------------------------------------------------------------------------

/**
 * Zrno pastelky, jak ho zná formát p5 (kopie dlaždice z `crayonGrain.ts`
 * z doby #119): „x“ je mezera, „.“ barva, čtverečky 2 × 2 pixely. Je
 * pevné, aby se záznamy p5 četly stejně, i kdyby se zrno pastelky
 * později změnilo (pak vznikne nová verze). Že dnes sedí, hlídá test.
 */
const P5_GRAIN_CELLS: readonly string[] = [
  '.x...x..',
  '...x...x',
  'x...x.x.',
  '..x..x..',
  '.x.x...x',
  'x.....x.',
  '..x.x..x',
  'x..x.x..',
];

const P5_GRAIN_CELL = 2;

/** Strana dlaždice zrna formátu p5 v pixelech (16, stejně jako krok „o dlaždici výš“). */
const P5_TILE_SIZE = P5_GRAIN_CELLS.length * P5_GRAIN_CELL;

/** Druh zrna po pixelech dlaždice p5: 1 = mezera, 0 = barva. */
const P5_GRAIN_KINDS: Uint8Array = buildP5GrainKinds();

function buildP5GrainKinds(): Uint8Array {
  const kinds = new Uint8Array(P5_TILE_SIZE * P5_TILE_SIZE);
  for (let y = 0; y < P5_TILE_SIZE; y += 1) {
    const row = P5_GRAIN_CELLS[Math.floor(y / P5_GRAIN_CELL)] ?? '';
    for (let x = 0; x < P5_TILE_SIZE; x += 1) {
      kinds[y * P5_TILE_SIZE + x] = row[Math.floor(x / P5_GRAIN_CELL)] === 'x' ? 1 : 0;
    }
  }
  return kinds;
}

/** Je pixel (x, y) podle formátu p5 v mezeře zrna pastelky? */
export function isP5GrainGap(x: number, y: number): boolean {
  return P5_GRAIN_KINDS[(y % P5_TILE_SIZE) * P5_TILE_SIZE + (x % P5_TILE_SIZE)] === 1;
}

/** Přesnost pravděpodobností aritmetického kódování v bitech (jako v LZMA, jen jemněji). */
const PROBABILITY_BITS = 15;
const PROBABILITY_ONE = 1 << PROBABILITY_BITS;
/** O kolik se pravděpodobnost po každém bitu posune k pravdě (posun 5 = o 1/32). */
const ADAPT_SHIFT = 5;
/** Pod touto šířkou intervalu se vysune další bajt. */
const RANGE_TOP = 2 ** 24;
const FULL_RANGE = 0xffffffff;
const CARRY_LIMIT = 2 ** 32;
/** Bajty, které na konci kodér vysune, aby dekodér měl celé číslo intervalu. */
const FLUSH_BYTES = 5;
/** Kolik bajtů přečte dekodér na začátku (první bajt LZMA je vždy 0 a nezapisuje se). */
const START_BYTES = 4;

/**
 * Zápis bajtů do znaků po 15 bitech (stejná znaková sada jako p1 až p4).
 * Poslední znak se doplní nulami.
 */
class ByteCharWriter {
  private readonly codes: number[] = [];
  private bits = 0;
  private bitCount = 0;

  writeByte(byte: number): void {
    this.bits = (this.bits << 8) | byte;
    this.bitCount += 8;
    if (this.bitCount >= BITS_PER_CHAR) {
      this.bitCount -= BITS_PER_CHAR;
      this.codes.push(FIRST_CHAR_CODE + (this.bits >>> this.bitCount));
      this.bits &= (1 << this.bitCount) - 1;
    }
  }

  finish(): string {
    if (this.bitCount > 0) {
      this.codes.push(FIRST_CHAR_CODE + (this.bits << (BITS_PER_CHAR - this.bitCount)));
      this.bits = 0;
      this.bitCount = 0;
    }
    return textOfCharCodes(this.codes);
  }
}

/** Kolik kódů znaků se předá `String.fromCharCode` naráz (mez počtu argumentů). */
const CHAR_CHUNK = 8192;

function textOfCharCodes(codes: readonly number[]): string {
  const parts: string[] = [];
  for (let start = 0; start < codes.length; start += CHAR_CHUNK) {
    parts.push(String.fromCharCode(...codes.slice(start, start + CHAR_CHUNK)));
  }
  return parts.join('');
}

/**
 * Čtení bajtů ze znaků. Po konci textu nebo neplatném znaku vrací 0
 * a nastaví `failed`, dekodér pak záznam odmítne.
 */
class ByteCharReader {
  failed = false;
  private position = 0;
  private bits = 0;
  private bitCount = 0;

  constructor(private readonly text: string) {}

  readByte(): number {
    while (this.bitCount < 8) {
      if (this.position >= this.text.length) {
        this.failed = true;
        return 0;
      }
      const value = this.text.charCodeAt(this.position) - FIRST_CHAR_CODE;
      this.position += 1;
      if (value < 0 || value >= CHAR_VALUE_COUNT) {
        this.failed = true;
        return 0;
      }
      this.bits = (this.bits << BITS_PER_CHAR) | value;
      this.bitCount += BITS_PER_CHAR;
    }
    this.bitCount -= 8;
    const byte = this.bits >>> this.bitCount;
    this.bits &= (1 << this.bitCount) - 1;
    return byte;
  }

  /**
   * Přečetl dekodér přesně celý text? Poslední znak musel být potřeba
   * a zbytek za posledním bajtem jsou doplňující nuly. Prodloužený text
   * tak neprojde, zkrácený skončí už chybou čtení.
   */
  isAtPaddedEnd(): boolean {
    return !this.failed && this.position === this.text.length && this.bits === 0;
  }
}

/** Nové pole adaptivních pravděpodobností, všechny na začátku 1/2. */
function newProbabilities(count: number): Uint16Array {
  return new Uint16Array(count).fill(PROBABILITY_ONE >>> 1);
}

/**
 * Binární aritmetický kodér jako v LZMA: 32bitový interval, pravděpodobnost
 * nuly v 15 bitech, po každém bitu se posune o 1/32 k pravdě. Celočíselně,
 * kodér i dekodér počítají stejně na každém zařízení.
 */
class RangeEncoder {
  private low = 0;
  private range = FULL_RANGE;
  private cache = 0;
  private cacheSize = 1;
  /** První bajt je vždy 0 (interval nikdy nepřeteče přes začátek), nezapisuje se. */
  private skipFirstByte = true;

  constructor(private readonly output: ByteCharWriter) {}

  encodeBit(probabilities: Uint16Array, index: number, bit: number): void {
    const probability = probabilities[index] ?? 0;
    const bound = (this.range >>> PROBABILITY_BITS) * probability;
    if (bit === 0) {
      this.range = bound;
      probabilities[index] = probability + ((PROBABILITY_ONE - probability) >>> ADAPT_SHIFT);
    } else {
      this.low += bound;
      this.range -= bound;
      probabilities[index] = probability - (probability >>> ADAPT_SHIFT);
    }
    while (this.range < RANGE_TOP) {
      this.range *= 256;
      this.shiftLow();
    }
  }

  /** Celý zápis: vysune zbytek intervalu a vrátí text. */
  finish(): string {
    for (let byte = 0; byte < FLUSH_BYTES; byte += 1) {
      this.shiftLow();
    }
    return this.output.finish();
  }

  /** Vysune horní bajt intervalu; bajty 0xFF čekají, dokud není jasný přenos. */
  private shiftLow(): void {
    if (this.low < 0xff000000 || this.low >= CARRY_LIMIT) {
      const carry = this.low >= CARRY_LIMIT ? 1 : 0;
      let byte = this.cache;
      for (; this.cacheSize > 0; this.cacheSize -= 1) {
        this.emit((byte + carry) & 0xff);
        byte = 0xff;
      }
      this.cache = (this.low >>> 24) & 0xff;
    }
    this.cacheSize += 1;
    this.low = (this.low & 0x00ffffff) * 256;
  }

  private emit(byte: number): void {
    if (this.skipFirstByte) {
      this.skipFirstByte = false;
      return;
    }
    this.output.writeByte(byte);
  }
}

/** Dekodér k `RangeEncoder`. */
class RangeDecoder {
  private range = FULL_RANGE;
  private code = 0;

  constructor(private readonly input: ByteCharReader) {
    for (let byte = 0; byte < START_BYTES; byte += 1) {
      this.code = this.code * 256 + input.readByte();
    }
  }

  /**
   * Platí `code < range`? U platného záznamu vždy. Stačí ho ověřit na
   * začátku: dekódování ho pak zachová, takže ani poškozená data
   * nevyrobí číslo mimo 32 bitů.
   */
  isValid(): boolean {
    return this.code < this.range;
  }

  decodeBit(probabilities: Uint16Array, index: number): number {
    const probability = probabilities[index] ?? 0;
    const bound = (this.range >>> PROBABILITY_BITS) * probability;
    let bit: number;
    if (this.code < bound) {
      this.range = bound;
      probabilities[index] = probability + ((PROBABILITY_ONE - probability) >>> ADAPT_SHIFT);
      bit = 0;
    } else {
      this.code -= bound;
      this.range -= bound;
      probabilities[index] = probability - (probability >>> ADAPT_SHIFT);
      bit = 1;
    }
    while (this.range < RANGE_TOP) {
      this.range *= 256;
      this.code = this.code * 256 + this.input.readByte();
    }
    return bit;
  }
}

/** Kandidáti předpovědi formátu p5 v pořadí, ve kterém se zkouší po chybě. */
const CANDIDATE_COUNT = 5;
const ABOVE = 0;
const LEFT = 1;
const TILE_ABOVE = 2;
const ABOVE_SAME_GRAIN = 3;
const LEFT_SAME_GRAIN = 4;

/** Kolik stupňů shody kandidátů rozlišuje kontext bitu „předpověď sedí“. */
const AGREEMENT_LEVELS = 4;

/** Kolik kontextů má bit „předpověď sedí“: vybraný kandidát × stupeň shody (20). */
const HIT_CONTEXT_COUNT = CANDIDATE_COUNT * AGREEMENT_LEVELS;

/** Stupeň shody podle počtu kandidátů (1 až 5) s hodnotou předpovědi. */
function agreementLevel(agreeing: number): number {
  if (agreeing === CANDIDATE_COUNT) {
    return 3;
  }
  if (agreeing === CANDIDATE_COUNT - 1) {
    return 2;
  }
  return agreeing >= 2 ? 1 : 0;
}

/** Hodnota pixelu, který se liší od předpovědi, je pořadí 0 až 63 v 6 bitech. */
const RANK_BITS = 6;

/**
 * Předpověď formátu p5 z pěti kandidátů:
 * - nad: poslední neobrysový pixel nad ním ve sloupci,
 * - vlevo: poslední neobrysový pixel vlevo v řádku,
 * - o dlaždici výš: poslední neobrysový pixel nad ním o násobek 16 řádků,
 * - nad a vlevo se stejným druhem zrna (mezera, nebo barva zrna pastelky).
 * Předpovídá vybraný kandidát. Zůstává, dokud má pravdu; po chybě se
 * vybere první kandidát, který pravdu měl (když žádný, zůstane).
 * Rozhoduje jen to, co už je zakódované, dekodér tak volí stejně.
 * Kodér i dekodér volají pro každý neobrysový pixel `predict`, pak
 * `record` se skutečnou hodnotou; mezi nimi platí `hitContext`.
 */
class CandidatePredictor {
  private readonly above: Uint8Array;
  private readonly tileAbove: Uint8Array;
  /** Nad se stejným druhem zrna: pole pro barvu zrna, za ním pole pro mezeru. */
  private readonly aboveSameGrain: Uint8Array;
  private left: number;
  private leftOnColorGrain: number;
  private leftOnGrainGap: number;
  // Kandidáti posledního `predict` v jednotlivých proměnných (ukládání po
  // tahu má být rychlé, AC5).
  private fromAbove: number;
  private fromLeft: number;
  private fromTileAbove: number;
  private fromAboveSameGrain: number;
  private fromLeftSameGrain: number;
  private chosen = ABOVE;
  private agreeing = 0;
  private column = 0;
  private tile = 0;
  private grainColumn = 0;
  private grainGap = 0;
  /** Řádek uvnitř dlaždice zrna pro řádek z posledního `startRow`. */
  private tileRow = 0;

  constructor(
    private readonly width: number,
    private readonly emptyValue: number,
  ) {
    this.above = new Uint8Array(width).fill(emptyValue);
    this.tileAbove = new Uint8Array(width * P5_TILE_SIZE).fill(emptyValue);
    this.aboveSameGrain = new Uint8Array(width * 2).fill(emptyValue);
    this.left = emptyValue;
    this.leftOnColorGrain = emptyValue;
    this.leftOnGrainGap = emptyValue;
    this.fromAbove = emptyValue;
    this.fromLeft = emptyValue;
    this.fromTileAbove = emptyValue;
    this.fromAboveSameGrain = emptyValue;
    this.fromLeftSameGrain = emptyValue;
  }

  /** Začátek řádku `row`: vlevo zatím nic není. */
  startRow(row: number): void {
    this.tileRow = row % P5_TILE_SIZE;
    this.left = this.emptyValue;
    this.leftOnColorGrain = this.emptyValue;
    this.leftOnGrainGap = this.emptyValue;
  }

  predict(column: number): number {
    const { emptyValue, tileRow } = this;
    const grainGap = P5_GRAIN_KINDS[tileRow * P5_TILE_SIZE + (column % P5_TILE_SIZE)] ?? 0;
    this.column = column;
    this.tile = tileRow * this.width + column;
    this.grainGap = grainGap;
    this.grainColumn = grainGap * this.width + column;
    const fromAbove = this.above[column] ?? emptyValue;
    const fromLeft = this.left;
    const fromTileAbove = this.tileAbove[this.tile] ?? emptyValue;
    const fromAboveSameGrain = this.aboveSameGrain[this.grainColumn] ?? emptyValue;
    const fromLeftSameGrain = grainGap === 1 ? this.leftOnGrainGap : this.leftOnColorGrain;
    this.fromAbove = fromAbove;
    this.fromLeft = fromLeft;
    this.fromTileAbove = fromTileAbove;
    this.fromAboveSameGrain = fromAboveSameGrain;
    this.fromLeftSameGrain = fromLeftSameGrain;
    const predicted = this.candidate(this.chosen);
    this.agreeing =
      (fromAbove === predicted ? 1 : 0) +
      (fromLeft === predicted ? 1 : 0) +
      (fromTileAbove === predicted ? 1 : 0) +
      (fromAboveSameGrain === predicted ? 1 : 0) +
      (fromLeftSameGrain === predicted ? 1 : 0);
    return predicted;
  }

  /**
   * Kontext bitu „předpověď sedí“ pro pixel z posledního `predict`:
   * vybraný kandidát a kolik kandidátů se s předpovědí shoduje (všech pět,
   * čtyři, dva nebo tři, jen on sám). Čím víc se jich shoduje, tím spíš
   * předpověď sedí.
   */
  hitContext(): number {
    return this.chosen * AGREEMENT_LEVELS + agreementLevel(this.agreeing);
  }

  record(value: number): void {
    if (this.candidate(this.chosen) !== value) {
      this.chosen = this.firstCandidateWith(value);
    }
    this.above[this.column] = value;
    this.tileAbove[this.tile] = value;
    this.aboveSameGrain[this.grainColumn] = value;
    this.left = value;
    if (this.grainGap === 1) {
      this.leftOnGrainGap = value;
    } else {
      this.leftOnColorGrain = value;
    }
  }

  private candidate(candidate: number): number {
    switch (candidate) {
      case LEFT:
        return this.fromLeft;
      case TILE_ABOVE:
        return this.fromTileAbove;
      case ABOVE_SAME_GRAIN:
        return this.fromAboveSameGrain;
      case LEFT_SAME_GRAIN:
        return this.fromLeftSameGrain;
      default:
        return this.fromAbove;
    }
  }

  /** První kandidát s hodnotou `value`; když ji žádný neměl, zůstane vybraný. */
  private firstCandidateWith(value: number): number {
    for (let candidate = 0; candidate < CANDIDATE_COUNT; candidate += 1) {
      if (this.candidate(candidate) === value) {
        return candidate;
      }
    }
    return this.chosen;
  }
}

/**
 * Seznam hodnot od naposledy zapsané (move-to-front) pro formát p5.
 * Pořadí hodnoty se počítá bez předpovězené hodnoty, takže 65 hodnot
 * (64 barev a „bez barvy“) dá pořadí 0 až 63.
 */
class RecentValues {
  private readonly order: Uint8Array;

  constructor(private readonly colorCount: number) {
    this.order = new Uint8Array(colorCount + 1);
    this.order[0] = colorCount;
    for (let color = 0; color < colorCount; color += 1) {
      this.order[color + 1] = color;
    }
  }

  /** Pořadí hodnoty `value` (různé od `predicted`) a její přesun na začátek. */
  takeRank(value: number, predicted: number): number {
    const { order } = this;
    let rank = 0;
    let position = 0;
    // Hodnota v seznamu vždy je (valueOf ji omezí), mez je jen pojistka proti zaseknutí.
    while (position < order.length - 1 && order[position] !== value) {
      if (order[position] !== predicted) {
        rank += 1;
      }
      position += 1;
    }
    this.moveToFront(position);
    return rank;
  }

  /** Hodnota s pořadím `rank` (bez `predicted`) a její přesun na začátek. */
  takeValue(rank: number, predicted: number): number {
    const { order } = this;
    let left = rank;
    for (let position = 0; position < order.length; position += 1) {
      const value = order[position] ?? this.colorCount;
      if (value === predicted) {
        continue;
      }
      if (left === 0) {
        this.moveToFront(position);
        return value;
      }
      left -= 1;
    }
    // Pořadí 0 až 63 má vždy hodnotu; sem se dojde jen při chybě v programu.
    return this.colorCount;
  }

  private moveToFront(position: number): void {
    const value = this.order[position] ?? this.colorCount;
    this.order.copyWithin(1, 0, position);
    this.order[0] = value;
  }
}

/** Adaptivní pravděpodobnosti modelu p5: bit „sedí“ po kontextech a strom pořadí. */
interface P5Probabilities {
  readonly hit: Uint16Array;
  readonly rank: Uint16Array;
}

function newP5Probabilities(): P5Probabilities {
  return {
    hit: newProbabilities(HIT_CONTEXT_COUNT),
    rank: newProbabilities(1 << RANK_BITS),
  };
}

/** Bit „sedí“ je 0, když pixel odpovídá předpovědi (častější případ). */
const HIT = 0;
const MISS = 1;

function encodeP5Layer(regions: RegionMap, layer: Uint8Array): string {
  const { width, height, regionIds } = regions;
  const colorCount = LAYER_COLOR_COUNT.p5;
  const predictor = new CandidatePredictor(width, colorCount);
  const recent = new RecentValues(colorCount);
  const probabilities = newP5Probabilities();
  const encoder = new RangeEncoder(new ByteCharWriter());
  for (let row = 0; row < height; row += 1) {
    predictor.startRow(row);
    const rowStart = row * width;
    for (let column = 0; column < width; column += 1) {
      const index = rowStart + column;
      if (regionIds[index] === OUTLINE_REGION) {
        continue;
      }
      const predicted = predictor.predict(column);
      const value = valueOf(layer[index] ?? NO_COLOR, colorCount);
      const context = predictor.hitContext();
      predictor.record(value);
      if (value === predicted) {
        encoder.encodeBit(probabilities.hit, context, HIT);
        continue;
      }
      encoder.encodeBit(probabilities.hit, context, MISS);
      const rank = recent.takeRank(value, predicted);
      let node = 1;
      for (let bit = RANK_BITS - 1; bit >= 0; bit -= 1) {
        const rankBit = (rank >>> bit) & 1;
        encoder.encodeBit(probabilities.rank, node, rankBit);
        node = (node << 1) | rankBit;
      }
    }
  }
  return encoder.finish();
}

function decodeP5Layer(regions: RegionMap, text: string): Uint8Array | null {
  const { width, height, regionIds } = regions;
  const layer = emptyColorLayer(regions);
  const colorCount = LAYER_COLOR_COUNT.p5;
  const predictor = new CandidatePredictor(width, colorCount);
  const recent = new RecentValues(colorCount);
  const probabilities = newP5Probabilities();
  const reader = new ByteCharReader(text);
  const decoder = new RangeDecoder(reader);
  if (!decoder.isValid()) {
    return null;
  }
  for (let row = 0; row < height; row += 1) {
    // Zkrácený text nebo neplatný znak: dál nemá smysl číst.
    if (reader.failed) {
      return null;
    }
    predictor.startRow(row);
    const rowStart = row * width;
    for (let column = 0; column < width; column += 1) {
      const index = rowStart + column;
      if (regionIds[index] === OUTLINE_REGION) {
        continue;
      }
      const predicted = predictor.predict(column);
      const context = predictor.hitContext();
      let value = predicted;
      if (decoder.decodeBit(probabilities.hit, context) === MISS) {
        let node = 1;
        for (let bit = 0; bit < RANK_BITS; bit += 1) {
          node = (node << 1) | decoder.decodeBit(probabilities.rank, node);
        }
        value = recent.takeValue(node - (1 << RANK_BITS), predicted);
      }
      predictor.record(value);
      if (value !== colorCount) {
        layer[index] = value;
      }
    }
  }
  return reader.isAtPaddedEnd() ? layer : null;
}
