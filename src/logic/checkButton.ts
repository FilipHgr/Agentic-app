/**
 * Jednotný vzhled tlačítek ✓ (#45, #46): stejná zelená, zaoblení i tloušťka
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

/** Zaoblení a tloušťka fajfky pro tlačítko ✓ o straně `size`. */
export function checkButtonStyle(size: number): CheckButtonStyle {
  return { cornerRadius: size * CORNER_RADIUS_RATIO, tickWidth: size * TICK_WIDTH_RATIO };
}
