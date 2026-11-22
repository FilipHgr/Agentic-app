/**
 * Repliky pandy Rudyho v Porovnávání (#181): oslava po 10 hvězdičkách (od
 * #186 jediná chvíle s Rudym, pozdrav není). Text je v textech hry
 * (`rudyLines`), zazní jen nahrávka hlasem postavičky v jazyce zvoleném
 * v menu.
 *
 * Od #187 je oslava jediná („Hurá! Máš deset hvězdiček!“): oslava „kde je
 * víc“ zmizela s otázkou víc/míň. Střídání variant v profilu (#176) zůstává,
 * takže přibude-li varianta, začne se střídat sama; záznam s odebranou
 * variantou dá první variantu.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { openRudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import type { RudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

/** Oslavy po 10 hvězdičkách v pořadí střídání. */
export const COMPARE_RUDY_LINES = ['celebration'] as const;

export type CompareRudyLine = (typeof COMPARE_RUDY_LINES)[number];

/** Klíč poslední varianty v úložišti hry profilu. */
export const COMPARE_RUDY_VARIANT_KEY = 'rudyLine.celebration';

export type CompareRudyLines = RudyVariants<CompareRudyLine>;

/**
 * Střídání oslav Porovnávání v úložišti hry profilu (bez úložiště jen
 * v paměti). Hra označení profilu nedostane; při zakázaném nebo plném
 * úložišti podrží poslední variantu v paměti do zavření stránky.
 */
export function compareRudyLines(storage: KeyValueStorage | undefined): CompareRudyLines {
  return openRudyVariants(storage, COMPARE_RUDY_VARIANT_KEY, COMPARE_RUDY_LINES);
}

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/compare/rudy-<id>.mp3`). */
export function compareRudyVoiceUrl(
  line: CompareRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/compare/rudy-${line}.mp3`;
}
