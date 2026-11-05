/**
 * Seznam her v pořadí, v jakém je menu ukáže (#67). Leží vedle vstupu
 * stránky, protože importuje hry a sdílená část hry importovat nesmí.
 * Z každé hry se hned načte jen malý `meta.ts`, celá hra (`index.ts`)
 * se stáhne až po ťuknutí na její dlaždici.
 */

import { COUNTING_META } from './games/counting/meta';
import { gameEntry } from './shared/logic/gameRegistry';
import type { GameEntry, GameMeta } from './shared/logic/gameRegistry';

/** Údaje všech her pro menu, ve stejném pořadí jako `GAMES`. */
export const GAME_METAS: readonly GameMeta[] = [COUNTING_META];

export const GAMES: readonly GameEntry[] = [
  gameEntry(COUNTING_META, () => import('./games/counting')),
];
