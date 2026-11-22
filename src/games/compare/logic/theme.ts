/**
 * Barvy a tloušťky Porovnávání (#178) ve stylu ostatních her: bílé karty
 * na světlém pozadí, tečky dvou barev (každá karta jiná, obě s kontrastem
 * aspoň 3 : 1 proti bílé) a „=“ jako tlačítka s čísly v Počítání.
 * Čistý TypeScript bez Phaseru.
 */

import { BLUE, SUCCESS_GREEN, WHITE } from '../../../shared/logic/theme';

export const CARD_STYLE = {
  fill: WHITE,
  border: '#D2D2D7',
  /** Okraj karty po správném ťuknutí. */
  correctBorder: SUCCESS_GREEN,
  /** Tloušťka okraje v CSS px. */
  borderWidth: 2,
  correctBorderWidth: 4,
} as const;

/** Barva teček levé a pravé karty. */
export const DOT_COLORS = ['#0062CC', '#C2410C'] as const;

export const EQUAL_BUTTON_STYLE = {
  fill: '#E5F0FF',
  border: '#B8D6FF',
  borderWidth: 2,
  symbolColor: BLUE,
  fontWeight: 'bold',
} as const;

export const SIGN_STYLE = {
  color: SUCCESS_GREEN,
  fontWeight: 'bold',
} as const;
