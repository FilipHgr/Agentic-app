/**
 * Tahy prstem nebo tužkou pro testy Omalovánek (#88). Body jsou
 * v pixelech mapy oblastí, bod mimo obrázek je „mimo plochu“.
 */

import type {
  Coloring,
  PointerKind,
  PointerSample,
} from '../../../src/games/coloring/logic/coloring';
import type { Point } from './outlineFixtures';

export function pointer(id: number, point: Point, kind: PointerKind = 'touch'): PointerSample {
  return { id, x: point.x, y: point.y, kind };
}

/** Celý tah jedním prstem: dotyk na prvním bodě, pohyb přes ostatní, zvednutí. */
export function stroke(
  coloring: Coloring,
  path: readonly Point[],
  color: number,
  options: { id?: number; kind?: PointerKind } = {},
): void {
  const id = options.id ?? 1;
  const kind = options.kind ?? 'touch';
  const [first, ...rest] = path;
  if (first === undefined) {
    return;
  }
  coloring.pointerDown(pointer(id, first, kind), color);
  for (const point of rest) {
    coloring.pointerMove(pointer(id, point, kind));
  }
  coloring.pointerUp(id);
}

export function at(x: number, y: number): Point {
  return { x, y };
}
