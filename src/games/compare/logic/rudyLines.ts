/**
 * Repliky pandy Rudyho v Porovnávání (#181): pozdrav po otevření hry
 * a oslava po 10 hvězdičkách. Text je v textech hry (`rudyLines`), zazní
 * jen nahrávka hlasem postavičky v jazyce zvoleném v menu.
 *
 * Každá chvíle má 2 varianty, které se v profilu střídají jako v #176,
 * takže Rudy nikdy neřekne stejnou repliku dvakrát po sobě. Poslední
 * varianta každé chvíle je v úložišti hry profilu.
 */

import type { RudyLineMove } from '../../../shared/logic/rudy';
import type { RudyVariantList } from '../../../shared/logic/rudyVariants';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { openRudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

/** Pozdravy v pořadí střídání. */
export const COMPARE_RUDY_GREETINGS = ['greeting', 'greetingAgain'] as const;

/** Oslavy po 10 hvězdičkách v pořadí střídání. */
export const COMPARE_RUDY_CELEBRATIONS = ['celebration', 'celebrationMore'] as const;

export const COMPARE_RUDY_LINES = [
  ...COMPARE_RUDY_GREETINGS,
  ...COMPARE_RUDY_CELEBRATIONS,
] as const;

export type CompareRudyLine = (typeof COMPARE_RUDY_LINES)[number];

/**
 * Repliky, které mluví o „víc“ (#182), a co místo nich Rudy řekne, když se
 * hra neptá jen na víc (otázka míň, nebo střídat): pozdrav „Kde je víc?“
 * nahradí „Jdeme porovnávat!“, oslavu „Vždycky poznáš, kde je víc!“
 * nahradí „Máš deset hvězdiček!“.
 */
export const COMPARE_RUDY_LINES_WITHOUT_MORE: Readonly<
  Partial<Record<CompareRudyLine, CompareRudyLine>>
> = {
  greeting: 'greetingAgain',
  celebrationMore: 'celebration',
};

/**
 * Pozdrav, který se sám ptá „Kde je víc?“ (#182): po něm hlas průvodce
 * otázku neopakuje.
 */
export const COMPARE_RUDY_GREETING_ASKING_MORE: CompareRudyLine = 'greeting';

/** Klíče posledních variant v úložišti hry profilu, podle pohybu okna. */
export const COMPARE_RUDY_VARIANT_KEYS: Readonly<Record<RudyLineMove, string>> = {
  wave: 'rudyLine.greeting',
  celebrate: 'rudyLine.celebration',
};

/** Varianty k pohybu okna: pozdrav mává, oslava slaví. */
function variantsOf(move: RudyLineMove): RudyVariantList<CompareRudyLine> {
  return move === 'celebrate' ? COMPARE_RUDY_CELEBRATIONS : COMPARE_RUDY_GREETINGS;
}

/** Co hra o chvíli okna ví (#182): smí Rudy mluvit o „víc“ (pozdrav i oslava). */
export interface CompareRudyContext {
  /** `false`, když se hra po otevření neptá jen na víc (míň, nebo střídat). */
  readonly mayAskMore: boolean;
}

export interface CompareRudyLines {
  /**
   * Replika, která k pohybu okna zazní příště; nic nemění. Když Rudy nesmí
   * mluvit o „víc“, je to vždy replika bez „víc“.
   */
  upcoming(move: RudyLineMove, context?: CompareRudyContext): CompareRudyLine;
  /** Okno s replikou `line` se ukázalo: příště zazní další varianta. */
  said(move: RudyLineMove, line: CompareRudyLine): void;
}

/**
 * Střídání replik Porovnávání v úložišti hry profilu (bez úložiště jen
 * v paměti). Hra označení profilu nedostane; při zakázaném nebo plném
 * úložišti podrží poslední variantu v paměti do zavření stránky.
 */
export function compareRudyLines(storage: KeyValueStorage | undefined): CompareRudyLines {
  const greetings = openRudyVariants(storage, COMPARE_RUDY_VARIANT_KEYS.wave, variantsOf('wave'));
  const celebrations = openRudyVariants(
    storage,
    COMPARE_RUDY_VARIANT_KEYS.celebrate,
    variantsOf('celebrate'),
  );
  const variantsFor = (move: RudyLineMove) => (move === 'celebrate' ? celebrations : greetings);
  return {
    upcoming: (move, context) => {
      const line = variantsFor(move).upcoming();
      const withoutMore = COMPARE_RUDY_LINES_WITHOUT_MORE[line];
      return context?.mayAskMore === false && withoutMore !== undefined ? withoutMore : line;
    },
    said: (move, line) => variantsFor(move).said(line),
  };
}

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/compare/rudy-<id>.mp3`). */
export function compareRudyVoiceUrl(
  line: CompareRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/compare/rudy-${line}.mp3`;
}
