/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import licenceText from '../../public/licence.txt?raw';
import {
  MASCOT_FRAME_COUNT,
  MASCOT_FRAME_SIZE,
  MASCOT_MOVES,
  MASCOT_SHEET_COLUMNS,
} from '../../src/shared/logic/mascot';

/**
 * Testy k #166 AC1: ve sdílené části je 6 pohybů pandy s průhledným
 * pozadím, každý soubor nejvýš 600 KiB, dohromady nejvýš 3,5 MiB, a jejich
 * původ (ElevenLabs, Kling 3 Pro, odstranění pozadí VEED, čísla generací)
 * je v `public/licence.txt`. Soubory se čtou přes `import.meta.glob`
 * (`?inline` jako `data:` adresa v base64), jako obrázky dlaždic her.
 */

const MASCOT_FOLDER = 'src/shared/mascot';
const MAX_FILE_BYTES = 600 * 1024;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024;

const FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/shared/mascot/*', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../', ''), dataUrl]),
);

/** Čísla generací ElevenLabs z poznámek k #166. */
const GENERATION_IDS: readonly string[] = [
  '1c0GWhsdj9afuDSs5fed',
  'X88otXkyNx6w3OLTOUrS',
  'QHnPPBNWkOjIcYQ9AI3d',
  'HBnmOQgbVfqwpz8LpElO',
  'BgLFBjh1fXTnJNdL57Vn',
  'efQfT9W9s49nU1cATtSz',
  '1zl06Acd3iEfta0rFfBf',
  'tcKPfcdOlJuqrXmwjpiG',
  'dnjMaw0suIDRIgVNGoYY',
  'MzT7vW2NVSVOCahTROv2',
  'hBdAUU19ELcqp0pLnC8g',
  'G3UKdEOGJ8NCx3t4mVdA',
  '0HIoCNYevPgM2QD4gXey',
];

function bytesOf(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function threeBytes(bytes: Uint8Array, start: number): number {
  return (bytes[start] ?? 0) + (bytes[start + 1] ?? 0) * 256 + (bytes[start + 2] ?? 0) * 65_536;
}

interface ExtendedWebp {
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
}

/** Rozměr a průhlednost z hlavičky rozšířeného WebP (VP8X), jinak `null`. */
function extendedWebpHeader(bytes: Uint8Array): ExtendedWebp | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  if (ascii(bytes, 12, 4) !== 'VP8X') {
    return null;
  }
  const flags = bytes[20] ?? 0;
  return {
    width: threeBytes(bytes, 24) + 1,
    height: threeBytes(bytes, 27) + 1,
    hasAlpha: (flags & 0x10) !== 0,
  };
}

function filePath(move: string): string {
  return `${MASCOT_FOLDER}/${move}.webp`;
}

/** Odstavce `public/licence.txt` (oddělené prázdným řádkem). */
const LICENCE_PARAGRAPHS: readonly string[] = licenceText.split(/\n\s*\n/);

describe('#166 AC1: soubory pohybů pandy', () => {
  it('ve sdílené části je právě 6 pohybů pandy pod anglickými názvy', () => {
    expect(MASCOT_MOVES).toEqual(['idle', 'wave', 'joy', 'encourage', 'think', 'celebrate']);
    expect(Object.keys(FILES).sort()).toEqual(MASCOT_MOVES.map(filePath).sort());
  });

  it('každý pohyb je WebP s průhledným pozadím a mřížkou snímků 363 × 360 px', () => {
    const rows = Math.ceil(MASCOT_FRAME_COUNT / MASCOT_SHEET_COLUMNS);
    for (const move of MASCOT_MOVES) {
      const header = extendedWebpHeader(bytesOf(FILES[filePath(move)] ?? ''));
      expect(header, move).toEqual({
        width: MASCOT_SHEET_COLUMNS * MASCOT_FRAME_SIZE.width,
        height: rows * MASCOT_FRAME_SIZE.height,
        hasAlpha: true,
      });
    }
  });

  it('každý soubor má nejvýš 600 KiB', () => {
    for (const move of MASCOT_MOVES) {
      const size = bytesOf(FILES[filePath(move)] ?? '').length;
      expect(size, `${move}: ${size} B`).toBeGreaterThan(0);
      expect(size, `${move}: ${size} B`).toBeLessThanOrEqual(MAX_FILE_BYTES);
    }
  });

  it('všechny pohyby dohromady mají nejvýš 3,5 MiB', () => {
    const total = Object.values(FILES).reduce((sum, dataUrl) => sum + bytesOf(dataUrl).length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });
});

describe('#166 AC1: původ pandy v licence.txt', () => {
  const paragraph = LICENCE_PARAGRAPHS.find((each) => each.includes(`${MASCOT_FOLDER}/`)) ?? '';

  it('licence uvádí složku pandy a každý její soubor', () => {
    const flat = paragraph.replace(/\s+/g, ' ');
    expect(paragraph).not.toBe('');
    for (const move of MASCOT_MOVES) {
      expect(flat, move).toContain(`${move}.webp`);
    }
  });

  it('licence uvádí ElevenLabs, Kling 3 Pro a odstranění pozadí VEED', () => {
    const flat = paragraph.replace(/\s+/g, ' ');
    expect(flat).toContain('ElevenLabs');
    expect(flat).toContain('Kling 3 Pro');
    expect(flat).toContain('VEED');
  });

  it('licence uvádí čísla všech generací ElevenLabs', () => {
    for (const id of GENERATION_IDS) {
      expect(paragraph, id).toContain(id);
    }
  });
});
