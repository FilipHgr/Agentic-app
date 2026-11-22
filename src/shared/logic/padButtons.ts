/**
 * Jednotný vzhled tlačítek u plochy na psaní (#45, #46, od #188 sdílený):
 * zaoblení i tloušťka fajfky ✓ podle velikosti tlačítka. Čistý TypeScript
 * bez Phaseru.
 */

/** Zaoblení rohu jako část strany tlačítka. */
const CORNER_RADIUS_RATIO = 0.25;

/** Tloušťka fajfky jako část strany tlačítka. */
const TICK_WIDTH_RATIO = 0.13;

export interface CheckButtonStyle {
  readonly cornerRadius: number;
  readonly tickWidth: number;
}

/** Zaoblení rohu tlačítka o straně `size`, na celé px (#46, #52): 140 → 35, 116 → 29. */
export function buttonCornerRadius(size: number): number {
  return Math.round(size * CORNER_RADIUS_RATIO);
}

/** Zaoblení a tloušťka fajfky pro tlačítko ✓ o straně `size`. */
export function checkButtonStyle(size: number): CheckButtonStyle {
  return { cornerRadius: buttonCornerRadius(size), tickWidth: size * TICK_WIDTH_RATIO };
}
