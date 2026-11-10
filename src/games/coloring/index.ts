/**
 * Jediný vstup hry Omalovánky (#88): menu stahuje z Omalovánek jen tento
 * soubor, a to až po ťuknutí na dlaždici. `scenes` spustí
 * `src/shared/ui/gameRunner.ts`.
 */

import { COLORING_GAME_AREA_FIT } from './logic/coloringLayout';
import { ColoringScene } from './scenes/ColoringScene';

/** Scény hry; první se spustí. */
export const scenes = [ColoringScene];

/** Obrázek přes celou obrazovku: herní plocha přes celou volnou plochu okna i na iPadu (#96). */
export const gameAreaFit = COLORING_GAME_AREA_FIT;
