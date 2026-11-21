/**
 * Repliky pandy Rudyho v Omalovánkách (#175): pozdrav po otevření hry
 * a dvě pochvaly obrázku uloženého do alba, které se střídají. Text je
 * v textech hry (`rudyLines`), zazní jen nahrávka hlasem postavičky
 * v jazyce zvoleném v menu.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

export const COLORING_RUDY_LINES = ['greeting', 'praiseBeautiful', 'praiseColors'] as const;

export type ColoringRudyLine = (typeof COLORING_RUDY_LINES)[number];

/** Pochvaly obrázku v albu v pořadí, ve kterém se střídají. */
export const COLORING_RUDY_PRAISES = [
  'praiseBeautiful',
  'praiseColors',
] as const satisfies readonly ColoringRudyLine[];

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/coloring/rudy-<id>.mp3`). */
export function coloringRudyVoiceUrl(
  line: ColoringRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/coloring/rudy-${line}.mp3`;
}
