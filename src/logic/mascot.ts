/**
 * Jak maskot (sovička) reaguje na to, co hráč udělal. Čistý TypeScript
 * bez Phaseru, scéna podle toho jen spustí animaci.
 */

import type { TapOutcome } from './answerRound';

/**
 * - `idle`: hráč nic nedělá, sovička se pohupuje a mrká
 * - `joy`: radost ze správné odpovědi, vyskočí a mávne křídly
 * - `encourage`: po chybě povzbudivě kývne
 * - `dance`: oslava po zaplnění řady hvězdiček
 */
export type MascotReaction = 'idle' | 'joy' | 'encourage' | 'dance';

/** Výraz očí sovičky. Smutný ani zamračený výraz záměrně neexistuje. */
export type MascotExpression = 'open' | 'happy';

/** Všechny reakce, které sovička umí. */
export const MASCOT_REACTIONS: readonly MascotReaction[] = ['idle', 'joy', 'encourage', 'dance'];

/**
 * Reakce na ťuknutí. `null` znamená, že sovička pokračuje v tom, co dělá.
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

/** Výraz očí při dané reakci: radost a tanec mají veselé oči, jinak otevřené. */
export function mascotExpression(reaction: MascotReaction): MascotExpression {
  return reaction === 'joy' || reaction === 'dance' ? 'happy' : 'open';
}
