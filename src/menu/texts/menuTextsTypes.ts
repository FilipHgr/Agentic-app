/**
 * Texty menu (#67) v souborech podle kódu jazyka (`cs.ts`): „Vše“ a názvy
 * kategorií ze seznamu ve sdílené části. Typ hlídá, že žádnému jazyku
 * nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 * Názvy her jsou v textech her, název stránky ve sdílených textech.
 */

export interface MenuTexts {
  readonly categories: {
    readonly all: { readonly title: string };
    readonly addingSubtracting: { readonly title: string };
  };
}
