/**
 * Tóny Porovnávání (#178): veselá melodie za správnou odpověď, jeden
 * tichý hluboký tón za chybu (žádný bzučák) a slavnostní melodie po
 * zaplnění řady hvězdiček. Nápověda (#180) jemně cinká při spojení
 * každé dvojice teček. Čistý TypeScript bez Web Audio.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';

export type CompareSoundName = 'correct' | 'wrong' | 'celebration' | 'pair';

const CORRECT_TONES: readonly Tone[] = [
  { frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.12, volume: 0.35 },
  { frequencyHz: 659.25, startSeconds: 0.1, durationSeconds: 0.12, volume: 0.35 },
  { frequencyHz: 783.99, startSeconds: 0.2, durationSeconds: 0.22, volume: 0.35 },
];

const WRONG_TONES: readonly Tone[] = [
  { frequencyHz: 220, startSeconds: 0, durationSeconds: 0.18, volume: 0.2 },
];

/** Spojení dvojice teček v nápovědě (#180): krátké tiché cinknutí. */
const PAIR_TONES: readonly Tone[] = [
  { frequencyHz: 880, startSeconds: 0, durationSeconds: 0.06, volume: 0.12 },
];

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

export const COMPARE_SOUNDS: Readonly<Record<CompareSoundName, readonly Tone[]>> = {
  correct: CORRECT_TONES,
  wrong: WRONG_TONES,
  celebration: CELEBRATION_TONES,
  pair: PAIR_TONES,
};
