/**
 * Jazyky hry (#65). Seznam obsahuje jen jazyky, které mají texty ve sdílené
 * části i ve všech hrách a k tomu nahrávky. Nový jazyk se do seznamu přidá
 * až s nahrávkami, v jednom commitu (postup v CLAUDE.md).
 *
 * Jazyk volí rodič v menu (#70) a platí pro celé zařízení, ne pro profil.
 * Volba se uloží jen do zařízení (`localStorage`).
 */

import { createLanguageChoice } from '../logic/languageChoice';
import { browserStorage } from '../storage/keyValueStorage';

export { LANGUAGE_STORAGE_KEY, chooseLanguage } from '../logic/languageChoice';

export const LANGUAGES = ['cs'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'cs';

const deviceLanguage = createLanguageChoice<Language>({
  supported: LANGUAGES,
  fallback: DEFAULT_LANGUAGE,
  storage: browserStorage,
});

/**
 * Aktuální jazyk hry: jediné místo, kde se hra na jazyk ptá. Bez požadavku
 * jazyk zvolený v menu (#70), uložený v zařízení; neznámý nebo poškozený
 * uložený jazyk znamená češtinu. S požadavkem jazyk podle požadavku (#65).
 */
export function currentLanguage(requested?: string | null): Language {
  return deviceLanguage.current(requested);
}

/**
 * Zvolí jazyk celého zařízení (#70) a uloží ho. Vrátí `true`, jen když se
 * jazyk změnil; jazyk mimo seznam ani ten současný nic nezmění.
 */
export function selectLanguage(language: string): boolean {
  return deviceLanguage.select(language);
}
