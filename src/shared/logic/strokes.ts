/**
 * Tahy prstem na ploše na psaní (#188), společné pro všechny hry, které
 * odpověď píšou prstem (Počítání číslice, Porovnávání znaménko). Tvar je
 * stejný jako v rozpoznávání číslic Počítání, takže se tahy dají předat
 * oběma. Čistý TypeScript bez Phaseru.
 */

/** Bod tahu v pixelech plochy na psaní, osa y míří dolů. */
export interface StrokePoint {
  readonly x: number;
  readonly y: number;
}

/** Jeden tah: body od položení prstu po jeho zvednutí. */
export type Stroke = readonly StrokePoint[];

/** Velikost plochy na psaní (levý horní roh je 0, 0). */
export interface WritingAreaSize {
  readonly width: number;
  readonly height: number;
}

/** Tahy z plochy `from` přepočtené na plochu `to` (po otočení zařízení). */
export function scaleStrokes(
  strokes: readonly Stroke[],
  from: WritingAreaSize,
  to: WritingAreaSize,
): Stroke[] {
  const scaleX = from.width > 0 ? to.width / from.width : 1;
  const scaleY = from.height > 0 ? to.height / from.height : 1;
  return strokes.map((stroke) =>
    stroke.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY })),
  );
}
