/**
 * Sdílené texty (#65): co patří stránce a jazyku, ne jedné hře. Texty jsou
 * v souborech podle kódu jazyka (`cs.ts`); typ hlídá, že žádnému jazyku
 * nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 */

import cs from './cs';
import en from './en';
import { currentLanguage } from './languages';
import type { Language } from './languages';

export interface SharedTexts {
  /** Název stránky (`<title>` v index.html). */
  readonly pageTitle: string;
  /** Popis kolečka nastavení pro čtečku obrazovky (`aria-label` v index.html). */
  readonly settingsButtonLabel: string;
  /** Vlastní název jazyka v nabídce jazyků v menu (#70), třeba „Čeština“. */
  readonly languageName: string;
  /**
   * Jednopísmenné předložky, které podle pravidel jazyka nezůstávají na
   * konci řádku. Jazyk bez takového pravidla má prázdný seznam.
   */
  readonly oneLetterPrepositions: readonly string[];
}

const SHARED_TEXTS: Record<Language, SharedTexts> = { cs, en };

/** Sdílené texty jazyka, bez zadání v aktuálním jazyce. */
export function sharedTexts(language: Language = currentLanguage()): SharedTexts {
  return SHARED_TEXTS[language];
}
