/**
 * Čtení průhlednosti (alfa kanálu) z obrázku WebP pro testy (#169 AC1):
 * kontejner RIFF, blok `VP8X` s rozměrem a blok `ALPH` s průhledností.
 * Barevnou část (`VP8 `) test nepotřebuje, a tak ji nečte.
 *
 * Blok `ALPH` je buď nezkomprimovaný, nebo zkomprimovaný bezeztrátově
 * stejně jako WebP lossless (VP8L, RFC 9649) s průhledností v zeleném
 * kanálu. Tady je dekodér VP8L podle specifikace, bez cizí knihovny
 * (projekt nemá žádnou závislost na čtení obrázků). Nakonec se vrátí
 * filtrování z hlavičky bloku (vodorovné, svislé, přechodové).
 */

/** Průhlednost obrázku: hodnota 0–255 pro každý bod po řádcích. */
export interface AlphaPlane {
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

interface Chunk {
  readonly type: string;
  readonly data: Uint8Array;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function littleEndian(bytes: Uint8Array, start: number, length: number): number {
  let value = 0;
  for (let index = length - 1; index >= 0; index -= 1) {
    value = value * 256 + (bytes[start + index] ?? 0);
  }
  return value;
}

function chunksOf(bytes: Uint8Array): Chunk[] {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    throw new Error('není WebP');
  }
  const chunks: Chunk[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = littleEndian(bytes, offset + 4, 4);
    chunks.push({
      type: ascii(bytes, offset, 4),
      data: bytes.subarray(offset + 8, offset + 8 + size),
    });
    offset += 8 + size + (size % 2);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Čtení bitů (od nejnižšího bitu bajtu)
// ---------------------------------------------------------------------------

class BitReader {
  private readonly bytes: Uint8Array;
  private position = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  read(count: number): number {
    let value = 0;
    for (let bit = 0; bit < count; bit += 1) {
      value |= this.readBit() << bit;
    }
    return value >>> 0;
  }

  readBit(): number {
    const byte = this.bytes[this.position >> 3];
    if (byte === undefined) {
      throw new Error('konec dat VP8L');
    }
    const bit = (byte >> (this.position & 7)) & 1;
    this.position += 1;
    return bit;
  }
}

// ---------------------------------------------------------------------------
// Prefixové (Huffmanovy) kódy
// ---------------------------------------------------------------------------

const MAX_CODE_LENGTH = 15;

/** Kanonický prefixový kód: počty kódů podle délky a symboly podle pořadí. */
interface PrefixCode {
  /** Kód s jediným symbolem nečte žádný bit. */
  readonly single: number | null;
  readonly counts: Int32Array;
  readonly symbols: Int32Array;
}

function codeFromLengths(lengths: ArrayLike<number>): PrefixCode {
  const used: number[] = [];
  const counts = new Int32Array(MAX_CODE_LENGTH + 1);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol] ?? 0;
    if (length > 0) {
      used.push(symbol);
      counts[length] = (counts[length] ?? 0) + 1;
    }
  }
  if (used.length === 0) {
    throw new Error('prázdný prefixový kód');
  }
  if (used.length === 1) {
    return { single: used[0] ?? 0, counts, symbols: new Int32Array(0) };
  }
  const offsets = new Int32Array(MAX_CODE_LENGTH + 2);
  for (let length = 1; length <= MAX_CODE_LENGTH; length += 1) {
    offsets[length + 1] = (offsets[length] ?? 0) + (counts[length] ?? 0);
  }
  const symbols = new Int32Array(used.length);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol] ?? 0;
    if (length > 0) {
      const slot = offsets[length] ?? 0;
      symbols[slot] = symbol;
      offsets[length] = slot + 1;
    }
  }
  return { single: null, counts, symbols };
}

/** Přečte jeden symbol kódu bit po bitu (kanonický kód jako v deflate). */
function readSymbol(reader: BitReader, code: PrefixCode): number {
  if (code.single !== null) {
    return code.single;
  }
  let value = 0;
  let first = 0;
  let index = 0;
  for (let length = 1; length <= MAX_CODE_LENGTH; length += 1) {
    value |= reader.readBit();
    const count = code.counts[length] ?? 0;
    if (value - first < count) {
      return code.symbols[index + value - first] ?? 0;
    }
    index += count;
    first = (first + count) << 1;
    value <<= 1;
  }
  throw new Error('neplatný prefixový kód');
}

const CODE_LENGTH_ORDER = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function readCodeLengths(reader: BitReader, alphabetSize: number): Uint8Array {
  const lengthCodeLengths = new Uint8Array(CODE_LENGTH_ORDER.length);
  const count = 4 + reader.read(4);
  for (let index = 0; index < count; index += 1) {
    lengthCodeLengths[CODE_LENGTH_ORDER[index] ?? 0] = reader.read(3);
  }
  const lengthCode = codeFromLengths(lengthCodeLengths);
  let maxSymbol = alphabetSize;
  if (reader.read(1) === 1) {
    const lengthBits = 2 + 2 * reader.read(3);
    maxSymbol = 2 + reader.read(lengthBits);
  }
  const lengths = new Uint8Array(alphabetSize);
  let symbol = 0;
  let previous = 8;
  while (symbol < alphabetSize) {
    if (maxSymbol === 0) {
      break;
    }
    maxSymbol -= 1;
    const code = readSymbol(reader, lengthCode);
    if (code < 16) {
      lengths[symbol] = code;
      symbol += 1;
      if (code !== 0) {
        previous = code;
      }
      continue;
    }
    const repeat =
      code === 16 ? 3 + reader.read(2) : code === 17 ? 3 + reader.read(3) : 11 + reader.read(7);
    const value = code === 16 ? previous : 0;
    for (let step = 0; step < repeat && symbol < alphabetSize; step += 1) {
      lengths[symbol] = value;
      symbol += 1;
    }
  }
  return lengths;
}

function readPrefixCode(reader: BitReader, alphabetSize: number): PrefixCode {
  if (reader.read(1) === 0) {
    return codeFromLengths(readCodeLengths(reader, alphabetSize));
  }
  const lengths = new Uint8Array(alphabetSize);
  const symbolCount = reader.read(1) + 1;
  const first = reader.read(reader.read(1) === 1 ? 8 : 1);
  lengths[first] = 1;
  if (symbolCount === 2) {
    lengths[reader.read(8)] = 1;
  }
  return codeFromLengths(lengths);
}

interface CodeGroup {
  readonly green: PrefixCode;
  readonly red: PrefixCode;
  readonly blue: PrefixCode;
  readonly alpha: PrefixCode;
  readonly distance: PrefixCode;
}

function readCodeGroup(reader: BitReader, cacheSize: number): CodeGroup {
  return {
    green: readPrefixCode(reader, 256 + 24 + cacheSize),
    red: readPrefixCode(reader, 256),
    blue: readPrefixCode(reader, 256),
    alpha: readPrefixCode(reader, 256),
    distance: readPrefixCode(reader, 40),
  };
}

// ---------------------------------------------------------------------------
// Obraz VP8L: body, zpětné odkazy (LZ77) a paměť barev
// ---------------------------------------------------------------------------

/** Posuny (x, y) pro krátké vzdálenosti zpětných odkazů (RFC 9649, 5.2.2). */
const DISTANCE_MAP: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, 2],
  [2, 0],
  [1, 2],
  [-1, 2],
  [2, 1],
  [-2, 1],
  [2, 2],
  [-2, 2],
  [0, 3],
  [3, 0],
  [1, 3],
  [-1, 3],
  [3, 1],
  [-3, 1],
  [2, 3],
  [-2, 3],
  [3, 2],
  [-3, 2],
  [0, 4],
  [4, 0],
  [1, 4],
  [-1, 4],
  [4, 1],
  [-4, 1],
  [3, 3],
  [-3, 3],
  [2, 4],
  [-2, 4],
  [4, 2],
  [-4, 2],
  [0, 5],
  [3, 4],
  [-3, 4],
  [4, 3],
  [-4, 3],
  [5, 0],
  [1, 5],
  [-1, 5],
  [5, 1],
  [-5, 1],
  [2, 5],
  [-2, 5],
  [5, 2],
  [-5, 2],
  [4, 4],
  [-4, 4],
  [3, 5],
  [-3, 5],
  [5, 3],
  [-5, 3],
  [0, 6],
  [6, 0],
  [1, 6],
  [-1, 6],
  [6, 1],
  [-6, 1],
  [2, 6],
  [-2, 6],
  [6, 2],
  [-6, 2],
  [4, 5],
  [-4, 5],
  [5, 4],
  [-5, 4],
  [3, 6],
  [-3, 6],
  [6, 3],
  [-6, 3],
  [0, 7],
  [7, 0],
  [1, 7],
  [-1, 7],
  [5, 5],
  [-5, 5],
  [7, 1],
  [-7, 1],
  [4, 6],
  [-4, 6],
  [6, 4],
  [-6, 4],
  [2, 7],
  [-2, 7],
  [7, 2],
  [-7, 2],
  [3, 7],
  [-3, 7],
  [7, 3],
  [-7, 3],
  [5, 6],
  [-5, 6],
  [6, 5],
  [-6, 5],
  [8, 0],
  [4, 7],
  [-4, 7],
  [7, 4],
  [-7, 4],
  [8, 1],
  [8, 2],
  [6, 6],
  [-6, 6],
  [8, 3],
  [5, 7],
  [-5, 7],
  [7, 5],
  [-7, 5],
  [8, 4],
  [6, 7],
  [-6, 7],
  [7, 6],
  [-7, 6],
  [8, 5],
  [7, 7],
  [-7, 7],
  [8, 6],
  [8, 7],
];

function prefixValue(reader: BitReader, symbol: number): number {
  if (symbol < 4) {
    return symbol + 1;
  }
  const extraBits = (symbol - 2) >> 1;
  const offset = (2 + (symbol & 1)) << extraBits;
  return offset + reader.read(extraBits) + 1;
}

function planeDistance(width: number, code: number): number {
  if (code > 120) {
    return code - 120;
  }
  const [dx, dy] = DISTANCE_MAP[code - 1] ?? [0, 0];
  return Math.max(1, dx + dy * width);
}

function subSize(size: number, bits: number): number {
  return Math.ceil(size / (1 << bits));
}

/** Obrázek VP8L po rozbalení: body ARGB po řádcích. */
interface ArgbImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint32Array;
}

interface EntropyImage {
  readonly bits: number;
  readonly image: ArgbImage;
}

class ColorCache {
  private readonly colors: Uint32Array;
  private readonly shift: number;

  constructor(bits: number) {
    this.colors = new Uint32Array(1 << bits);
    this.shift = 32 - bits;
  }

  insert(argb: number): void {
    this.colors[Math.imul(argb, 0x1e35a7bd) >>> this.shift] = argb;
  }

  lookup(index: number): number {
    return this.colors[index] ?? 0;
  }
}

function groupAt(
  groups: readonly CodeGroup[],
  entropy: EntropyImage | null,
  x: number,
  y: number,
): CodeGroup {
  if (entropy === null) {
    return groups[0] as CodeGroup;
  }
  const { bits, image } = entropy;
  const meta = image.pixels[(y >> bits) * image.width + (x >> bits)] ?? 0;
  return groups[(meta >> 8) & 0xffff] as CodeGroup;
}

/** Rozbalí body obrázku (zpětné odkazy, paměť barev) bez transformací. */
function decodePixels(
  reader: BitReader,
  width: number,
  height: number,
  allowMetaCodes: boolean,
): ArgbImage {
  const cacheBits = reader.read(1) === 1 ? reader.read(4) : 0;
  const cache = cacheBits > 0 ? new ColorCache(cacheBits) : null;
  let entropy: EntropyImage | null = null;
  let groupCount = 1;
  if (allowMetaCodes && reader.read(1) === 1) {
    const bits = reader.read(3) + 2;
    const image = decodePixels(reader, subSize(width, bits), subSize(height, bits), false);
    entropy = { bits, image };
    groupCount = 1 + Math.max(...Array.from(image.pixels, (pixel) => (pixel >> 8) & 0xffff));
  }
  const groups: CodeGroup[] = [];
  for (let index = 0; index < groupCount; index += 1) {
    groups.push(readCodeGroup(reader, cacheBits > 0 ? 1 << cacheBits : 0));
  }
  const pixels = new Uint32Array(width * height);
  let position = 0;
  while (position < pixels.length) {
    const x = position % width;
    const y = (position - x) / width;
    const group = groupAt(groups, entropy, x, y);
    const green = readSymbol(reader, group.green);
    if (green < 256) {
      const red = readSymbol(reader, group.red);
      const blue = readSymbol(reader, group.blue);
      const alpha = readSymbol(reader, group.alpha);
      const argb = ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
      pixels[position] = argb;
      cache?.insert(argb);
      position += 1;
    } else if (green < 256 + 24) {
      const length = prefixValue(reader, green - 256);
      const distanceCode = prefixValue(reader, readSymbol(reader, group.distance));
      const distance = planeDistance(width, distanceCode);
      for (let step = 0; step < length && position < pixels.length; step += 1) {
        const argb = pixels[position - distance] ?? 0;
        pixels[position] = argb;
        cache?.insert(argb);
        position += 1;
      }
    } else {
      if (cache === null) {
        throw new Error('odkaz do paměti barev bez paměti');
      }
      const argb = cache.lookup(green - 256 - 24);
      pixels[position] = argb;
      cache.insert(argb);
      position += 1;
    }
  }
  return { width, height, pixels };
}

// ---------------------------------------------------------------------------
// Transformace VP8L
// ---------------------------------------------------------------------------

type Transform =
  | { readonly kind: 'predictor'; readonly width: number; readonly data: EntropyImage }
  | { readonly kind: 'color'; readonly width: number; readonly data: EntropyImage }
  | { readonly kind: 'subtractGreen' }
  | {
      readonly kind: 'colorIndexing';
      readonly width: number;
      readonly widthBits: number;
      readonly palette: Uint32Array;
    };

function channel(argb: number, shift: number): number {
  return (argb >>> shift) & 0xff;
}

function fromChannels(alpha: number, red: number, green: number, blue: number): number {
  return (
    (((alpha & 0xff) << 24) | ((red & 0xff) << 16) | ((green & 0xff) << 8) | (blue & 0xff)) >>> 0
  );
}

function perChannel(
  first: number,
  second: number,
  combine: (a: number, b: number) => number,
): number {
  return fromChannels(
    combine(channel(first, 24), channel(second, 24)),
    combine(channel(first, 16), channel(second, 16)),
    combine(channel(first, 8), channel(second, 8)),
    combine(channel(first, 0), channel(second, 0)),
  );
}

function average(first: number, second: number): number {
  return perChannel(first, second, (a, b) => (a + b) >> 1);
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, value));
}

const SHIFTS = [24, 16, 8, 0];

function select(left: number, top: number, topLeft: number): number {
  let towardLeft = 0;
  let towardTop = 0;
  for (const shift of SHIFTS) {
    const estimate = channel(left, shift) + channel(top, shift) - channel(topLeft, shift);
    towardLeft += Math.abs(estimate - channel(left, shift));
    towardTop += Math.abs(estimate - channel(top, shift));
  }
  return towardLeft < towardTop ? left : top;
}

function clampAddSubtractFull(first: number, second: number, third: number): number {
  const [alpha, red, green, blue] = SHIFTS.map((shift) =>
    clampByte(channel(first, shift) + channel(second, shift) - channel(third, shift)),
  );
  return fromChannels(alpha ?? 0, red ?? 0, green ?? 0, blue ?? 0);
}

function clampAddSubtractHalf(first: number, second: number): number {
  const [alpha, red, green, blue] = SHIFTS.map((shift) => {
    const value = channel(first, shift);
    return clampByte(value + Math.trunc((value - channel(second, shift)) / 2));
  });
  return fromChannels(alpha ?? 0, red ?? 0, green ?? 0, blue ?? 0);
}

function predict(
  mode: number,
  left: number,
  top: number,
  topRight: number,
  topLeft: number,
): number {
  switch (mode) {
    case 1:
      return left;
    case 2:
      return top;
    case 3:
      return topRight;
    case 4:
      return topLeft;
    case 5:
      return average(average(left, topRight), top);
    case 6:
      return average(left, topLeft);
    case 7:
      return average(left, top);
    case 8:
      return average(topLeft, top);
    case 9:
      return average(top, topRight);
    case 10:
      return average(average(left, topLeft), average(top, topRight));
    case 11:
      return select(left, top, topLeft);
    case 12:
      return clampAddSubtractFull(left, top, topLeft);
    case 13:
      return clampAddSubtractHalf(average(left, top), topLeft);
    default:
      return 0xff000000;
  }
}

function addPixels(first: number, second: number): number {
  return perChannel(first, second, (a, b) => a + b);
}

function undoPredictor(pixels: Uint32Array, width: number, data: EntropyImage): void {
  const height = pixels.length / width;
  const { bits, image } = data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = y * width + x;
      let prediction: number;
      if (x === 0 && y === 0) {
        prediction = 0xff000000;
      } else if (y === 0) {
        prediction = pixels[position - 1] ?? 0;
      } else if (x === 0) {
        prediction = pixels[position - width] ?? 0;
      } else {
        const mode = channel(image.pixels[(y >> bits) * image.width + (x >> bits)] ?? 0, 8) & 0xf;
        prediction = predict(
          mode,
          pixels[position - 1] ?? 0,
          pixels[position - width] ?? 0,
          pixels[position - width + 1] ?? 0,
          pixels[position - width - 1] ?? 0,
        );
      }
      pixels[position] = addPixels(pixels[position] ?? 0, prediction);
    }
  }
}

function signedByte(value: number): number {
  return value >= 128 ? value - 256 : value;
}

function colorDelta(multiplier: number, value: number): number {
  return (signedByte(multiplier) * signedByte(value)) >> 5;
}

function undoColorTransform(pixels: Uint32Array, width: number, data: EntropyImage): void {
  const { bits, image } = data;
  for (let position = 0; position < pixels.length; position += 1) {
    const x = position % width;
    const y = (position - x) / width;
    const element = image.pixels[(y >> bits) * image.width + (x >> bits)] ?? 0;
    const greenToRed = channel(element, 0);
    const greenToBlue = channel(element, 8);
    const redToBlue = channel(element, 16);
    const argb = pixels[position] ?? 0;
    const green = channel(argb, 8);
    const red = (channel(argb, 16) + colorDelta(greenToRed, green)) & 0xff;
    const blue =
      (channel(argb, 0) + colorDelta(greenToBlue, green) + colorDelta(redToBlue, red)) & 0xff;
    pixels[position] = fromChannels(channel(argb, 24), red, green, blue);
  }
}

function undoSubtractGreen(pixels: Uint32Array): void {
  for (let position = 0; position < pixels.length; position += 1) {
    const argb = pixels[position] ?? 0;
    const green = channel(argb, 8);
    pixels[position] = fromChannels(
      channel(argb, 24),
      channel(argb, 16) + green,
      green,
      channel(argb, 0) + green,
    );
  }
}

function undoColorIndexing(
  packed: Uint32Array,
  packedWidth: number,
  transform: Extract<Transform, { kind: 'colorIndexing' }>,
): Uint32Array {
  const { width, widthBits, palette } = transform;
  const height = packed.length / packedWidth;
  const bitsPerPixel = 8 >> widthBits;
  const mask = (1 << bitsPerPixel) - 1;
  const xMask = (1 << widthBits) - 1;
  const pixels = new Uint32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const green = channel(packed[y * packedWidth + (x >> widthBits)] ?? 0, 8);
      const index = (green >> ((x & xMask) * bitsPerPixel)) & mask;
      pixels[y * width + x] = palette[index] ?? 0;
    }
  }
  return pixels;
}

function paletteWidthBits(size: number): number {
  if (size <= 2) {
    return 3;
  }
  if (size <= 4) {
    return 2;
  }
  return size <= 16 ? 1 : 0;
}

function readTransform(reader: BitReader, width: number, height: number): Transform {
  const kind = reader.read(2);
  if (kind === 0 || kind === 1) {
    const bits = reader.read(3) + 2;
    const image = decodePixels(reader, subSize(width, bits), subSize(height, bits), false);
    return { kind: kind === 0 ? 'predictor' : 'color', width, data: { bits, image } };
  }
  if (kind === 2) {
    return { kind: 'subtractGreen' };
  }
  const size = reader.read(8) + 1;
  const palette = decodePixels(reader, size, 1, false).pixels;
  for (let index = 1; index < palette.length; index += 1) {
    palette[index] = addPixels(palette[index] ?? 0, palette[index - 1] ?? 0);
  }
  return { kind: 'colorIndexing', width, widthBits: paletteWidthBits(size), palette };
}

/** Obrázek VP8L bez hlavičky (jako v bloku `ALPH`) o daném rozměru. */
function decodeVp8lStream(bytes: Uint8Array, width: number, height: number): Uint32Array {
  const reader = new BitReader(bytes);
  const transforms: Transform[] = [];
  let codedWidth = width;
  while (reader.read(1) === 1) {
    const transform = readTransform(reader, codedWidth, height);
    transforms.push(transform);
    if (transform.kind === 'colorIndexing') {
      codedWidth = subSize(codedWidth, transform.widthBits);
    }
  }
  let pixels = decodePixels(reader, codedWidth, height, true).pixels;
  let currentWidth = codedWidth;
  for (const transform of [...transforms].reverse()) {
    switch (transform.kind) {
      case 'predictor':
        undoPredictor(pixels, transform.width, transform.data);
        break;
      case 'color':
        undoColorTransform(pixels, transform.width, transform.data);
        break;
      case 'subtractGreen':
        undoSubtractGreen(pixels);
        break;
      case 'colorIndexing':
        pixels = undoColorIndexing(pixels, currentWidth, transform);
        currentWidth = transform.width;
        break;
    }
  }
  return pixels;
}

// ---------------------------------------------------------------------------
// Blok ALPH
// ---------------------------------------------------------------------------

function unfilter(alpha: Uint8Array, width: number, filter: number): void {
  if (filter === 0) {
    return;
  }
  const height = alpha.length / width;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = y * width + x;
      const left = alpha[position - 1] ?? 0;
      const top = alpha[position - width] ?? 0;
      let prediction: number;
      if (x === 0 && y === 0) {
        prediction = 0;
      } else if (y === 0) {
        prediction = left;
      } else if (x === 0) {
        prediction = top;
      } else if (filter === 1) {
        prediction = left;
      } else if (filter === 2) {
        prediction = top;
      } else {
        prediction = clampByte(left + top - (alpha[position - width - 1] ?? 0));
      }
      alpha[position] = ((alpha[position] ?? 0) + prediction) & 0xff;
    }
  }
}

/** Průhlednost obrázku WebP s blokem `VP8X` a `ALPH`; jinak výjimka. */
export function readWebpAlpha(bytes: Uint8Array): AlphaPlane {
  const chunks = chunksOf(bytes);
  const header = chunks.find((chunk) => chunk.type === 'VP8X');
  const alphaChunk = chunks.find((chunk) => chunk.type === 'ALPH');
  if (header === undefined || alphaChunk === undefined) {
    throw new Error('WebP bez bloku VP8X nebo ALPH');
  }
  const width = littleEndian(header.data, 4, 3) + 1;
  const height = littleEndian(header.data, 7, 3) + 1;
  const flags = alphaChunk.data[0] ?? 0;
  const compression = flags & 0x3;
  const filter = (flags >> 2) & 0x3;
  const payload = alphaChunk.data.subarray(1);
  let alpha: Uint8Array;
  if (compression === 0) {
    alpha = payload.slice(0, width * height);
  } else if (compression === 1) {
    const pixels = decodeVp8lStream(payload, width, height);
    alpha = Uint8Array.from(pixels, (argb) => channel(argb, 8));
  } else {
    throw new Error(`neznámá komprese průhlednosti ${compression}`);
  }
  unfilter(alpha, width, filter);
  return { width, height, alpha };
}
