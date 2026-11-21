/**
 * Repliky pandy Rudyho v Počítání (#171): pozdrav po otevření hry a oslava
 * po 10 hvězdičkách. Text je v textech hry (`rudyLines`), zazní jen
 * nahrávka hlasem postavičky v jazyce zvoleném v menu.
 */

import type { RudyLineMove } from '../../../shared/logic/rudy';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

export const COUNTING_RUDY_LINES = ['greeting', 'celebration'] as const;

export type CountingRudyLine = (typeof COUNTING_RUDY_LINES)[number];

/** Replika k pohybu okna: pozdrav mává, oslava slaví. */
export function countingRudyLineOf(move: RudyLineMove): CountingRudyLine {
  return move === 'celebrate' ? 'celebration' : 'greeting';
}

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/counting/rudy-<id>.mp3`). */
export function countingRudyVoiceUrl(
  line: CountingRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/counting/rudy-${line}.mp3`;
}
