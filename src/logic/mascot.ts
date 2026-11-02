/**
 * Jak postavička vedle příkladu reaguje na to, co hráč udělal. Čistý
 * TypeScript bez Phaseru, scéna podle toho jen spustí animaci a obrázek.
 */

import type { TapOutcome } from './answerRound';
import type { CharacterMood } from './characters';

/**
 * - `idle`: hráč nic nedělá, postavička se pohupuje a mrká
 * - `joy`: radost ze správné odpovědi
 * - `encourage`: po chybě povzbudí
 * - `dance`: oslava po zaplnění řady hvězdiček
 */
export type MascotReaction = 'idle' | 'joy' | 'encourage' | 'dance';

/** Všechny reakce, které postavička umí. */
export const MASCOT_REACTIONS: readonly MascotReaction[] = ['idle', 'joy', 'encourage', 'dance'];

/**
 * Reakce na ťuknutí. `null` znamená, že postavička pokračuje v tom, co dělá.
 *
 * @param setCompleted Hráč právě zaplnil řadu hvězdiček a přijde oslava.
 */
export function mascotReactionToTap(
  outcome: TapOutcome,
  setCompleted: boolean,
): MascotReaction | null {
  switch (outcome) {
    case 'correct':
      return setCompleted ? 'dance' : 'joy';
    case 'wrong':
      return 'encourage';
    case 'ignored':
      return null;
  }
}

/** Obrázek nálady, který postavička při reakci ukáže. */
export function moodForReaction(reaction: MascotReaction): CharacterMood {
  switch (reaction) {
    case 'idle':
      return 'klid';
    case 'joy':
      return 'radost';
    case 'encourage':
      return 'povzbuzeni';
    case 'dance':
      return 'oslava';
  }
}
