/**
 * Zvuky menu (#67): zmáčknutí dlaždice, tiché zhoupnutí a zatřesení po
 * selhání (stejně tiché a hluboké jako špatná odpověď v Počítání).
 * Čistý TypeScript bez Phaseru a bez Web Audio.
 */

import type { Tone } from '../../shared/audio/tonePlayer';

export type MenuSoundName = 'press' | 'select' | 'wobble' | 'shake';

export const MENU_SOUNDS: Readonly<Record<MenuSoundName, readonly Tone[]>> = {
  /** Krátké veselé „ťuk“ o dvou tónech. */
  press: [
    { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.25 },
    { frequencyHz: 880, startSeconds: 0.06, durationSeconds: 0.1, volume: 0.25 },
  ],
  /** Tichý krátký tón po výběru nové kategorie. */
  select: [{ frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.07, volume: 0.12 }],
  /** Tichý krátký tón, nic se nestalo. */
  wobble: [{ frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.12 }],
  /** Jeden krátký, tichý a hluboký tón, žádný bzučák. */
  shake: [{ frequencyHz: 220, startSeconds: 0, durationSeconds: 0.18, volume: 0.2 }],
};
