/**
 * Texty hry Počítání (#65) v souborech podle kódu jazyka (`cs.ts`). Typ
 * hlídá, že žádnému jazyku nechybí klíč, takže chybějící překlad zastaví
 * už `npm run build`. Symboly (číslice, +, −, „123“, ✓, otazník, „1 / 4“)
 * nejsou texty jazyka a zůstávají v kódu.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { GuideLineId } from '../logic/guideScript';
import type { SettingsRowKind } from '../logic/settingsLayout';
import cs from './cs';

export interface CountingTexts {
  /** Název hry pro menu (AC2 v #65), zatím se nikde nezobrazuje. */
  readonly title: string;
  /** Popisky řad nastavení pro rodiče (#47). */
  readonly rowLabels: Readonly<Record<SettingsRowKind, string>>;
  /** Tlačítka průvodce nastavením (#49). */
  readonly guideButtons: {
    readonly back: string;
    readonly next: string;
    readonly startPlaying: string;
  };
  /**
   * Věty průvodce (#50): dva řádky na obrazovce, v nahrávce zazní oba za
   * sebou. Proto jsou číslice a značky vypsané slovy.
   */
  readonly guideLines: Readonly<Record<GuideLineId, readonly [string, string]>>;
}

const COUNTING_TEXTS: Record<Language, CountingTexts> = { cs };

/** Texty Počítání v jazyce, bez zadání v aktuálním jazyce. */
export function countingTexts(language: Language = currentLanguage()): CountingTexts {
  return COUNTING_TEXTS[language];
}
