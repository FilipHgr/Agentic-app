/**
 * Repliky pandy Rudyho v Porovnávání (#181): oslava po 10 hvězdičkách (od
 * #186 jediná chvíle s Rudym, pozdrav není). Text je v textech hry
 * (`rudyLines`), zazní jen nahrávka hlasem postavičky v jazyce zvoleném
 * v menu.
 *
 * Oslava má 2 varianty, které se v profilu střídají jako v #176, takže
 * Rudy nikdy neřekne stejnou repliku dvakrát po sobě. Poslední varianta
 * je v úložišti hry profilu.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { openRudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

/** Oslavy po 10 hvězdičkách v pořadí střídání. */
export const COMPARE_RUDY_LINES = ['celebration', 'celebrationMore'] as const;

export type CompareRudyLine = (typeof COMPARE_RUDY_LINES)[number];

/**
 * Repliky, které mluví o „víc“ (#182), a co místo nich Rudy řekne, když se
 * hra neptá jen na víc (otázka míň, nebo střídat): oslavu „Vždycky poznáš,
 * kde je víc!“ nahradí „Máš deset hvězdiček!“.
 */
export const COMPARE_RUDY_LINES_WITHOUT_MORE: Readonly<
  Partial<Record<CompareRudyLine, CompareRudyLine>>
> = {
  celebrationMore: 'celebration',
};

/** Klíč poslední varianty v úložišti hry profilu. */
export const COMPARE_RUDY_VARIANT_KEY = 'rudyLine.celebration';

/** Co hra o oslavě ví (#182): smí Rudy mluvit o „víc“. */
export interface CompareRudyContext {
  /** `false`, když se hra neptá jen na víc (míň, nebo střídat). */
  readonly mayAskMore: boolean;
}

export interface CompareRudyLines {
  /**
   * Replika, která zazní příště; nic nemění. Když Rudy nesmí mluvit
   * o „víc“, je to vždy replika bez „víc“.
   */
  upcoming(context?: CompareRudyContext): CompareRudyLine;
  /** Rudy s replikou `line` se ukázal: příště zazní další varianta. */
  said(line: CompareRudyLine): void;
}

/**
 * Střídání oslav Porovnávání v úložišti hry profilu (bez úložiště jen
 * v paměti). Hra označení profilu nedostane; při zakázaném nebo plném
 * úložišti podrží poslední variantu v paměti do zavření stránky.
 */
export function compareRudyLines(storage: KeyValueStorage | undefined): CompareRudyLines {
  const celebrations = openRudyVariants(storage, COMPARE_RUDY_VARIANT_KEY, COMPARE_RUDY_LINES);
  return {
    upcoming: (context) => {
      const line = celebrations.upcoming();
      const withoutMore = COMPARE_RUDY_LINES_WITHOUT_MORE[line];
      return context?.mayAskMore === false && withoutMore !== undefined ? withoutMore : line;
    },
    said: (line) => celebrations.said(line),
  };
}

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/compare/rudy-<id>.mp3`). */
export function compareRudyVoiceUrl(
  line: CompareRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/compare/rudy-${line}.mp3`;
}
