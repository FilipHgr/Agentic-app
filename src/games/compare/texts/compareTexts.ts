/**
 * Texty hry Znaménka (#178, do #190 Porovnávání) v souborech podle kódu
 * jazyka (`cs.ts`). Na herní obrazovce texty nejsou (příklady „a ☐ b = c“
 * a „a ☐ b“ i tlačítka + − < = > jsou symboly, #187, #190), jen název
 * v menu, popisky řad nastavení pro rodiče (#179, #188, #190) a repliky
 * pandy Rudyho, které zazní nahrávkou (#181). Typ hlídá, že žádnému
 * jazyku nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { CompareRudyLine } from '../logic/rudyLines';
import cs from './cs';
import en from './en';

export interface CompareTexts {
  /** Název hry pro menu. */
  readonly title: string;
  /**
   * Popisky řad nastavení pro rodiče (#190 „Znaménka“, #179, #187 „Do
   * kolika“, #188 „Odpověď“).
   */
  readonly rowLabels: {
    readonly signKind: string;
    readonly maxNumber: string;
    readonly answerInput: string;
  };
  /**
   * Repliky pandy Rudyho (#181); zazní jen nahrávky
   * `public/voice/<jazyk>/compare/rudy-<id>.mp3`, na obrazovce text není.
   */
  readonly rudyLines: Readonly<Record<CompareRudyLine, string>>;
}

const COMPARE_TEXTS: Record<Language, CompareTexts> = { cs, en };

/** Texty hry Znaménka v jazyce, bez zadání v aktuálním jazyce. */
export function compareTexts(language: Language = currentLanguage()): CompareTexts {
  return COMPARE_TEXTS[language];
}
