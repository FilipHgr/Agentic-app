import { describe, expect, it } from 'vitest';

import * as menuLayout from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLanguagePanel } from '../../src/menu/logic/menuLayout';
import { CHARACTER_WIDTH_RATIO, MIN_TAP_SIDE } from '../shared/layoutRules';
import { heightOf, isInside, widthOf } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { LANGUAGE_CASES, languageLayout } from './menuLayoutScenes';

/**
 * Testy k #138 AC9, rozložení: vlajka v řádku nabídky jazyků vlevo od
 * vlastního názvu jazyka se vejde do řádku ve všech zkušebních oknech,
 * s dnešními jazyky (čeština a angličtina) i s 12 zkušebními jazyky
 * z #70 včetně nejdelšího názvu. Ťukací plocha řádku zůstává aspoň 64 px.
 * Každé pravidlo je jeden test v cyklu přes okna, jazyky a řádky (#82),
 * případ je v popisu porušení.
 *
 * Navržené rozhraní (`src/menu/logic/menuLayout.ts`):
 * - `interface MenuLanguageRowParts { readonly flag: MenuBox; readonly name: MenuBox;
 *    readonly check: MenuBox }`: rámeček vlajky, plocha vlastního názvu jazyka
 *   a místo pro ✓ v jednom řádku (bez posunu seznamu, stejně jako `rows`),
 * - `flag` je pevný obdélníkový rámeček 30 × 20 px, stejný pro všechny jazyky,
 *   aby názvy začínaly pod sebou. Scéna do něj vlajku vepíše celou se
 *   zachovaným poměrem stran (3 : 2 vyplní celý, 2 : 1 bude 30 × 15 px
 *   svisle uprostřed); poměr vlajek hlídá `languageFlags.test.ts`.
 * - `languageRowParts(panel: MenuLanguagePanel, row: MenuBox): MenuLanguageRowParts`.
 * Panel se rozšíří o místo pro vlajku (`languagePanelFor` počítá šířku
 * řádku i s vlajkou), řádky zůstávají 64 px vysoké.
 */

const ROUNDING = 1e-6;

/** Rámeček vlajky (navržené, zadání velikost neurčuje): obdélník 3 : 2, výška asi 20 px. */
const FLAG_FRAME_WIDTH = 30;
const FLAG_FRAME_HEIGHT = 20;

/** Mezera mezi vlajkou a názvem jazyka (navržené jako mezera obsahu ve výběru kategorie). */
const MIN_FLAG_GAP = 8;

/** Vlajka nesmí sahat až k hornímu a spodnímu okraji řádku. */
const MIN_FLAG_MARGIN = 4;

interface MenuLanguageRowParts {
  readonly flag: MenuBox;
  readonly name: MenuBox;
  readonly check: MenuBox;
}

/** Navržená funkce z `menuLayout.ts`; dokud chybí, test selže s jasnou zprávou. */
function rowParts(panel: MenuLanguagePanel, row: MenuBox): MenuLanguageRowParts {
  const parts = (menuLayout as Record<string, unknown>)['languageRowParts'];
  if (typeof parts !== 'function') {
    throw new Error('src/menu/logic/menuLayout.ts nevydává languageRowParts');
  }
  return (parts as (panel: MenuLanguagePanel, row: MenuBox) => MenuLanguageRowParts)(panel, row);
}

interface RowCase {
  readonly label: string;
  readonly panel: MenuLanguagePanel;
  readonly row: MenuBox;
  readonly name: string;
  readonly parts: MenuLanguageRowParts;
}

/** Každý řádek nabídky v každém okně s dnešními i 12 jazyky. */
function rowCases(): RowCase[] {
  return LANGUAGE_CASES.flatMap(({ name: caseName, names }) =>
    MENU_WINDOWS.flatMap((window) => {
      const panel = languageLayout(window, names).languagePanel;
      return panel.rows.map((row, index) => {
        const name = names[index] ?? '';
        return {
          label: `${caseName}, ${window.name}, jazyk „${name}“`,
          panel,
          row,
          name,
          parts: rowParts(panel, row),
        };
      });
    }),
  );
}

function px(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} px`;
}

/** Porušení pravidla ve všech řádcích; prázdné, když pravidlo platí všude. */
function violations(rule: (rowCase: RowCase) => string | null): string[] {
  return rowCases().flatMap((rowCase) => {
    const problem = rule(rowCase);
    return problem === null ? [] : [`${rowCase.label}: ${problem}`];
  });
}

describe('#138 AC9: vlajka se vejde do řádku nabídky jazyků v každém okně', () => {
  it('každý jazyk v každém okně má řádek s vlajkou (dnešní i 12 jazyků)', () => {
    const cases = rowCases();
    const expected = LANGUAGE_CASES.reduce(
      (sum, { names }) => sum + names.length * MENU_WINDOWS.length,
      0,
    );
    expect(cases).toHaveLength(expected);
  });

  it('rámeček vlajky je celý v řádku', () => {
    expect(
      violations(({ row, parts }) => (isInside(parts.flag, row) ? null : 'vlajka přesahuje řádek')),
    ).toEqual([]);
  });

  it('rámeček vlajky je obdélník 30 × 20 px a od horního i spodního okraje řádku aspoň 4 px', () => {
    expect(
      violations(({ row, parts }) => {
        const { flag } = parts;
        if (
          Math.abs(widthOf(flag) - FLAG_FRAME_WIDTH) > ROUNDING ||
          Math.abs(heightOf(flag) - FLAG_FRAME_HEIGHT) > ROUNDING
        ) {
          return `rámeček vlajky má ${px(widthOf(flag))} × ${px(heightOf(flag))}`;
        }
        if (
          flag.top - row.top < MIN_FLAG_MARGIN - ROUNDING ||
          row.bottom - flag.bottom < MIN_FLAG_MARGIN - ROUNDING
        ) {
          return `vlajka je ${px(flag.top - row.top)} od horního a ${px(row.bottom - flag.bottom)} od spodního okraje`;
        }
        return null;
      }),
    ).toEqual([]);
  });

  it('rámeček vlajky je svisle uprostřed řádku', () => {
    expect(
      violations(({ row, parts }) => {
        const offset = (parts.flag.top + parts.flag.bottom) / 2 - (row.top + row.bottom) / 2;
        return Math.abs(offset) <= 0.5 ? null : `střed vlajky je o ${px(offset)} mimo střed řádku`;
      }),
    ).toEqual([]);
  });

  it('vlajka je vlevo, od levého okraje řádku stejně daleko jako dřív název (odsazení řádku)', () => {
    expect(
      violations(({ panel, row, parts }) =>
        parts.flag.left - row.left >= panel.textInset - ROUNDING
          ? null
          : `vlajka je jen ${px(parts.flag.left - row.left)} od levého okraje`,
      ),
    ).toEqual([]);
  });

  it('vlajka je vlevo od vlastního názvu jazyka s mezerou aspoň 8 px', () => {
    expect(
      violations(({ parts }) =>
        parts.name.left - parts.flag.right >= MIN_FLAG_GAP - ROUNDING
          ? null
          : `mezi vlajkou a názvem je ${px(parts.name.left - parts.flag.right)}`,
      ),
    ).toEqual([]);
  });

  it('vlastní název jazyka se vejde do své plochy mezi vlajkou a ✓', () => {
    expect(
      violations(({ panel, row, name, parts }) => {
        const need = [...name].length * CHARACTER_WIDTH_RATIO * panel.fontSize;
        if (!isInside(parts.name, row)) {
          return 'plocha názvu přesahuje řádek';
        }
        if (heightOf(parts.name) < panel.fontSize - ROUNDING) {
          return `plocha názvu má výšku ${px(heightOf(parts.name))}, písmo ${px(panel.fontSize)}`;
        }
        return need <= widthOf(parts.name) + ROUNDING
          ? null
          : `„${name}“ potřebuje ${px(need)}, plocha má ${px(widthOf(parts.name))}`;
      }),
    ).toEqual([]);
  });

  it('místo pro ✓ zůstává vpravo v řádku za názvem jazyka', () => {
    expect(
      violations(({ panel, row, parts }) => {
        if (!isInside(parts.check, row)) {
          return 'místo pro ✓ přesahuje řádek';
        }
        if (widthOf(parts.check) < panel.checkWidth - ROUNDING) {
          return `místo pro ✓ má jen ${px(widthOf(parts.check))}`;
        }
        if (parts.check.left < parts.name.right - ROUNDING) {
          return '✓ zasahuje do názvu jazyka';
        }
        return row.right - parts.check.right >= panel.textInset - ROUNDING
          ? null
          : `✓ je jen ${px(row.right - parts.check.right)} od pravého okraje`;
      }),
    ).toEqual([]);
  });

  it('ťukací plocha řádku zůstává aspoň 64 × 64 px', () => {
    expect(
      violations(({ row }) =>
        widthOf(row) >= MIN_TAP_SIDE - ROUNDING && heightOf(row) >= MIN_TAP_SIDE - ROUNDING
          ? null
          : `řádek má ${px(widthOf(row))} × ${px(heightOf(row))}`,
      ),
    ).toEqual([]);
  });

  it('řádek je celý ve viditelné šířce seznamu, vlajka nic nevytlačí ven', () => {
    expect(
      violations(({ panel, row }) =>
        row.left >= panel.list.viewport.left - ROUNDING &&
        row.right <= panel.list.viewport.right + ROUNDING
          ? null
          : 'řádek je širší než viditelná plocha seznamu',
      ),
    ).toEqual([]);
  });
});
