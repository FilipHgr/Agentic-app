/**
 * Jazyky celého zařízení pro nabídku jazyků v menu (#70): seznam jazyků,
 * aktuální jazyk a jeho výběr ze sdílené části, vlastní název jazyka ze
 * sdílených textů toho jazyka („Čeština“).
 */

import { LANGUAGES, currentLanguage, selectLanguage } from '../../shared/texts/languages';
import { sharedTexts } from '../../shared/texts/sharedTexts';
import type { MenuLanguageSource } from './menu';

export function deviceLanguages(): MenuLanguageSource {
  return {
    supported: LANGUAGES,
    current: () => currentLanguage(),
    select: (language) => selectLanguage(language),
    nameOf: (language) => sharedTexts(currentLanguage(language)).languageName,
  };
}
