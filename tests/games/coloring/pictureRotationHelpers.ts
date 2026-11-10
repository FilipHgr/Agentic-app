/**
 * Pomůcky pro testy obrázku v Omalovánkách na výšku i na šířku (#111,
 * od #127 bez otočení). Dotyk na obrazovce (herní jednotky) se převádí na
 * bod vrstvy barev čistou funkcí `pictureLayerPoint(layout, layer, x, y)`
 * z `coloringLayout.ts`.
 *
 * Co je „přesně pod prstem“, říká zadání (#127 AC2) a testy to počítají
 * samy, nezávisle na implementaci: obrázek není otočený v žádném okně
 * (#127 AC1, ani na výšku). Levý horní roh obrázku na obrazovce je levý
 * horní roh omalovánky, doprava roste x, dolů y. Do #127 byl obrázek na
 * výšku otočený o 90° po směru hodinových ručiček (#111 AC1).
 *
 * Vrstva barev hry má 1024 × 768 pixelů (poměr 4 : 3).
 */

import { pictureLayerPoint } from '../../../src/games/coloring/logic/coloringLayout';
import type { ColoringLayout, LayerSize } from '../../../src/games/coloring/logic/coloringLayout';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { Box } from '../../shared/viewportFixtures';
import type { ColoringCase } from './coloringLayoutScenes';
import type { Point } from './outlineFixtures';

/** Vrstva barev hry (`ColoringScene`): 1024 × 768 pixelů. */
export const LAYER = { width: 1024, height: 768 } as const;

/**
 * Bod omalovánky pod prstem podle zadání (viz úvod souboru), z bodu
 * obrazovky v herních jednotkách.
 */
export function expectedLayerPoint(
  testCase: ColoringCase,
  screen: Point,
  layer: LayerSize = LAYER,
): Point {
  const { picture } = testCase.layout;
  const across = (screen.x - picture.left) / picture.width;
  const down = (screen.y - picture.top) / picture.height;
  return { x: across * layer.width, y: down * layer.height };
}

/**
 * Kam na obrazovku (herní jednotky) musí dítě položit prst, aby se dotklo
 * bodu `point` omalovánky (obrácený převod k `expectedLayerPoint`).
 */
export function screenPointOf(
  testCase: ColoringCase,
  point: Point,
  layer: LayerSize = LAYER,
): Point {
  const { picture } = testCase.layout;
  const alongWidth = point.x / layer.width;
  const alongHeight = point.y / layer.height;
  return {
    x: picture.left + alongWidth * picture.width,
    y: picture.top + alongHeight * picture.height,
  };
}

/** Obdélník v CSS px okna převedený na herní jednotky rozložení. */
export function unitsOf(testCase: ColoringCase, box: Box): Box {
  const { scale, offsetX, offsetY } = testCase.area;
  return {
    left: (box.left - offsetX) / scale,
    right: (box.right - offsetX) / scale,
    top: (box.top - offsetY) / scale,
    bottom: (box.bottom - offsetY) / scale,
  };
}

/** Body rovnoměrně uvnitř obdélníku (kousek od okrajů), `steps` + 1 na stranu. */
export function pointsInside(box: Box, steps: number): Point[] {
  const inset = Math.min(box.right - box.left, box.bottom - box.top) / 100;
  const points: Point[] = [];
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      points.push({
        x: box.left + inset + ((box.right - box.left - 2 * inset) * column) / steps,
        y: box.top + inset + ((box.bottom - box.top - 2 * inset) * row) / steps,
      });
    }
  }
  return points;
}

/** Obrázek rozložení jako obdélník v herních jednotkách. */
export function pictureBoxOf(layout: ColoringLayout): Box {
  const { picture } = layout;
  return {
    left: picture.left,
    right: picture.left + picture.width,
    top: picture.top,
    bottom: picture.top + picture.height,
  };
}

/** Bod omalovánky, na který scéna převede dotyk prstu v bodě `screen`. */
export function touchedLayerPoint(
  testCase: ColoringCase,
  screen: Point,
  layer: LayerSize = LAYER,
): Point {
  return pictureLayerPoint(testCase.layout, layer, screen.x, screen.y);
}

/**
 * Dítě vede prst po obrazovce přes body `screenPath` (herní jednotky)
 * a nezvedne ho; scéna každý bod převede na bod omalovánky.
 */
export function fingerDown(
  game: SavedColoring,
  testCase: ColoringCase,
  screenPath: readonly Point[],
  layer: LayerSize = LAYER,
  id = 1,
): void {
  const [first, ...rest] = screenPath;
  if (first === undefined) {
    return;
  }
  const start = touchedLayerPoint(testCase, first, layer);
  game.pointerDown({ id, x: start.x, y: start.y, kind: 'touch' });
  for (const screen of rest) {
    const point = touchedLayerPoint(testCase, screen, layer);
    game.pointerMove({ id, x: point.x, y: point.y, kind: 'touch' });
  }
}

/** Celý tah prstem po obrazovce: dotyk, pohyb a zvednutí. */
export function fingerStroke(
  game: SavedColoring,
  testCase: ColoringCase,
  screenPath: readonly Point[],
  layer: LayerSize = LAYER,
  id = 1,
): void {
  fingerDown(game, testCase, screenPath, layer, id);
  game.pointerUp(id);
}

/** Body rovnoměrně na úsečce z `from` do `to` včetně konců. */
export function lineOf(from: Point, to: Point, steps: number): Point[] {
  return Array.from({ length: steps + 1 }, (_, step) => ({
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps,
  }));
}

/** Kolik pixelů se ve dvou obrázcích liší (stejný rozměr, po řádcích). */
export function differingPixels(
  first: ReadonlyArray<number | null>,
  second: ReadonlyArray<number | null>,
): number {
  let count = Math.abs(first.length - second.length);
  const length = Math.min(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    if (first[index] !== second[index]) {
      count += 1;
    }
  }
  return count;
}

/** Kolik pixelů je zabarvených. */
export function coloredCount(pixels: ReadonlyArray<number | null>): number {
  return pixels.filter((color) => color !== null).length;
}
