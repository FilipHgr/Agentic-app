/**
 * Volba jazyka pro celé zařízení (#70). Čistý TypeScript bez prohlížeče:
 * úložiště dostane zvenku, takže jde vyzkoušet i s umělými jazyky.
 *
 * - Platí jen přesný kód jazyka ze seznamu (#65), jinak výchozí jazyk.
 * - Uložený jazyk se přečte jednou za načtení stránky. Neznámý, poškozený
 *   nebo nečitelný uložený jazyk znamená výchozí jazyk.
 * - Zvolený jazyk platí hned. Když se ho nepovede uložit, platí aspoň do
 *   zavření stránky.
 * - Do úložiště jde jen kód jazyka pod jedním klíčem, nic jiného.
 */

import type { KeyValueStorage } from '../storage/keyValueStorage';

/** Klíč v úložišti zařízení, pod kterým je kód zvoleného jazyka. */
export const LANGUAGE_STORAGE_KEY = 'agentic-app.language';

/**
 * Požadovaný jazyk, když je přesně v seznamu podporovaných, jinak výchozí.
 * Bere se jen přesný kód: velká písmena, oblast (`cs-CZ`) ani mezery kolem ne.
 */
export function chooseLanguage<L extends string>(
  requested: string | null | undefined,
  supported: readonly L[],
  fallback: L,
): L {
  const match = supported.find((language) => language === requested);
  return match ?? fallback;
}

export interface LanguageChoiceOptions<L extends string> {
  readonly supported: readonly L[];
  readonly fallback: L;
  /** Úložiště zařízení, nebo `undefined`, když ho prohlížeč nepovolí. */
  readonly storage: () => KeyValueStorage | undefined;
}

export interface LanguageChoice<L extends string> {
  /**
   * Aktuální jazyk zařízení. S požadavkem (i `null`) jazyk podle požadavku
   * jako v #65, zvolený jazyk se pak nepoužije.
   */
  current(requested?: string | null): L;
  /** Zvolí jazyk; `true`, jen když je ze seznamu a liší se od aktuálního. */
  select(language: string): boolean;
}

export function createLanguageChoice<L extends string>(
  options: LanguageChoiceOptions<L>,
): LanguageChoice<L> {
  const { supported, fallback } = options;
  /** Jazyk tohoto načtení stránky; `undefined`, dokud se nepřečetl uložený. */
  let chosen: L | undefined;

  function readStored(): string | null {
    try {
      return options.storage()?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    } catch {
      // Úložiště nejde číst (soukromý režim, zákaz): platí výchozí jazyk.
      return null;
    }
  }

  function store(language: L): void {
    try {
      options.storage()?.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Úložiště je plné nebo zakázané: volba platí jen do zavření stránky.
    }
  }

  function deviceLanguage(): L {
    if (chosen === undefined) {
      chosen = chooseLanguage(readStored(), supported, fallback);
    }
    return chosen;
  }

  return {
    current(requested?: string | null): L {
      if (requested !== undefined) {
        return chooseLanguage(requested, supported, fallback);
      }
      return deviceLanguage();
    },

    select(language: string): boolean {
      const match = supported.find((candidate) => candidate === language);
      if (match === undefined || match === deviceLanguage()) {
        return false;
      }
      chosen = match;
      store(match);
      return true;
    },
  };
}
