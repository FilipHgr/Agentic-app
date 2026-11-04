/**
 * Jednotný vzhled tlačítek (#45, #46): stejná zelená, zaoblení i tloušťka
 * fajfky podle velikosti tlačítka. Čistý TypeScript bez Phaseru.
 */

/** Zelená tlačítek ✓ a správné odpovědi. */
export const CHECK_BUTTON_COLOR = 0x8be04e;

/** Zaoblení rohu jako část strany tlačítka. */
const CORNER_RADIUS_RATIO = 0.18;

/** Tloušťka fajfky jako část strany tlačítka. */
const TICK_WIDTH_RATIO = 0.13;

export interface CheckButtonStyle {
  readonly cornerRadius: number;
  readonly tickWidth: number;
}

/** Zaoblení rohu tlačítka o straně `size`, na celé px (#46): 140 → 25, 116 → 21. */
export function buttonCornerRadius(size: number): number {
  return Math.round(size * CORNER_RADIUS_RATIO);
}

/** Zaoblení a tloušťka fajfky pro tlačítko ✓ o straně `size`. */
export function checkButtonStyle(size: number): CheckButtonStyle {
  return { cornerRadius: buttonCornerRadius(size), tickWidth: size * TICK_WIDTH_RATIO };
}
