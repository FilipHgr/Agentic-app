/**
 * Texty menu (#67) v souborech podle kódu jazyka (`cs.ts`): „Vše“ a názvy
 * kategorií ze seznamu ve sdílené části a nadpisy kroků formuláře nového
 * profilu (#72) a texty potvrzení smazání profilu (#73). Typ hlídá, že žádnému jazyku
 * nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 * Názvy her jsou v textech her, název stránky ve sdílených textech.
 */

export interface MenuTexts {
  readonly categories: {
    readonly all: { readonly title: string };
    readonly addingSubtracting: { readonly title: string };
    readonly drawing: { readonly title: string };
  };
  /**
   * Formulář profilu (#72): nadpisy 1. a 2. kroku; potvrzení smazání
   * profilu (#73): otázka a tlačítka „Smazat“ a „Zpět“.
   */
  readonly profiles: {
    readonly nicknameTitle: string;
    readonly colorTitle: string;
    readonly deleteQuestion: string;
    readonly deleteConfirm: string;
    readonly deleteCancel: string;
  };
}
