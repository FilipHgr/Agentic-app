/**
 * Texty menu (#67) v souborech podle kódu jazyka (`cs.ts`): „Vše“ a názvy
 * kategorií ze seznamu ve sdílené části a nadpisy kroků formuláře nového
 * profilu (#72), texty potvrzení smazání profilu (#73) a přehledu pro
 * rodiče (#192). Typ hlídá, že žádnému jazyku
 * nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 * Názvy her jsou v textech her, název stránky ve sdílených textech.
 */

export interface MenuTexts {
  readonly categories: {
    readonly all: { readonly title: string };
    readonly addingSubtracting: { readonly title: string };
    readonly drawing: { readonly title: string };
    readonly numbers: { readonly title: string };
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
  /** Přehled pro rodiče (#192, dřív v nastavení Počítání #183, #184). */
  readonly overview: OverviewTexts;
}

/**
 * Texty přehledu pro rodiče (#192). Dvojtečky, procenta, lomítka a závorky
 * přidává kód jako znaky; názvy her jsou v textech her.
 */
export interface OverviewTexts {
  /** Nadpis obrazovky vedle kolečka profilu. */
  readonly title: string;
  /** Návrat do menu. */
  readonly back: string;
  /** Záložky stránek hry: vyřešené za 7 dní a chyby. */
  readonly weekTab: string;
  readonly mistakesTab: string;
  /** Nadpis stránky 7 dní. */
  readonly weekTitle: string;
  /**
   * Vysvětlivky obou odstínů sloupečků: světlejší část jsou příklady
   * vyřešené po chybě nebo s nápovědou (u hry bez nápovědy jen po chybě),
   * tmavší napoprvé.
   */
  readonly legendNotFirstTry: string;
  readonly legendAfterMistake: string;
  readonly legendFirstTry: string;
  /** Popisky součtů pod grafem; za ně přijde dvojtečka a číslo. */
  readonly totalSolved: string;
  readonly totalFirstTry: string;
  /** Nápis bez dat. */
  readonly empty: string;
  /** Zkratky dnů od pondělí do neděle. */
  readonly dayNames: readonly [string, string, string, string, string, string, string];
  /** Nadpis stránky Chyby. */
  readonly mistakesTitle: string;
  /** Nadpis podílu příkladů napoprvé. */
  readonly firstTryHeading: string;
  /** Názvy druhů příkladů; za ně přijde dvojtečka a podíl. */
  readonly addition: string;
  readonly subtraction: string;
  /** Nadpis nejčastějších chyb. */
  readonly frequentHeading: string;
  /**
   * Řádek časté chyby: `{problem}` se nahradí příkladem („8 + 5“,
   * „7 ☐ 5 = 2“), `{count}` počtem chyb, například „8 + 5 (4×)“.
   */
  readonly frequentItem: string;
  /** Nápis, když žádný příklad nemá aspoň 2 chyby. */
  readonly noFrequent: string;
  /** Popisek počtu nápověd za týden; za něj přijde dvojtečka a číslo. */
  readonly hintsUsed: string;
}
