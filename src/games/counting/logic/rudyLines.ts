/**
 * Repliky pandy Rudyho v Počítání (#171): oslava po 10 hvězdičkách (od #186
 * jediná chvíle s Rudym, pozdrav není). Text je v textech hry
 * (`rudyLines`), zazní jen nahrávka hlasem postavičky v jazyce zvoleném
 * v menu.
 *
 * Oslava má několik variant (#176), které se v profilu střídají, takže
 * Rudy nikdy neřekne stejnou repliku dvakrát po sobě. Poslední varianta
 * je v úložišti hry profilu.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { openRudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import type { RudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

/** Oslavy po 10 hvězdičkách v pořadí střídání; první je ta z #171. */
export const COUNTING_RUDY_LINES = ['celebration', 'celebrationStars', 'celebrationStar'] as const;

export type CountingRudyLine = (typeof COUNTING_RUDY_LINES)[number];

/** Klíč poslední varianty v úložišti hry profilu. */
export const COUNTING_RUDY_VARIANT_KEY = 'rudyLine.celebration';

/**
 * Střídání oslav Počítání v úložišti hry profilu (bez úložiště jen
 * v paměti): `upcoming` řekne repliku, která zazní příště, `said` ji
 * zapamatuje, až se Rudy opravdu ukáže. Hra označení profilu nedostane;
 * při zakázaném nebo plném úložišti podrží poslední variantu úložiště
 * profilu od stránky v paměti do zavření stránky.
 */
export function countingRudyLines(
  storage: KeyValueStorage | undefined,
): RudyVariants<CountingRudyLine> {
  return openRudyVariants(storage, COUNTING_RUDY_VARIANT_KEY, COUNTING_RUDY_LINES);
}

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/counting/rudy-<id>.mp3`). */
export function countingRudyVoiceUrl(
  line: CountingRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/counting/rudy-${line}.mp3`;
}
