/**
 * Obrázky map postupu (#134 AC1, AC2, AC5): ke každé z 5 map obrázek
 * prostředí na šířku a na výšku a symbol cíle ze sady Noto Emoji. Soubory
 * jsou ve složce `../maps/` a Vite je přibalí ke hře jako samostatné
 * soubory (symboly `?no-inline`), takže se stahují jen ze stejné stránky.
 * Tady jsou jen adresy, rozměry a výpočet, kam obrázek v okně nakreslit;
 * stahuje a kreslí scéna. Čistý TypeScript bez Phaseru.
 */

import type { GameSize } from '../../../shared/logic/viewportLayout';
import type { MapThemeId } from './progressMap';
import castleLandscape from '../maps/castle-landscape.webp';
import castlePortrait from '../maps/castle-portrait.webp';
import forestLandscape from '../maps/forest-landscape.webp';
import forestPortrait from '../maps/forest-portrait.webp';
import goalCastle from '../maps/goal-castle.svg?no-inline';
import goalForest from '../maps/goal-forest.svg?no-inline';
import goalIsland from '../maps/goal-island.svg?no-inline';
import goalSpace from '../maps/goal-space.svg?no-inline';
import goalUnderwater from '../maps/goal-underwater.svg?no-inline';
import islandLandscape from '../maps/island-landscape.webp';
import islandPortrait from '../maps/island-portrait.webp';
import spaceLandscape from '../maps/space-landscape.webp';
import spacePortrait from '../maps/space-portrait.webp';
import underwaterLandscape from '../maps/underwater-landscape.webp';
import underwaterPortrait from '../maps/underwater-portrait.webp';

/** Obrázek na šířku (3 : 2), nebo na výšku (2 : 3). */
export type MapOrientation = 'landscape' | 'portrait';

export const MAP_ORIENTATIONS: readonly MapOrientation[] = ['landscape', 'portrait'];

/** Rozměr obrázků v px (otevřená otázka 2). */
export const MAP_PICTURE_SIZE: Readonly<Record<MapOrientation, GameSize>> = {
  landscape: { width: 1200, height: 800 },
  portrait: { width: 800, height: 1200 },
};

const PICTURE_URLS: Readonly<Record<MapThemeId, Readonly<Record<MapOrientation, string>>>> = {
  island: { landscape: islandLandscape, portrait: islandPortrait },
  forest: { landscape: forestLandscape, portrait: forestPortrait },
  castle: { landscape: castleLandscape, portrait: castlePortrait },
  underwater: { landscape: underwaterLandscape, portrait: underwaterPortrait },
  space: { landscape: spaceLandscape, portrait: spacePortrait },
};

/** Okno širší než vyšší dostane obrázek na šířku, jinak na výšku. */
export function mapOrientationOf(window: GameSize): MapOrientation {
  return window.width > window.height ? 'landscape' : 'portrait';
}

/** Adresa obrázku mapy `theme` v orientaci `orientation` (ze stejné stránky). */
export function mapPictureUrl(theme: MapThemeId, orientation: MapOrientation): string {
  return PICTURE_URLS[theme][orientation];
}

/** Obdélník v CSS px okna; může přesahovat okno. */
export interface PictureRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Kladné konečné číslo, jinak 0 (prohlížeč může na chvíli poslat nesmyslné okno). */
function usableLength(length: number): number {
  return Number.isFinite(length) && length > 0 ? length : 0;
}

/**
 * Kam obrázek `picture` nakreslit, aby zakryl celé okno včetně výřezu
 * a lišty a zachoval poměr stran (jako CSS `object-fit: cover`). Obrázek
 * se zvětší jen tolik, aby přesně vyplnil šířku, nebo výšku okna, a leží
 * na středu; co přečnívá, se ořízne.
 */
export function mapPictureCover(window: GameSize, picture: GameSize): PictureRect {
  const windowWidth = usableLength(window.width);
  const windowHeight = usableLength(window.height);
  const pictureWidth = usableLength(picture.width);
  const pictureHeight = usableLength(picture.height);
  if (pictureWidth === 0 || pictureHeight === 0) {
    return { left: 0, top: 0, width: windowWidth, height: windowHeight };
  }
  const scale = Math.max(windowWidth / pictureWidth, windowHeight / pictureHeight);
  const width = pictureWidth * scale;
  const height = pictureHeight * scale;
  return { left: (windowWidth - width) / 2, top: (windowHeight - height) / 2, width, height };
}

/** Symbol cíle mapy (AC2): emoji, jméno v sadě Noto, soubor a jeho adresa. */
export interface MapGoalSymbol {
  readonly emoji: string;
  readonly notoName: string;
  readonly file: string;
  readonly url: string;
}

export const MAP_GOAL_SYMBOLS: Readonly<Record<MapThemeId, MapGoalSymbol>> = {
  island: { emoji: '💎', notoName: 'gem-stone', file: 'goal-island.svg', url: goalIsland },
  forest: { emoji: '🍄', notoName: 'mushroom', file: 'goal-forest.svg', url: goalForest },
  castle: { emoji: '🏰', notoName: 'castle', file: 'goal-castle.svg', url: goalCastle },
  underwater: {
    emoji: '🐚',
    notoName: 'spiral-shell',
    file: 'goal-underwater.svg',
    url: goalUnderwater,
  },
  space: { emoji: '🪐', notoName: 'ringed-planet', file: 'goal-space.svg', url: goalSpace },
};
