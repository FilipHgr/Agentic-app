/**
 * Texty hry Porovnávání (#178) v souborech podle kódu jazyka (`cs.ts`).
 * Na herní obrazovce texty nejsou, jen název v menu, popisky řad
 * nastavení pro rodiče (#179, #182), repliky pandy Rudyho, které zazní
 * nahrávkou (#181), a otázky, které řekne hlas průvodce (#182). Typ
 * hlídá, že žádnému jazyku nechybí klíč, takže chybějící překlad zastaví
 * už `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { CompareGuideLine } from '../logic/compareQuestion';
import type { CompareRudyLine } from '../logic/rudyLines';
import cs from './cs';
import en from './en';

export interface CompareTexts {
  /** Název hry pro menu. */
  readonly title: string;
  /** Popisky řad nastavení pro rodiče (#179, řada „Otázka“ #182). */
  readonly rowLabels: {
    readonly maxNumber: string;
    readonly show: string;
    readonly question: string;
  };
  /**
   * Repliky pandy Rudyho (#181); zazní jen nahrávky
   * `public/voice/<jazyk>/compare/rudy-<id>.mp3`, na obrazovce text není.
   */
  readonly rudyLines: Readonly<Record<CompareRudyLine, string>>;
  /**
   * Otázky, které řekne dospělý hlas průvodce jazyka (#182); zazní jen
   * nahrávky `public/voice/<jazyk>/compare/guide/<věta>.mp3`, na obrazovce
   * je místo textu symbol.
   */
  readonly guideLines: Readonly<Record<CompareGuideLine, string>>;
}

const COMPARE_TEXTS: Record<Language, CompareTexts> = { cs, en };

/** Texty Porovnávání v jazyce, bez zadání v aktuálním jazyce. */
export function compareTexts(language: Language = currentLanguage()): CompareTexts {
  return COMPARE_TEXTS[language];
}
