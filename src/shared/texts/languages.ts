/**
 * Jazyky hry (#65). Seznam obsahuje jen jazyky, které mají texty ve sdílené
 * části i ve všech hrách a k tomu nahrávky. Nový jazyk se do seznamu přidá
 * až s nahrávkami, v jednom commitu (postup v CLAUDE.md).
 */

export const LANGUAGES = ['cs'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'cs';

/**
 * Požadovaný jazyk, když je přesně v seznamu podporovaných, jinak výchozí.
 * Platí jen přesný kód: velká písmena, oblast (`cs-CZ`) ani mezery kolem neplatí.
 */
export function chooseLanguage<L extends string>(
  requested: string | null | undefined,
  supported: readonly L[],
  fallback: L,
): L {
  const match = supported.find((language) => language === requested);
  return match ?? fallback;
}

/**
 * Aktuální jazyk hry: jediné místo, kde se hra na jazyk ptá. Požadavek
 * později dodá menu; zatím ho nikdo nedává a jazyk se nikam neukládá.
 */
export function currentLanguage(requested?: string | null): Language {
  return chooseLanguage(requested, LANGUAGES, DEFAULT_LANGUAGE);
}
