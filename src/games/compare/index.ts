/**
 * Jediný vstup hry Porovnávání (#178): menu stahuje z Porovnávání jen
 * tento soubor, a to až po ťuknutí na dlaždici. `scenes` spustí
 * `src/shared/ui/gameRunner.ts`.
 */

import { COMPARE_GAME_AREA_FIT } from './logic/compareLayout';
import { CompareScene } from './scenes/CompareScene';

/** Scény hry; první se spustí. */
export const scenes = [CompareScene];

/** Karty přes celou volnou plochu okna, i na iPadu. */
export const gameAreaFit = COMPARE_GAME_AREA_FIT;
