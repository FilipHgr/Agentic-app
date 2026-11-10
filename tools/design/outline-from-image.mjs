/* global console, process, Buffer, TextEncoder, TextDecoder */
/**
 * Převod schváleného obrázku z ElevenLabs (černá kresba na bílé) na obrys
 * Omalovánek (#128 AC5):
 *
 *   node tools/design/outline-from-image.mjs <zdroj.png> <cíl.png>
 *
 * Šedá se změní na průhlednost: světlejší než 235 je průhledné pozadí,
 * tmavší než 30 plná čára, mezi tím lineárně. Hra bere jako obrys pixel
 * s průhledností aspoň 128 (`outlineFromImage`). Oblasti menší než 50 px
 * (mimo obrys, sousedé přes hrany jako `buildRegionMap`) se zaplní plnou
 * čarou, aby v obrázku nezůstaly drobné skvrny. Výsledek je PNG s paletou
 * 16 úrovní průhlednosti v barvě čáry #1D1D1F. Pixel obrysu má úroveň aspoň
 * 8 (136), ostatní nejvýš 7 (119), takže hra rozloží obrys stejně jako
 * před zaokrouhlením. Stejný vstup dá vždy stejný soubor bajt po bajtu.
 *
 * Nástroj nepotřebuje žádnou závislost, jen vestavěný `node:zlib`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

/** Šedá, od které je pixel průhledné pozadí, a do které je plná čára. */
const BACKGROUND_GRAY = 235;
const FULL_LINE_GRAY = 30;
/** Průhlednost, od které hra bere pixel jako obrys. */
const OUTLINE_MIN_ALPHA = 128;
/** Oblasti s méně pixely se zaplní čarou. */
const SMALLEST_REGION = 50;
/** 16 úrovní průhlednosti po 17 (0, 17, … 255). */
const LEVEL_COUNT = 16;
const LEVEL_STEP = 17;
const LOWEST_OUTLINE_LEVEL = 8;
/** Barva čáry obrysu #1D1D1F. */
const LINE_RGB = [0x1d, 0x1d, 0x1f];

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------
// Převod pixelů
// ---------------------------------------------------------------------------

/** Šedá pixelu `index` (0 černá, 255 bílá); průhledný zdroj leží na bílé. */
function grayAt(pixels, index) {
  const { channels, data } = pixels;
  const offset = index * channels;
  if (channels === 1) {
    return data[offset];
  }
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const gray = (red * 299 + green * 587 + blue * 114) / 1000;
  if (channels === 3) {
    return gray;
  }
  const opacity = data[offset + 3] / 255;
  return 255 - (255 - gray) * opacity;
}

/** Průhlednost 0 až 255 z šedé podle prahů pozadí a plné čáry. */
function alphaOfGray(gray) {
  const share = (BACKGROUND_GRAY - gray) / (BACKGROUND_GRAY - FULL_LINE_GRAY);
  return Math.min(255, Math.max(0, 255 * share));
}

/**
 * Oblasti mimo obrys (sousedé přes hrany). Vrátí číslo oblasti každého
 * pixelu (0 na obrysu) a velikost každé oblasti.
 */
function labelRegions(isOutline, width, height) {
  const ids = new Int32Array(width * height);
  const sizes = [0];
  const pending = [];
  for (let start = 0; start < ids.length; start += 1) {
    if (isOutline[start] || ids[start] !== 0) {
      continue;
    }
    const id = sizes.length;
    let size = 0;
    ids[start] = id;
    pending.push(start);
    while (pending.length > 0) {
      const index = pending.pop();
      size += 1;
      const x = index % width;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index >= width ? index - width : -1,
        index + width < ids.length ? index + width : -1,
      ];
      for (const next of neighbours) {
        if (next >= 0 && !isOutline[next] && ids[next] === 0) {
          ids[next] = id;
          pending.push(next);
        }
      }
    }
    sizes.push(size);
  }
  return { ids, sizes };
}

/** Úroveň průhlednosti 0 až 15; obrys aspoň 8, ostatní nejvýš 7. */
function levelOf(alpha, outline) {
  const level = Math.round(alpha / LEVEL_STEP);
  return outline
    ? Math.max(level, LOWEST_OUTLINE_LEVEL)
    : Math.min(level, LOWEST_OUTLINE_LEVEL - 1);
}

/**
 * Obrys ze zdrojových pixelů `{ width, height, channels: 1 | 3 | 4, data }`
 * po řádcích. Vrátí PNG obrysu a kolik oblastí se zaplnilo a kolik zbylo.
 */
export function outlineFromPixels(pixels) {
  const { width, height, channels } = pixels;
  if (![1, 3, 4].includes(channels) || pixels.data.length !== width * height * channels) {
    throw new Error('nepodporovaný vstup: čekám šedé, RGB nebo RGBA pixely');
  }
  const count = width * height;
  const alpha = new Float64Array(count);
  const isOutline = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    alpha[index] = alphaOfGray(grayAt(pixels, index));
    isOutline[index] = alpha[index] >= OUTLINE_MIN_ALPHA ? 1 : 0;
  }
  const { ids, sizes } = labelRegions(isOutline, width, height);
  let filledRegions = 0;
  const small = new Uint8Array(sizes.length);
  for (let id = 1; id < sizes.length; id += 1) {
    if (sizes[id] < SMALLEST_REGION) {
      small[id] = 1;
      filledRegions += 1;
    }
  }
  const levels = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    if (small[ids[index]] === 1) {
      levels[index] = LEVEL_COUNT - 1;
    } else {
      levels[index] = levelOf(alpha[index], isOutline[index] === 1);
    }
  }
  return {
    png: encodeLevelsPng(levels, width, height),
    filledRegions,
    remainingRegions: sizes.length - 1 - filledRegions,
  };
}

// ---------------------------------------------------------------------------
// Zápis PNG s paletou 16 úrovní
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, content) {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + content.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, content.length);
  out.set(typeBytes, 4);
  out.set(content, 8);
  const crcInput = new Uint8Array(4 + content.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(content, 4);
  view.setUint32(8 + content.length, crc32(crcInput));
  return out;
}

/** Předpověď Paeth podle specifikace PNG. */
function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
}

/** Řádek po filtru `type` (bajt vlevo je u hloubky 4 bitů o bajt dřív). */
function filterRow(type, row, previous) {
  const out = new Uint8Array(row.length);
  for (let i = 0; i < row.length; i += 1) {
    const left = i > 0 ? row[i - 1] : 0;
    const up = previous[i];
    const upLeft = i > 0 ? previous[i - 1] : 0;
    const predictions = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)];
    out[i] = (row[i] - predictions[type]) & 0xff;
  }
  return out;
}

/** Součet velikostí bajtů jako znaménkových čísel, běžné měřítko volby filtru. */
function filterCost(bytes) {
  let cost = 0;
  for (const byte of bytes) {
    cost += byte < 128 ? byte : 256 - byte;
  }
  return cost;
}

function encodeLevelsPng(levels, width, height) {
  const rowBytes = Math.ceil(width / 2);
  const raw = new Uint8Array(height * (rowBytes + 1));
  let previous = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const row = new Uint8Array(rowBytes);
    for (let x = 0; x < width; x += 1) {
      const level = levels[y * width + x];
      row[x >> 1] |= x % 2 === 0 ? level << 4 : level;
    }
    let best = filterRow(0, row, previous);
    let bestType = 0;
    for (let type = 1; type <= 4; type += 1) {
      const candidate = filterRow(type, row, previous);
      if (filterCost(candidate) < filterCost(best)) {
        best = candidate;
        bestType = type;
      }
    }
    const offset = y * (rowBytes + 1);
    raw[offset] = bestType;
    raw.set(best, offset + 1);
    previous = row;
  }
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header.set([4, 3, 0, 0, 0], 8); // hloubka 4 bity, paleta, bez prokládání
  const palette = new Uint8Array(LEVEL_COUNT * 3);
  const transparency = new Uint8Array(LEVEL_COUNT);
  for (let level = 0; level < LEVEL_COUNT; level += 1) {
    palette.set(LINE_RGB, level * 3);
    transparency[level] = level * LEVEL_STEP;
  }
  const parts = [
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('PLTE', palette),
    chunk('tRNS', transparency),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9, memLevel: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Čtení zdrojového PNG (8 bitů na kanál, bez prokládání)
// ---------------------------------------------------------------------------

/** Největší strana zdroje; obrázky z ElevenLabs mají 1024 × 768. */
const MAX_SOURCE_SIDE = 8192;

const CHANNELS_OF_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function readChunks(bytes) {
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('zdroj není PNG');
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let at = PNG_SIGNATURE.length;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    if (at + 12 + length > bytes.length) {
      throw new Error('PNG má useknutý blok');
    }
    const typeAndContent = bytes.subarray(at + 4, at + 8 + length);
    if (crc32(typeAndContent) !== view.getUint32(at + 8 + length)) {
      throw new Error('PNG má poškozený blok (CRC)');
    }
    const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
    chunks.push({ type, content: bytes.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
    if (type === 'IEND') {
      break;
    }
  }
  return chunks;
}

function unfilter(raw, width, height, bytesPerPixel) {
  const rowBytes = width * bytesPerPixel;
  if (raw.length < height * (rowBytes + 1)) {
    throw new Error('PNG má málo obrazových dat');
  }
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const type = raw[y * (rowBytes + 1)];
    const source = raw.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1));
    const rowStart = y * rowBytes;
    for (let i = 0; i < rowBytes; i += 1) {
      const left = i >= bytesPerPixel ? out[rowStart + i - bytesPerPixel] : 0;
      const up = y > 0 ? out[rowStart - rowBytes + i] : 0;
      const upLeft = y > 0 && i >= bytesPerPixel ? out[rowStart - rowBytes + i - bytesPerPixel] : 0;
      const predictions = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)];
      if (predictions[type] === undefined) {
        throw new Error('neznámý filtr řádku PNG');
      }
      out[rowStart + i] = (source[i] + predictions[type]) & 0xff;
    }
  }
  return out;
}

/** Pixely zdrojového PNG jako šedé, RGB nebo RGBA (paleta se převede na RGBA). */
export function readSourcePng(bytes) {
  const chunks = readChunks(bytes);
  const header = chunks.find((each) => each.type === 'IHDR')?.content;
  if (header === undefined) {
    throw new Error('PNG nemá hlavičku');
  }
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const [bitDepth, colorType, , , interlace] = header.subarray(8, 13);
  const stored = CHANNELS_OF_COLOR_TYPE[colorType];
  if (bitDepth !== 8 || stored === undefined || interlace !== 0) {
    throw new Error('podporuji jen PNG s 8 bity na kanál bez prokládání');
  }
  if (width < 1 || height < 1 || width > MAX_SOURCE_SIDE || height > MAX_SOURCE_SIDE) {
    throw new Error(`rozměr zdroje musí být 1 až ${MAX_SOURCE_SIDE} px`);
  }
  const compressed = Buffer.concat(
    chunks.filter((each) => each.type === 'IDAT').map((each) => each.content),
  );
  const expectedBytes = height * (width * stored + 1);
  const inflated = inflateSync(compressed, { maxOutputLength: expectedBytes });
  const raw = unfilter(new Uint8Array(inflated), width, height, stored);
  if (colorType === 3) {
    return paletteToRgba(raw, chunks, width, height);
  }
  if (colorType === 4) {
    return grayAlphaToRgba(raw, width, height);
  }
  return { width, height, channels: stored, data: raw };
}

function paletteToRgba(indices, chunks, width, height) {
  const palette = chunks.find((each) => each.type === 'PLTE')?.content ?? new Uint8Array(0);
  const transparency = chunks.find((each) => each.type === 'tRNS')?.content ?? new Uint8Array(0);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < indices.length; i += 1) {
    const entry = indices[i];
    if (entry * 3 + 3 > palette.length) {
      throw new Error('PNG má index mimo paletu');
    }
    data.set(palette.subarray(entry * 3, entry * 3 + 3), i * 4);
    data[i * 4 + 3] = entry < transparency.length ? transparency[entry] : 255;
  }
  return { width, height, channels: 4, data };
}

function grayAlphaToRgba(raw, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.fill(raw[i * 2], i * 4, i * 4 + 3);
    data[i * 4 + 3] = raw[i * 2 + 1];
  }
  return { width, height, channels: 4, data };
}

// ---------------------------------------------------------------------------
// Příkazová řádka
// ---------------------------------------------------------------------------

function main(args) {
  const [source, target] = args;
  if (source === undefined || target === undefined) {
    console.error('použití: node tools/design/outline-from-image.mjs <zdroj.png> <cíl.png>');
    return 2;
  }
  let result;
  try {
    result = outlineFromPixels(readSourcePng(new Uint8Array(readFileSync(source))));
  } catch (error) {
    console.error(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  writeFileSync(target, result.png);
  console.log(
    `${target}: zaplněno ${result.filledRegions} oblastí pod ${SMALLEST_REGION} px, ` +
      `zbývá ${result.remainingRegions} oblastí, ${result.png.length} B`,
  );
  return 0;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = main(process.argv.slice(2));
}
