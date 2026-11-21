/**
 * Konfety oslavy, společné pro všechny hry. Čistý TypeScript bez Phaseru.
 */

import { STAR_STYLE } from './stars';
import { BLUE, SUCCESS_GREEN } from './theme';

/** Konfety oslavy: každá barva je na světlém pozadí vidět (aspoň 3 : 1). */
export const CONFETTI_COLORS: readonly string[] = [
  BLUE,
  SUCCESS_GREEN,
  '#FF3B30',
  '#AF52DE',
  '#C93400',
  STAR_STYLE.earnedOutlineColor,
];
