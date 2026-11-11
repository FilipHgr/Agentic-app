/// <reference types="vite/client" />
/**
 * Pomůcky pro testy obrázků map postupu (#134): soubory obrázků a symbolů
 * cíle ve složce `src/games/counting/maps/`, hlavička WebP a text
 * `public/licence.txt`.
 *
 * Soubory se čtou přes `import.meta.glob` (`?inline` jako `data:` adresa
 * v base64, `?raw` jako text), stejně jako obrázky dlaždic her v
 * `tests/menu/tileImageFiles.test.ts` (#122). Čtení hlavičky WebP je
 * z téhož testu převzaté beze změny, aby testy Počítání nebraly nic
 * z testů menu (každá část má vlastní testy).
 */

import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import licenceText from '../../../public/licence.txt?raw';

/** Složka s obrázky map a symboly cíle v repozitáři (od kořene). */
export const MAPS_FOLDER = 'src/games/counting/maps';

/** Orientace obrázku, jak ji zadání pojmenovává v souborech. */
export type PictureOrientation = 'landscape' | 'portrait';
export const PICTURE_ORIENTATIONS: readonly PictureOrientation[] = ['landscape', 'portrait'];

/** Rozměr obrázků podle otevřené otázky 2 (na šířku 3 : 2, na výšku 2 : 3). */
export const PICTURE_SIZE: Readonly<
  Record<PictureOrientation, { readonly width: number; readonly height: number }>
> = {
  landscape: { width: 1200, height: 800 },
  portrait: { width: 800, height: 1200 },
};

/** Nejvýš tolik bajtů smí mít obrázek i symbol cíle (AC5). */
export const MAX_MAP_FILE_BYTES = 49_152;

/** Symbol cíle podle tématu (AC2) a jeho jméno v sadě Noto Emoji. */
export const GOAL_SYMBOLS: Readonly<
  Record<MapThemeId, { readonly emoji: string; readonly notoName: string }>
> = {
  island: { emoji: '💎', notoName: 'gem-stone' },
  forest: { emoji: '🍄', notoName: 'mushroom' },
  castle: { emoji: '🏰', notoName: 'castle' },
  underwater: { emoji: '🐚', notoName: 'spiral-shell' },
  space: { emoji: '🪐', notoName: 'ringed-planet' },
};

export function pictureFileName(theme: MapThemeId, orientation: PictureOrientation): string {
  return `${theme}-${orientation}.webp`;
}

export function goalSymbolFileName(theme: MapThemeId): string {
  return `goal-${theme}.svg`;
}

function withoutPrefix(path: string): string {
  return path.replace('../../../', '');
}

/** Obrázky WebP ve složce map jako `data:` adresy, klíč je cesta od kořene. */
export const PICTURE_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../src/games/counting/maps/*.webp', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [withoutPrefix(path), dataUrl]),
);

/** Symboly cíle SVG ve složce map jako text, klíč je cesta od kořene. */
export const SYMBOL_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../src/games/counting/maps/*.svg', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, content]) => [withoutPrefix(path), content]),
);

/** Všechny soubory ve složce map (jakéhokoli druhu), cesty od kořene. */
export const MAPS_FOLDER_FILES: readonly string[] = Object.keys(
  import.meta.glob('../../../src/games/counting/maps/*', { query: '?url', eager: false }),
).map(withoutPrefix);

export function picturePath(theme: MapThemeId, orientation: PictureOrientation): string {
  return `${MAPS_FOLDER}/${pictureFileName(theme, orientation)}`;
}

export function symbolPath(theme: MapThemeId): string {
  return `${MAPS_FOLDER}/${goalSymbolFileName(theme)}`;
}

/** Text souboru s licencemi zdrojů třetích stran (`public/licence.txt`). */
export const LICENCE_TEXT: string = licenceText;

export function bytesOf(dataUrl: string): Uint8Array<ArrayBuffer> {
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

export interface WebpHeader {
  readonly width: number;
  readonly height: number;
}

/** Rozměr z hlavičky WebP, nebo `null`, když soubor WebP není (jako u dlaždic, #122). */
export function webpHeader(bytes: Uint8Array): WebpHeader | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') {
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

/** SHA-256 obsahu souboru jako 64 malých šestnáctkových číslic. */
export async function sha256Of(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Adresy mimo soubor (bez jmenných prostorů XML), jako u ikon Omalovánek (#106). */
export function externalReferences(svg: string): string[] {
  const withoutNamespaces = svg.replace(/\sxmlns(:[\w-]+)?\s*=\s*("[^"]*"|'[^']*')/g, '');
  return withoutNamespaces.match(/(https?:)?\/\/[^\s"')]+/g) ?? [];
}

/** Je adresa ze stejné stránky (`data:` nebo cesta bez serveru)? */
export function isSameOrigin(url: string): boolean {
  if (url === '') {
    return false;
  }
  if (url.startsWith('data:image/')) {
    return true;
  }
  return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//');
}

/** Odstavce licence (oddělené prázdným řádkem), které obsahují `needle`. */
export function licenceParagraphsWith(needle: string): string[] {
  return LICENCE_TEXT.split(/\n\s*\n/).filter((paragraph) => paragraph.includes(needle));
}
