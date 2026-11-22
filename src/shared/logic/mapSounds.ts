/**
 * Zvuky mapy postupu (#87, #135, #139), společné všem hrám s hvězdičkami
 * (#193): krok značky, dojití do cíle a půlka klíče. Čistý TypeScript bez
 * Phaseru a bez Web Audio, aby šel testovat bez prohlížeče.
 */

import type { Tone } from '../audio/tonePlayer';

export type MapSoundName = 'mapStep' | 'mapGoal' | 'keyReward';

/** Krátké „cupity“ dvou tónů, když značka na mapě postoupí o krok (#87, kratší než 1 s). */
const MAP_STEP_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.1, volume: 0.3 },
  { frequencyHz: 880, startSeconds: 0.12, durationSeconds: 0.18, volume: 0.3 },
];

/**
 * Krátká vítězná melodie, když značka dojde do cíle mapy (#135 AC3, kratší
 * než 2 s): rychlý běh nahoru a dlouhý vysoký tón.
 */
const MAP_GOAL_TONES: readonly Tone[] = [
  { frequencyHz: 783.99, startSeconds: 0, durationSeconds: 0.12, volume: 0.3 },
  { frequencyHz: 1046.5, startSeconds: 0.12, durationSeconds: 0.12, volume: 0.3 },
  { frequencyHz: 1318.51, startSeconds: 0.24, durationSeconds: 0.12, volume: 0.3 },
  { frequencyHz: 1567.98, startSeconds: 0.36, durationSeconds: 0.2, volume: 0.3 },
  { frequencyHz: 1318.51, startSeconds: 0.6, durationSeconds: 0.12, volume: 0.3 },
  { frequencyHz: 2093, startSeconds: 0.74, durationSeconds: 0.5, volume: 0.28 },
];

/**
 * Krátké zacinkání, když se u cíle objeví půlka klíče (#139 AC2, asi 0,4 s):
 * dva jasné tóny, tišší než melodie cíle, která už dohrála.
 */
const KEY_REWARD_TONES: readonly Tone[] = [
  { frequencyHz: 1760, startSeconds: 0, durationSeconds: 0.1, volume: 0.25 },
  { frequencyHz: 2349.32, startSeconds: 0.12, durationSeconds: 0.28, volume: 0.25 },
];

export const MAP_SOUNDS: Readonly<Record<MapSoundName, readonly Tone[]>> = {
  mapStep: MAP_STEP_TONES,
  mapGoal: MAP_GOAL_TONES,
  keyReward: KEY_REWARD_TONES,
};

/** Jak dlouho zvuk hraje, v sekundách. */
export function soundLengthSeconds(tones: readonly Tone[]): number {
  return Math.max(0, ...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}
