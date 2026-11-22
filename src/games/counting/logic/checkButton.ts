/**
 * Jednotný vzhled tlačítek (#45, #46): stejná zelená, zaoblení i tloušťka
 * fajfky podle velikosti tlačítka. Zaoblení a fajfka jsou od #188 ve
 * sdílené části (`src/shared/logic/padButtons.ts`), aby je měly všechny
 * hry s psaním prstem stejné. Čistý TypeScript bez Phaseru.
 */

import { CONFIRM_BUTTON_STYLE } from './theme';
import { colorNumber } from '../../../shared/logic/theme';

/** Zelená tlačítek ✓ a správné odpovědi, ze světlého vzhledu (#52). */
export const CHECK_BUTTON_COLOR = colorNumber(CONFIRM_BUTTON_STYLE.background);

export { buttonCornerRadius, checkButtonStyle } from '../../../shared/logic/padButtons';
export type { CheckButtonStyle } from '../../../shared/logic/padButtons';
