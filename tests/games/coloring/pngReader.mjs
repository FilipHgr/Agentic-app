/**
 * Pomůcka k testům #128 (skutečné omalovánky): přečte soubor PNG v Node
 * bez nové závislosti, jen přes vestavěný `zlib`, aby testy rozložily obrys
 * na oblasti stejně jako hra. Hra obrys vykreslí do plátna a čte jeho
 * `getImageData` (RGBA bez předem vynásobené průhlednosti); tady vznikne
 * stejné pole RGBA přímo ze souboru.
 *
 * Čte nepřekládané (bez Adam7) PNG všech barevných typů s hloubkou 8 bitů
 * a paletové a šedé PNG s hloubkou 1, 2, 4 a 8 bitů, včetně průhlednosti
 * palety (`tRNS`). Kontroluje podpis souboru a kontrolní součty bloků.
 *
 * Je v JavaScriptu, protože projekt nemá typy Node a testy v TypeScriptu
 * by s nimi neprošly `tsc` (stejně jako `tests/shared/testScriptsListing.mjs`).
 * Typy jsou v `pngReader.d.mts`.
 */

import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

/** Kořen repozitáře. */
export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Tabulka CRC-32 bloků PNG. */
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

function uint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** Bloky souboru PNG v pořadí, s ověřeným kontrolním součtem. */
export function pngChunks(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  PNG_SIGNATURE.forEach((value, index) => {
    if (data[index] !== value) {
      throw new Error('soubor není PNG (chybí podpis)');
    }
  });
  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < data.length) {
    if (offset + 12 > data.length) {
      throw new Error('useknutý blok PNG');
    }
    const length = uint32(data, offset);
    const type = ascii(data, offset + 4, 4);
    const end = offset + 8 + length;
    if (end + 4 > data.length) {
      throw new Error(`useknutý blok ${type}`);
    }
    const body = data.subarray(offset + 8, end);
    if (crc32(data.subarray(offset + 4, end)) !== uint32(data, end)) {
      throw new Error(`špatný kontrolní součet bloku ${type}`);
    }
    chunks.push({ type, data: body });
    offset = end + 4;
    if (type === 'IEND') {
      break;
    }
  }
  return chunks;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

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

/** Vrátí řádky bez filtrů (každý `rowBytes` bajtů za sebou). */
function unfilter(raw, height, rowBytes, pixelBytes) {
  const rows = new Uint8Array(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (rowBytes + 1)];
    const source = y * (rowBytes + 1) + 1;
    const target = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[source + x];
      const left = x >= pixelBytes ? rows[target + x - pixelBytes] : 0;
      const up = y > 0 ? rows[target - rowBytes + x] : 0;
      const upLeft = y > 0 && x >= pixelBytes ? rows[target - rowBytes + x - pixelBytes] : 0;
      let result;
      switch (filter) {
        case 0:
          result = value;
          break;
        case 1:
          result = value + left;
          break;
        case 2:
          result = value + up;
          break;
        case 3:
          result = value + ((left + up) >> 1);
          break;
        case 4:
          result = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`neznámý filtr řádku ${filter}`);
      }
      rows[target + x] = result & 0xff;
    }
  }
  return rows;
}

/** Hodnota vzorku `index` v řádku s hloubkou `depth` bitů. */
function sampleAt(rows, rowStart, index, depth) {
  if (depth === 8) {
    return rows[rowStart + index];
  }
  const bitOffset = index * depth;
  const byte = rows[rowStart + (bitOffset >> 3)];
  const shift = 8 - depth - (bitOffset & 7);
  return (byte >> shift) & ((1 << depth) - 1);
}

/**
 * Přečte PNG: rozměr, barevný typ, hloubku, paletu, průhlednost palety,
 * typy bloků a pixely jako RGBA po řádcích (tvar `ImageData`).
 */
export function decodePng(bytes) {
  const chunks = pngChunks(bytes);
  const header = chunks[0];
  if (header === undefined || header.type !== 'IHDR') {
    throw new Error('PNG nezačíná blokem IHDR');
  }
  const width = uint32(header.data, 0);
  const height = uint32(header.data, 4);
  const bitDepth = header.data[8];
  const colorType = header.data[9];
  const interlace = header.data[12];
  const channels = CHANNELS[colorType];
  if (channels === undefined) {
    throw new Error(`neznámý barevný typ ${colorType}`);
  }
  if (interlace !== 0) {
    throw new Error('prokládané PNG pomůcka nečte');
  }
  if (bitDepth !== 8 && !(bitDepth < 8 && (colorType === 0 || colorType === 3))) {
    throw new Error(`hloubku ${bitDepth} u barevného typu ${colorType} pomůcka nečte`);
  }
  const palette = chunks.find((chunk) => chunk.type === 'PLTE')?.data ?? new Uint8Array(0);
  const transparency = chunks.find((chunk) => chunk.type === 'tRNS')?.data ?? new Uint8Array(0);
  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data),
  );
  const raw = new Uint8Array(inflateSync(compressed));
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const pixelBytes = Math.max(1, (channels * bitDepth) >> 3);
  if (raw.length < height * (rowBytes + 1)) {
    throw new Error('PNG má málo obrazových dat');
  }
  const rows = unfilter(raw, height, rowBytes, pixelBytes);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const grayScale = 255 / ((1 << bitDepth) - 1);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      const first = rowStart + x * channels;
      if (colorType === 3) {
        const index = sampleAt(rows, rowStart, x, bitDepth);
        if (index * 3 + 2 >= palette.length) {
          throw new Error(`index ${index} mimo paletu`);
        }
        rgba[target] = palette[index * 3];
        rgba[target + 1] = palette[index * 3 + 1];
        rgba[target + 2] = palette[index * 3 + 2];
        rgba[target + 3] = index < transparency.length ? transparency[index] : 255;
      } else if (colorType === 0) {
        const gray = Math.round(sampleAt(rows, rowStart, x, bitDepth) * grayScale);
        rgba.fill(gray, target, target + 3);
        rgba[target + 3] = 255;
      } else if (colorType === 4) {
        rgba.fill(rows[first], target, target + 3);
        rgba[target + 3] = rows[first + 1];
      } else {
        rgba[target] = rows[first];
        rgba[target + 1] = rows[first + 1];
        rgba[target + 2] = rows[first + 2];
        rgba[target + 3] = colorType === 6 ? rows[first + 3] : 255;
      }
    }
  }
  return {
    width,
    height,
    bitDepth,
    colorType,
    paletteSize: palette.length / 3,
    chunkTypes: chunks.map((chunk) => chunk.type),
    data: rgba,
  };
}

/** Bajty souboru v repozitáři (cesta od kořene repa). */
export function readRepoFile(path) {
  return new Uint8Array(readFileSync(join(REPO_ROOT, path)));
}

/** Nástroj na převod obrysu (#128 AC5) spuštěný z příkazové řádky. */
export const OUTLINE_TOOL = 'tools/design/outline-from-image.mjs';

/**
 * Spustí `node tools/design/outline-from-image.mjs <zdroj> <cíl>` nad
 * souborem `sourcePath` (od kořene repa) s cílem v dočasné složce
 * a vrátí, jak skončil, co vypsal a bajty vytvořeného souboru.
 */
export function runOutlineTool(sourcePath) {
  const folder = mkdtempSync(join(tmpdir(), 'outline-tool-'));
  const target = join(folder, 'outline.png');
  try {
    const result = spawnSync(
      process.execPath,
      [join(REPO_ROOT, OUTLINE_TOOL), join(REPO_ROOT, sourcePath), target],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      },
    );
    let output = null;
    try {
      output = new Uint8Array(readFileSync(target));
    } catch {
      // Nástroj soubor nevytvořil; test to ohlásí podle `output === null`.
      output = null;
    }
    return {
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      output,
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
