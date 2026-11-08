/**
 * Pomůcky pro testy velikosti čáry v Omalovánkách (#91). Velikost se
 * přepíná ťuknutím na přepínač v panelu, které scéna hlásí jako
 * `game.tapSizeToggle()`, vybraná velikost je `game.lineSize()`.
 *
 * Šířka stopy se měří na větším zkušebním obrázku 900 × 600
 * z `drawingToolHelpers.ts`: W je 900 / 50 = 18 px (malá), 900 / 30 = 30 px
 * (střední) a 900 / 15 = 60 px (velká). Vodorovný tah na řádku y 300 leží
 * celý v oblasti A, měří se jen ve sloupcích uprostřed tahu (daleko od
 * konců), takže kulatá i čtvercová stopa mají stejnou polovinu šířky.
 */

import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { BIG_HEIGHT, BIG_LINE_X, BIG_WIDTH, choose } from './drawingToolHelpers';
import type { Point } from './outlineFixtures';
import { at } from './strokeHelpers';
import { paint } from './savedPictureHelpers';

/** Velikosti v pořadí, ve kterém je přepínač prochází od malé (AC1). */
export const SIZES = ['small', 'medium', 'large'] as const satisfies readonly LineSize[];

export const SIZE_NAMES: Record<LineSize, string> = {
  small: 'malá',
  medium: 'střední',
  large: 'velká',
};

export const TOOL_NAMES: Record<ToolId, string> = {
  brush: 'štětec',
  eraser: 'guma',
  marker: 'fix',
  crayon: 'pastelka',
  rainbow: 'duhový štětec',
  stamp: 'razítkový fix',
  dots: 'puntíkový fix',
  stripes: 'proužkový fix',
};

/** W jako díl šířky plochy omalovánky (AC2), schválně ne konstanty z kódu. */
export const WIDTH_SHARE: Record<LineSize, number> = {
  small: 1 / 50,
  medium: 1 / 30,
  large: 1 / 15,
};

/** Šířka stopy nástroje v násobcích W podle jeho úkolu (#88, #90, #93, #97, #98, #101, #102). */
export const TOOL_FACTOR: Record<ToolId, number> = {
  brush: 1,
  eraser: 1.5,
  marker: 0.6,
  crayon: 0.5,
  rainbow: 1,
  // Razítkový fix (#98): hvězdičky vepsané do kruhu průměru 1,5 W.
  stamp: 1.5,
  // Puntíkový fix (#101): kulatá stopa 1,0 W, barví jen puntíky v ní.
  dots: 1,
  // Proužkový fix (#102): kulatá stopa 1,0 W, barví jen proužky v ní.
  stripes: 1,
};

/** Řádek vodorovného tahu a sloupce, ve kterých se měří. */
export const LINE_Y = 300;
export const MEASURE_FROM_X = 150;
export const MEASURE_TO_X = 300;

/** Vodorovný tah přes oblast A (konce daleko od měřených sloupců). */
export const HORIZONTAL: readonly Point[] = [at(60, LINE_Y), at(390, LINE_Y)];

/** Polovina šířky stopy nástroje `tool` velikosti `size` na obrázku 900 px. */
export function expectedHalf(tool: ToolId, size: LineSize): number {
  return (TOOL_FACTOR[tool] * WIDTH_SHARE[size] * BIG_WIDTH) / 2;
}

/**
 * Dítě ťuká na přepínač, dokud není vybraná velikost `size` (nejvýš třikrát
 * dokola). Vrátí tóny posledního ťuknutí.
 */
export function chooseSize(game: SavedColoring, size: LineSize): readonly Tone[] {
  let tones: readonly Tone[] = [];
  for (let tap = 0; tap < SIZES.length && game.lineSize() !== size; tap += 1) {
    tones = game.tapSizeToggle();
  }
  return tones;
}

/**
 * Jak daleko od řádku tahu (od středu pixelu) leží nejvzdálenější pixel
 * v měřených sloupcích, jehož barva splní `matches`.
 */
export function reachOf(game: SavedColoring, matches: (color: number | null) => boolean): number {
  let reach = 0;
  for (let y = 0; y < BIG_HEIGHT; y += 1) {
    for (let x = MEASURE_FROM_X; x < MEASURE_TO_X; x += 1) {
      if (matches(game.colorAt(x, y))) {
        reach = Math.max(reach, Math.abs(y + 0.5 - LINE_Y));
      }
    }
  }
  return reach;
}

/** Celou oblast A vybarví štětcem střední velikosti barvou `color`. */
export function fillAWithBrush(game: SavedColoring, color: number): void {
  game.tapColor(color);
  choose(game, 'brush');
  chooseSize(game, 'medium');
  for (let y = 0; y <= BIG_HEIGHT; y += 20) {
    const row = Math.min(y, BIG_HEIGHT - 1);
    paint(game, [at(4, row), at(BIG_LINE_X - 4, row)]);
  }
}

/** Kolik pixelů v měřených sloupcích nemá barvu. */
export function emptyInMeasuredColumns(game: SavedColoring): number {
  let empty = 0;
  for (let y = 0; y < BIG_HEIGHT; y += 1) {
    for (let x = MEASURE_FROM_X; x < MEASURE_TO_X; x += 1) {
      if (game.colorAt(x, y) === null) {
        empty += 1;
      }
    }
  }
  return empty;
}
