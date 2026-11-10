/**
 * Jazyk stránky (#70): atribut `lang` a popis kolečka nastavení pro
 * čtečku obrazovky podle zvoleného jazyka. Nastaví se při startu stránky
 * (uložený jazyk se může lišit od výchozího v index.html) a po výběru
 * jiného jazyka v menu.
 */

import type { Language } from '../../shared/texts/languages';
import { sharedTexts } from '../../shared/texts/sharedTexts';

/** Část stránky, kterou jazyk mění; v testech jde podvrhnout. */
export interface LanguagePage {
  readonly documentElement: { lang: string };
  getElementById(id: string): { setAttribute(name: string, value: string): void } | null;
}

export function showPageLanguage(page: LanguagePage, language: Language): void {
  page.documentElement.lang = language;
  page
    .getElementById('settings-button')
    ?.setAttribute('aria-label', sharedTexts(language).settingsButtonLabel);
}
