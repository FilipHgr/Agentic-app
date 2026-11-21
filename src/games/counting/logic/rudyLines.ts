/**
 * Repliky pandy Rudyho v Počítání (#171): pozdrav po otevření hry a oslava
 * po 10 hvězdičkách. Text je v textech hry (`rudyLines`), zazní jen
 * nahrávka hlasem postavičky v jazyce zvoleném v menu.
 *
 * Každá chvíle má několik variant (#176), které se v profilu střídají,
 * takže Rudy nikdy neřekne stejnou repliku dvakrát po sobě. Poslední
 * varianta každé chvíle je v úložišti hry profilu.
 */

import type { RudyLineMove } from '../../../shared/logic/rudy';
import type { RudyVariantList } from '../../../shared/logic/rudyVariants';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { openRudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

/** Pozdravy v pořadí střídání; první je ten z #171. */
export const COUNTING_RUDY_GREETINGS = ['greeting', 'greetingAgain'] as const;

/** Oslavy po 10 hvězdičkách v pořadí střídání; první je ta z #171. */
export const COUNTING_RUDY_CELEBRATIONS = [
  'celebration',
  'celebrationStars',
  'celebrationStar',
] as const;

export const COUNTING_RUDY_LINES = [
  ...COUNTING_RUDY_GREETINGS,
  ...COUNTING_RUDY_CELEBRATIONS,
] as const;

export type CountingRudyLine = (typeof COUNTING_RUDY_LINES)[number];

/** Klíče posledních variant v úložišti hry profilu, podle pohybu okna. */
export const COUNTING_RUDY_VARIANT_KEYS: Readonly<Record<RudyLineMove, string>> = {
  wave: 'rudyLine.greeting',
  celebrate: 'rudyLine.celebration',
};

/** Varianty k pohybu okna: pozdrav mává, oslava slaví. */
function variantsOf(move: RudyLineMove): RudyVariantList<CountingRudyLine> {
  return move === 'celebrate' ? COUNTING_RUDY_CELEBRATIONS : COUNTING_RUDY_GREETINGS;
}

export interface CountingRudyLines {
  /** Replika, která k pohybu okna zazní příště; nic nemění. */
  upcoming(move: RudyLineMove): CountingRudyLine;
  /** Okno s replikou `line` se ukázalo: příště zazní další varianta. */
  said(move: RudyLineMove, line: CountingRudyLine): void;
}

/**
 * Střídání replik Počítání v úložišti hry profilu (bez úložiště jen v paměti).
 * Hra označení profilu nedostane; při zakázaném nebo plném úložišti podrží
 * poslední variantu úložiště profilu od stránky v paměti do zavření
 * stránky, takže vydrží i další otevření hry.
 */
export function countingRudyLines(storage: KeyValueStorage | undefined): CountingRudyLines {
  const greetings = openRudyVariants(storage, COUNTING_RUDY_VARIANT_KEYS.wave, variantsOf('wave'));
  const celebrations = openRudyVariants(
    storage,
    COUNTING_RUDY_VARIANT_KEYS.celebrate,
    variantsOf('celebrate'),
  );
  const variantsFor = (move: RudyLineMove) => (move === 'celebrate' ? celebrations : greetings);
  return {
    upcoming: (move) => variantsFor(move).upcoming(),
    said: (move, line) => variantsFor(move).said(line),
  };
}

/** Nahrávka repliky jako soubor hry (`public/voice/<jazyk>/counting/rudy-<id>.mp3`). */
export function countingRudyVoiceUrl(
  line: CountingRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/counting/rudy-${line}.mp3`;
}
