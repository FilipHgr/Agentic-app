/**
 * Texty hry Porovnávání (#178) v souborech podle kódu jazyka (`cs.ts`).
 * Na herní obrazovce texty nejsou (příklad „a ☐ b = c“ a tlačítka + a −
 * jsou symboly, #187), jen název v menu, popisek řady nastavení pro rodiče
 * (#179) a repliky pandy Rudyho, které zazní nahrávkou (#181). Typ hlídá,
 * že žádnému jazyku nechybí klíč, takže chybějící překlad zastaví už
 * `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { CompareRudyLine } from '../logic/rudyLines';
import cs from './cs';
import en from './en';

export interface CompareTexts {
  /** Název hry pro menu. */
  readonly title: string;
  /** Popisky řad nastavení pro rodiče (#179, od #187 jen „Do kolika“). */
  readonly rowLabels: {
    readonly maxNumber: string;
  };
  /**
   * Repliky pandy Rudyho (#181); zazní jen nahrávky
   * `public/voice/<jazyk>/compare/rudy-<id>.mp3`, na obrazovce text není.
   */
  readonly rudyLines: Readonly<Record<CompareRudyLine, string>>;
}

const COMPARE_TEXTS: Record<Language, CompareTexts> = { cs, en };

/** Texty Porovnávání v jazyce, bez zadání v aktuálním jazyce. */
export function compareTexts(language: Language = currentLanguage()): CompareTexts {
  return COMPARE_TEXTS[language];
}
