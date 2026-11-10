/**
 * Jediný vstup hry Počítání (#64): menu stahuje z Počítání jen tento
 * soubor, a to až po ťuknutí na dlaždici (#67). `scenes` spustí
 * `src/shared/ui/gameRunner.ts`.
 */

import { GameScene } from './scenes/GameScene';

/** Scény hry; první se spustí. */
export const scenes = [GameScene];
