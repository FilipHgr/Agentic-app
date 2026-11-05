/**
 * Vstup stránky (#67): stránka začíná v menu s výběrem her. Hra se
 * stáhne a spustí až po ťuknutí na její dlaždici.
 */

import { GAMES } from './gameList';
import { registerGameImport } from './menu/ui/gameImport';
import { startMenuPage } from './menu/ui/menuPage';
import { GAME_CATEGORIES } from './shared/logic/gameRegistry';

// Dřív než menu: menu může hru začít stahovat hned po prvním ťuknutí.
registerGameImport();
startMenuPage({ games: GAMES, categories: GAME_CATEGORIES });
