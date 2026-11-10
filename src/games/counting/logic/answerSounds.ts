/**
 * Jaký zvuk hra zahraje po ťuknutí a z jakých tónů se skládá.
 * Čistý TypeScript bez Phaseru a bez Web Audio, aby šel testovat bez prohlížeče.
 */

import type { TapOutcome } from './answerRound';
import type { Tone } from '../../../shared/audio/tonePlayer';

export type SoundName = 'correct' | 'wrong' | 'celebration' | 'hint' | 'mapStep';

/** Veselá stoupající melodie C5, E5, G5. */
const CORRECT_TONES: readonly Tone[] = [
  { frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.12, volume: 0.35 },
  { frequencyHz: 659.25, startSeconds: 0.1, durationSeconds: 0.12, volume: 0.35 },
  { frequencyHz: 783.99, startSeconds: 0.2, durationSeconds: 0.22, volume: 0.35 },
];

/** Jeden krátký, tichý a hluboký tón, žádný bzučák. */
const WRONG_TONES: readonly Tone[] = [
  { frequencyHz: 220, startSeconds: 0, durationSeconds: 0.18, volume: 0.2 },
];

/** Delší slavnostní melodie po zaplnění řady hvězdiček (asi 2 s). */
const CELEBRATION_TONES: readonly Tone[] = [
  { frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.15, volume: 0.35 },
  { frequencyHz: 659.25, startSeconds: 0.15, durationSeconds: 0.15, volume: 0.35 },
  { frequencyHz: 783.99, startSeconds: 0.3, durationSeconds: 0.15, volume: 0.35 },
  { frequencyHz: 1046.5, startSeconds: 0.45, durationSeconds: 0.3, volume: 0.35 },
  { frequencyHz: 783.99, startSeconds: 0.8, durationSeconds: 0.15, volume: 0.35 },
  { frequencyHz: 1046.5, startSeconds: 0.95, durationSeconds: 0.15, volume: 0.35 },
  { frequencyHz: 1318.51, startSeconds: 1.1, durationSeconds: 0.25, volume: 0.35 },
  { frequencyHz: 1046.5, startSeconds: 1.4, durationSeconds: 0.6, volume: 0.35 },
];

/** Krátký jemný tón po ťuknutí na tlačítko nápovědy (#84); není to odpověď. */
const HINT_TONES: readonly Tone[] = [
  { frequencyHz: 587.33, startSeconds: 0, durationSeconds: 0.1, volume: 0.25 },
];

/** Krátké „cupity“ dvou tónů, když značka na mapě postoupí o krok (#87, kratší než 1 s). */
const MAP_STEP_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.1, volume: 0.3 },
  { frequencyHz: 880, startSeconds: 0.12, durationSeconds: 0.18, volume: 0.3 },
];

export const SOUNDS: Readonly<Record<SoundName, readonly Tone[]>> = {
  correct: CORRECT_TONES,
  wrong: WRONG_TONES,
  celebration: CELEBRATION_TONES,
  hint: HINT_TONES,
  mapStep: MAP_STEP_TONES,
};

/** Vrátí zvuk pro výsledek ťuknutí, nebo `null`, když se nemá ozvat nic. */
export function soundForOutcome(outcome: TapOutcome): SoundName | null {
  switch (outcome) {
    case 'correct':
      return 'correct';
    case 'wrong':
      return 'wrong';
    case 'ignored':
      return null;
  }
}

/** Jak dlouho zvuk hraje, v sekundách. */
export function soundLengthSeconds(tones: readonly Tone[]): number {
  return Math.max(0, ...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}
