/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { GAMES, GAME_METAS } from '../../src/gameList';

/**
 * Testy k #122 AC5 a části AC6: soubory obrázků dlaždic
 * `src/games/<hra>/tile.webp` a odkud je menu bere.
 *
 * Soubory se čtou přes `import.meta.glob` s `?inline` (obsah jako
 * `data:` adresa v base64), takže test nepotřebuje novou závislost ani
 * přístup k souborům mimo Vite. Formát a rozměr se čtou z hlavičky WebP:
 * `RIFF` + velikost + `WEBP` a první blok `VP8 ` (ztrátový), `VP8L`
 * (bezeztrátový) nebo `VP8X` (rozšířený).
 *
 * Navržené rozhraní: `GameMeta.tile` (povinná adresa obrázku z importu
 * `./tile.webp` v `meta.ts`) a `GameEntry.tile` (nepovinná, `gameEntry`
 * ji převezme z `meta.ts`; zkušební seznamy her ji nemají).
 */

const TILE_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/games/*/tile.webp', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../', ''), dataUrl]),
);

/** Všechny složky her v `src/` (podle jejich `meta.ts`). */
const GAME_FOLDERS: string[] = Object.keys(import.meta.glob('../../src/games/*/meta.ts')).map(
  (path) => path.replace('../../src/games/', '').replace('/meta.ts', ''),
);

const TILE_SIDE = 512;
const MAX_TILE_BYTES = 8192;

function bytesOf(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
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

interface WebpHeader {
  readonly width: number;
  readonly height: number;
}

/** Rozměr z hlavičky WebP, nebo `null`, když soubor WebP není. */
function webpHeader(bytes: Uint8Array): WebpHeader | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') {
    // Za třemi bajty rámce je značka 9D 01 2A a pak 14bitová šířka a výška.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    return {
      width: littleEndian(bytes, 26, 2) & 0x3fff,
      height: littleEndian(bytes, 28, 2) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) {
      return null;
    }
    const bits = littleEndian(bytes, 21, 4);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: littleEndian(bytes, 24, 3) + 1, height: littleEndian(bytes, 27, 3) + 1 };
  }
  return null;
}

function tilePath(gameId: string): string {
  return `src/games/${gameId}/tile.webp`;
}

describe('#122 AC5: soubory obrázků dlaždic', () => {
  it('každá hra ze seznamu her má obrázek dlaždice tile.webp ve své složce', () => {
    expect(GAMES.length).toBeGreaterThan(0);
    for (const game of GAMES) {
      expect(TILE_FILES[tilePath(game.id)], game.id).toBeDefined();
    }
  });

  it('každá složka hry v repozitáři má obrázek dlaždice', () => {
    expect(GAME_FOLDERS.length).toBeGreaterThan(0);
    for (const folder of GAME_FOLDERS) {
      expect(TILE_FILES[tilePath(folder)], folder).toBeDefined();
    }
  });

  it('každý obrázek dlaždice je WebP', () => {
    for (const [path, dataUrl] of Object.entries(TILE_FILES)) {
      expect(webpHeader(bytesOf(dataUrl)), path).not.toBeNull();
    }
  });

  it('každý obrázek dlaždice je čtverec o straně 512 px', () => {
    for (const [path, dataUrl] of Object.entries(TILE_FILES)) {
      expect(webpHeader(bytesOf(dataUrl)), path).toEqual({ width: TILE_SIDE, height: TILE_SIDE });
    }
  });

  it('každý obrázek dlaždice má nejvýš 8 192 B', () => {
    for (const [path, dataUrl] of Object.entries(TILE_FILES)) {
      expect(bytesOf(dataUrl).length, path).toBeLessThanOrEqual(MAX_TILE_BYTES);
    }
  });

  it('údaje každé hry pro menu (meta.ts) odkazují na obrázek dlaždice', () => {
    for (const meta of GAME_METAS) {
      expect(typeof meta.tile, meta.id).toBe('string');
      expect(meta.tile, meta.id).not.toBe('');
    }
  });

  it('záznam každé hry ze seznamu her nese adresu obrázku dlaždice', () => {
    for (const game of GAMES) {
      expect(typeof game.tile, game.id).toBe('string');
      expect(game.tile, game.id).not.toBe('');
    }
  });
});

describe('#122 AC5: kontrola hlavičky WebP opravdu něco hlídá', () => {
  /** Nejmenší ztrátová hlavička WebP se zadaným rozměrem (bez obrazových dat). */
  function lossyHeader(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(30);
    bytes.set(
      [...'RIFF'].map((c) => c.charCodeAt(0)),
      0,
    );
    bytes.set(
      [...'WEBP'].map((c) => c.charCodeAt(0)),
      8,
    );
    bytes.set(
      [...'VP8 '].map((c) => c.charCodeAt(0)),
      12,
    );
    bytes.set([0x9d, 0x01, 0x2a], 23);
    bytes.set([width & 0xff, width >> 8, height & 0xff, height >> 8], 26);
    return bytes;
  }

  it('přečte rozměr ztrátového WebP', () => {
    expect(webpHeader(lossyHeader(512, 512))).toEqual({ width: 512, height: 512 });
    expect(webpHeader(lossyHeader(512, 384))).toEqual({ width: 512, height: 384 });
  });

  it('přečte rozměr bezeztrátového a rozšířeného WebP', () => {
    const lossless = new Uint8Array(25);
    lossless.set(
      [...'RIFF'].map((c) => c.charCodeAt(0)),
      0,
    );
    lossless.set(
      [...'WEBPVP8L'].map((c) => c.charCodeAt(0)),
      8,
    );
    const bits = 511 + (255 << 14);
    lossless.set([0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, bits >>> 24], 20);
    expect(webpHeader(lossless)).toEqual({ width: 512, height: 256 });

    const extended = new Uint8Array(30);
    extended.set(
      [...'RIFF'].map((c) => c.charCodeAt(0)),
      0,
    );
    extended.set(
      [...'WEBPVP8X'].map((c) => c.charCodeAt(0)),
      8,
    );
    extended.set([0xff, 0x01, 0x00, 0xff, 0x01, 0x00], 24);
    expect(webpHeader(extended)).toEqual({ width: 512, height: 512 });
  });

  it('PNG ani jiný soubor za WebP nepovažuje', () => {
    const png = Uint8Array.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...new Array(30).fill(0),
    ]);
    expect(webpHeader(png)).toBeNull();
    expect(webpHeader(new Uint8Array(0))).toBeNull();
  });
});

describe('#122 AC6: obrázky dlaždic jsou jen ze stejné stránky', () => {
  it('adresa obrázku každé hry je data: nebo cesta na stejné stránce, žádná absolutní adresa jiného serveru', () => {
    for (const game of GAMES) {
      const url = game.tile ?? '';
      const sameOrigin =
        url.startsWith('data:image/') ||
        (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//'));
      expect(sameOrigin, `${game.id}: ${url}`).toBe(true);
      expect(url, game.id).not.toBe('');
    }
  });
});
