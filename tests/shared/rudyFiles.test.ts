/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import licenceText from '../../public/licence.txt?raw';
import { RUDY_MOVES, RUDY_SHEET } from '../../src/shared/logic/rudy';
import { readWebpAlpha } from './webpAlpha';
import type { AlphaPlane } from './webpAlpha';

/**
 * Testy k #169 AC1: ve sdílené části jsou pohyby pandy Rudyho (klid,
 * oslava, mluví; pozdrav zrušil #186) s průhledným pozadím, 37 snímků po
 * 12 snímcích/s. U horního, levého a pravého okraje každého snímku je pás
 * aspoň 6 px úplně průhledný, aby uši nikde nebyly useknuté. Každý soubor
 * má nejvýš 700 KiB, všechny dohromady nejvýš 2,8 MiB, původ je
 * v `public/licence.txt`. Staré pohyby z #166 jsou smazané (#170 AC1).
 */

const MASCOT_FOLDER = 'src/shared/mascot';
const MAX_FILE_BYTES = 700 * 1024;
const MAX_TOTAL_BYTES = 2.8 * 1024 * 1024;
const CLEAR_BAND_PX = 6;

const FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/shared/mascot/rudy-*', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../', ''), dataUrl]),
);

const OTHER_FILES: readonly string[] = Object.keys(
  import.meta.glob('../../src/shared/mascot/!(rudy-)*', { query: '?url', eager: true }),
);

/** Čísla generací ElevenLabs z poznámek k #169. */
const GENERATION_IDS: readonly string[] = [
  'gbJQu790nIS0Mdau7nlD',
  'rCl07oAp6svAQx7ECbEJ',
  'N35UnWbC8ymxWfzN4ZiB',
  'jZgYXHG36kxthHr7dD2a',
  'jEzJqkTQkc077jcXR1Fs',
  'Hp6StYQERZ7T3AQyR2Wp',
  'LjuAoSwlkH1iP6aNW6X0',
  'BJbFR1AJm9fDDeY5R6UJ',
];

function filePath(move: string): string {
  return `${MASCOT_FOLDER}/rudy-${move}.webp`;
}

function bytesOf(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

const decodedAlpha = new Map<string, AlphaPlane>();

/** Průhlednost archu pohybu; každý soubor se rozbalí jen jednou (trvá asi 0,6 s). */
function alphaOf(move: string): AlphaPlane {
  const known = decodedAlpha.get(move);
  if (known !== undefined) {
    return known;
  }
  const plane = readWebpAlpha(bytesOf(FILES[filePath(move)] ?? ''));
  decodedAlpha.set(move, plane);
  return plane;
}

function sheetRows(): number {
  return Math.ceil(RUDY_SHEET.frameCount / RUDY_SHEET.columns);
}

/**
 * Body snímku `frame`, které nejsou úplně průhledné a leží v pásu 6 px
 * u horního, levého nebo pravého okraje snímku, jako „x,y“.
 */
function visibleInBand(plane: AlphaPlane, frame: number): readonly string[] {
  const { frameWidth, frameHeight, columns } = RUDY_SHEET;
  const originX = (frame % columns) * frameWidth;
  const originY = Math.floor(frame / columns) * frameHeight;
  const found: string[] = [];
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const inBand = y < CLEAR_BAND_PX || x < CLEAR_BAND_PX || x >= frameWidth - CLEAR_BAND_PX;
      const alpha = plane.alpha[(originY + y) * plane.width + originX + x] ?? 0;
      if (inBand && alpha > 0) {
        found.push(`${x},${y}`);
      }
    }
  }
  return found;
}

/** Odstavce `public/licence.txt` (oddělené prázdným řádkem). */
const LICENCE_PARAGRAPHS: readonly string[] = licenceText.split(/\n\s*\n/);

describe('#169 AC1: soubory pohybů pandy Rudyho', () => {
  it('ve sdílené části jsou právě 3 pohyby: klid, oslava a mluví (pozdrav zrušil #186)', () => {
    expect(RUDY_MOVES).toEqual(['idle', 'celebrate', 'talk']);
    expect(Object.keys(FILES).sort()).toEqual(RUDY_MOVES.map(filePath).sort());
  });

  it('pohyb má 37 snímků po 12 snímcích/s v mřížce 6 sloupců, snímek 439 × 480 px', () => {
    expect(RUDY_SHEET).toEqual({
      frameWidth: 439,
      frameHeight: 480,
      columns: 6,
      frameCount: 37,
      framesPerSecond: 12,
    });
  });

  it('#170 AC1: staré pohyby z #166 jsou smazané, ve složce je jen Rudy', () => {
    expect(OTHER_FILES).toEqual([]);
  });

  it('každý pohyb je mřížka snímků s průhledným pozadím', () => {
    for (const move of RUDY_MOVES) {
      const plane = alphaOf(move);
      expect({ width: plane.width, height: plane.height }, move).toEqual({
        width: RUDY_SHEET.columns * RUDY_SHEET.frameWidth,
        height: sheetRows() * RUDY_SHEET.frameHeight,
      });
      expect(plane.alpha.includes(0), `${move}: má průhledné body`).toBe(true);
      expect(plane.alpha.includes(255), `${move}: má neprůhledné body`).toBe(true);
    }
  });

  it('v každém snímku je u horního, levého a pravého okraje pás 6 px úplně průhledný', () => {
    for (const move of RUDY_MOVES) {
      const plane = alphaOf(move);
      for (let frame = 0; frame < RUDY_SHEET.frameCount; frame += 1) {
        const found = visibleInBand(plane, frame);
        expect(found.slice(0, 5), `${move}, snímek ${frame + 1}: ${found.length} bodů`).toEqual([]);
      }
    }
  });

  it('každý soubor má nejvýš 700 KiB', () => {
    for (const move of RUDY_MOVES) {
      const size = bytesOf(FILES[filePath(move)] ?? '').length;
      expect(size, `${move}: ${size} B`).toBeGreaterThan(0);
      expect(size, `${move}: ${size} B`).toBeLessThanOrEqual(MAX_FILE_BYTES);
    }
  });

  it('všechny pohyby dohromady mají nejvýš 2,8 MiB', () => {
    const total = Object.values(FILES).reduce((sum, dataUrl) => sum + bytesOf(dataUrl).length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });
});

describe('#169 AC1: původ pandy Rudyho v licence.txt', () => {
  const paragraph = LICENCE_PARAGRAPHS.find((each) => each.includes('rudy-idle.webp')) ?? '';
  const flat = paragraph.replace(/\s+/g, ' ');

  it('licence uvádí složku a každý soubor nových pohybů', () => {
    expect(paragraph).not.toBe('');
    expect(flat).toContain(`${MASCOT_FOLDER}/`);
    for (const move of RUDY_MOVES) {
      expect(flat, move).toContain(`rudy-${move}.webp`);
    }
  });

  it('licence uvádí ElevenLabs, GPT Image 2.5, Kling 3 Pro a odstranění pozadí VEED', () => {
    expect(flat).toContain('ElevenLabs');
    expect(flat).toContain('GPT Image 2.5');
    expect(flat).toContain('Kling 3 Pro');
    expect(flat).toContain('VEED');
  });

  it('licence uvádí čísla všech generací ElevenLabs', () => {
    for (const id of GENERATION_IDS) {
      expect(paragraph, id).toContain(id);
    }
  });
});
