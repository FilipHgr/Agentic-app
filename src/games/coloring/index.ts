/**
 * Jediný vstup hry Omalovánky (#88): menu stahuje z Omalovánek jen tento
 * soubor, a to až po ťuknutí na dlaždici. `scenes` spustí
 * `src/shared/ui/gameRunner.ts`.
 */

import { COLORING_GAME_AREA_FIT } from './logic/coloringLayout';
import { PickerScene } from './scenes/PickerScene';

/**
 * Scény hry; první se spustí. Výběr omalovánky (#124) otevírá malování
 * (`ColoringScene`) sám, každé otevření novou scénou.
 */
export const scenes = [PickerScene];

/** Obrázek přes celou obrazovku: herní plocha přes celou volnou plochu okna i na iPadu (#96). */
export const gameAreaFit = COLORING_GAME_AREA_FIT;
