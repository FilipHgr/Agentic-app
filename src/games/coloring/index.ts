/**
 * Jediný vstup hry Omalovánky (#88): menu stahuje z Omalovánek jen tento
 * soubor, a to až po ťuknutí na dlaždici. `scenes` spustí
 * `src/shared/ui/gameRunner.ts`.
 */

import { ColoringScene } from './scenes/ColoringScene';

/** Scény hry; první se spustí. */
export const scenes = [ColoringScene];
