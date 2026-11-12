/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { ALL_CATEGORY, visibleCategories } from '../../src/menu/logic/menuCategories';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { deleteConfirmLayoutFor } from '../../src/menu/logic/profileLayout';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { CHARACTER_WIDTH_RATIO, TEXT_PADDING } from '../shared/layoutRules';
import { dictionariesByLanguage, languageOfFile, leavesOf } from '../shared/textChecks';
import { viewportOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS, findWindow } from './manyGamesFixtures';
import { colorLayout, nicknameLayout } from './menuLayoutScenes';

/**
 * Testy k #137 AC2 pro menu: texty každého jazyka, který má soubor textů
 * (i mimo seznam jazyků hry, tedy i angličtina), se vejdou do menu ve
 * všech zkušebních oknech (iPad, zmenšené zobrazení, telefon na šířku
 * i na výšku). Dnešní pravidla rozložení menu (`menuLayoutScenes.ts`)
 * berou jen jazyky ze seznamu, proto se tu texty čtou přímo ze souborů:
 *
 * - kategorie ve sloupci vlevo (iPad, zmenšené zobrazení, telefon na šířku),
 * - výběr kategorie na telefonu na výšku: tlačítko (se symbolem a ▾)
 *   i řádky seznamu (se symbolem a ✓),
 * - název hry na dlaždici (řádek názvu pod obrázkem, #122),
 * - vlastní název jazyka v nabídce jazyků (s místem pro ✓),
 * - nadpisy formuláře profilu a texty potvrzení smazání (dnešní kontroly
 *   také měří jen jazyky ze seznamu).
 *
 * Šířka textu se odhaduje stejně jako v Počítání a v dnešních pravidlech
 * menu: počet znaků × 0,6 × písmo, s rezervou 8 px z obou stran (u nabídky
 * jazyků a výběru kategorie s odsazením a místem pro symbol, ▾ a ✓ podle
 * rozložení). Řádek názvu hry pod obrázkem je už o 8 px z obou stran
 * užší než dlaždice, proto se měří bez další rezervy.
 *
 * Zpráva o přetečení řekne jazyk, okno, místo, text a o kolik px přetéká.
 * Názvy her se berou z textů her (`src/games/<hra>/texts/<jazyk>.ts`),
 * protože `titles` v `meta.ts` angličtinu zatím nemají (mimo rozsah #137).
 */

const ROUNDING = 1e-6;

const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
);
const SHARED_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/shared/texts/*.ts', { eager: true }),
);

/** Texty všech her podle cesty `…/games/<hra>/texts/<jazyk>.ts`. */
const GAME_TEXT_MODULES: Record<string, unknown> = import.meta.glob(
  '../../src/games/*/texts/*.ts',
  { eager: true },
);

/** Název hry `gameId` v jazyce ze souboru textů hry, nebo prázdný text. */
function gameTitleOf(gameId: string, language: string): string {
  for (const [path, module] of Object.entries(GAME_TEXT_MODULES)) {
    if (path.includes(`/games/${gameId}/texts/`) && languageOfFile(path) === language) {
      const title = (module as { default?: { title?: unknown } }).default?.title;
      return typeof title === 'string' ? title : '';
    }
  }
  return '';
}

/** Texty jednoho jazyka, které menu kreslí; volné, aby šly umělé jazyky. */
interface MenuLanguageTexts {
  /** Názvy viditelných kategorií v pořadí menu („Vše“ první). */
  readonly categoryTitles: readonly string[];
  /** Názvy her v pořadí dlaždic. */
  readonly gameTitles: readonly string[];
  /** Vlastní název jazyka v nabídce jazyků. */
  readonly languageName: string;
  readonly nicknameTitle: string;
  readonly colorTitle: string;
  readonly deleteQuestion: string;
  readonly deleteConfirm: string;
  readonly deleteCancel: string;
}

function textAt(texts: Map<string, unknown>, key: string): string {
  const value = texts.get(key);
  return typeof value === 'string' ? value : '';
}

/** Texty menu jazyka ze souborů (menu, sdílená část a hry). */
function menuTextsOf(language: string): MenuLanguageTexts {
  const menu = leavesOf(MENU_FILES[language] ?? {});
  const shared = leavesOf(SHARED_FILES[language] ?? {});
  const all = [ALL_CATEGORY, ...GAME_CATEGORIES];
  return {
    categoryTitles: visibleCategories(GAMES, GAME_CATEGORIES).map((id) =>
      textAt(menu, all.find((category) => category.id === id)?.titleKey ?? ''),
    ),
    gameTitles: GAMES.map((game) => gameTitleOf(game.id, language)),
    languageName: textAt(shared, 'languageName'),
    nicknameTitle: textAt(menu, 'profiles.nicknameTitle'),
    colorTitle: textAt(menu, 'profiles.colorTitle'),
    deleteQuestion: textAt(menu, 'profiles.deleteQuestion'),
    deleteConfirm: textAt(menu, 'profiles.deleteConfirm'),
    deleteCancel: textAt(menu, 'profiles.deleteCancel'),
  };
}

/** Vlastní názvy jazyků se souborem sdílených textů (nabídka jazyků je ukáže všechny). */
function fileLanguageNames(): string[] {
  return Object.keys(SHARED_FILES).map((language) =>
    textAt(leavesOf(SHARED_FILES[language] ?? {}), 'languageName'),
  );
}

interface TextSlot {
  /** Místo v menu, jak ho pozná člověk: „kategorie ve sloupci vlevo“. */
  readonly place: string;
  readonly text: string;
  /** Šířka plochy pro text v CSS px. */
  readonly width: number;
  readonly fontSize: number;
  /** Rezerva na každé straně v CSS px. */
  readonly padding: number;
  /** Místo navíc v řádku (symbol, ▾, ✓) v CSS px. */
  readonly reserve: number;
}

function widthOf(box: MenuBox): number {
  return box.right - box.left;
}

function overflowOf(slot: TextSlot): number {
  return (
    [...slot.text].length * CHARACTER_WIDTH_RATIO * slot.fontSize +
    2 * slot.padding +
    slot.reserve -
    slot.width
  );
}

function px(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace('.', ',')} px`;
}

function layoutFor(window: TestWindow, texts: MenuLanguageTexts): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: texts.categoryTitles,
    tileCount: texts.gameTitles.length,
    languageNames: [...new Set([...fileLanguageNames(), texts.languageName])],
  });
}

/** Kategorie ve sloupci vlevo; na telefonu na výšku je místo sloupce výběr. */
function categoryColumnSlots(layout: MenuLayout, texts: MenuLanguageTexts): TextSlot[] {
  if (layout.categoryPicker !== null) {
    return [];
  }
  return layout.categories.map((category, index) => ({
    place: 'kategorie ve sloupci vlevo',
    text: texts.categoryTitles[index] ?? '',
    width: widthOf(category.pill),
    fontSize: layout.categoryFontSize,
    padding: TEXT_PADDING,
    reserve: 0,
  }));
}

/** Výběr kategorie (#95): na tlačítku může být kterákoli kategorie, v seznamu jsou všechny. */
function categoryPickerSlots(layout: MenuLayout, texts: MenuLanguageTexts): TextSlot[] {
  const picker = layout.categoryPicker;
  if (picker === null) {
    return [];
  }
  const button = texts.categoryTitles.map((title) => ({
    place: 'tlačítko výběru kategorie',
    text: title,
    width: widthOf(picker.button),
    fontSize: picker.fontSize,
    padding: picker.textInset,
    reserve: picker.symbolWidth + picker.arrowWidth,
  }));
  const rows = picker.rows.map((row, index) => ({
    place: 'řádek seznamu kategorií',
    text: texts.categoryTitles[index] ?? '',
    width: widthOf(row),
    fontSize: picker.fontSize,
    padding: picker.textInset,
    reserve: picker.symbolWidth + picker.checkWidth,
  }));
  return [...button, ...rows];
}

function tileTitleSlots(layout: MenuLayout, texts: MenuLanguageTexts): TextSlot[] {
  return layout.tileImages.map((face, index) => ({
    place: 'název hry na dlaždici',
    text: texts.gameTitles[index] ?? '',
    width: widthOf(face.title),
    fontSize: layout.tileTitleFontSize,
    padding: 0,
    reserve: 0,
  }));
}

function languageNameSlots(layout: MenuLayout, texts: MenuLanguageTexts): TextSlot[] {
  const panel = layout.languagePanel;
  const names = [...new Set([...fileLanguageNames(), texts.languageName])];
  const row = panel.rows[names.indexOf(texts.languageName)];
  if (row === undefined) {
    return [];
  }
  return [
    {
      place: 'název jazyka v nabídce jazyků',
      text: texts.languageName,
      width: widthOf(row),
      fontSize: panel.fontSize,
      padding: panel.textInset,
      reserve: panel.checkWidth,
    },
  ];
}

function profileSlots(window: TestWindow, texts: MenuLanguageTexts): TextSlot[] {
  const slots: TextSlot[] = [];
  const heading = (place: string, text: string, box: MenuBox | null, fontSize: number): void => {
    if (box !== null) {
      slots.push({ place, text, width: widthOf(box), fontSize, padding: TEXT_PADDING, reserve: 0 });
    }
  };
  for (const layer of ['base', 'accents'] as const) {
    const nickname = nicknameLayout(window, layer);
    heading(
      'nadpis formuláře „Přezdívka“',
      texts.nicknameTitle,
      nickname.title,
      nickname.titleFontSize,
    );
  }
  for (const withTrash of [false, true]) {
    const color = colorLayout(window, withTrash);
    heading('nadpis formuláře „Barva“', texts.colorTitle, color.title, color.titleFontSize);
  }
  const confirm = deleteConfirmLayoutFor(viewportOf(window));
  heading(
    'otázka potvrzení smazání',
    texts.deleteQuestion,
    confirm.question,
    confirm.questionFontSize,
  );
  heading('tlačítko „Smazat“', texts.deleteConfirm, confirm.confirm, confirm.buttonFontSize);
  heading(
    'tlačítko „Zpět“ v potvrzení',
    texts.deleteCancel,
    confirm.cancel,
    confirm.buttonFontSize,
  );
  return slots;
}

/**
 * Všechna přetečení textů jazyka v jednom okně. Zpráva: jazyk, okno,
 * místo, text a o kolik px přetéká. Prázdný text je taky chyba.
 */
function overflowsIn(language: string, texts: MenuLanguageTexts, window: TestWindow): string[] {
  const layout = layoutFor(window, texts);
  const slots = [
    ...categoryColumnSlots(layout, texts),
    ...categoryPickerSlots(layout, texts),
    ...tileTitleSlots(layout, texts),
    ...languageNameSlots(layout, texts),
    ...profileSlots(window, texts),
  ];
  const where = (slot: TextSlot): string => `jazyk ${language}, ${window.name}, ${slot.place}`;
  return slots.flatMap((slot) => {
    if (slot.text.trim() === '') {
      return [`${where(slot)}: text chybí`];
    }
    const by = overflowOf(slot);
    return by > ROUNDING ? [`${where(slot)}: „${slot.text}“ přetéká o ${px(by)}`] : [];
  });
}

function overflowsEverywhere(language: string, texts: MenuLanguageTexts): string[] {
  return MENU_WINDOWS.flatMap((window) => overflowsIn(language, texts, window));
}

/** Čísla z „přetéká o 12,3 px“. */
function overflowAmount(message: string): number {
  return Number(/přetéká o ([\d,]+) px/.exec(message)?.[1]?.replace(',', '.'));
}

describe('#137 AC2: texty menu každého jazyka se souborem textů se vejdou', () => {
  it('kontrola měří i angličtinu, která má soubory textů, ale ještě není v seznamu jazyků', () => {
    expect(Object.keys(MENU_FILES)).toEqual(expect.arrayContaining(['cs', 'en']));
    expect(Object.keys(SHARED_FILES)).toEqual(expect.arrayContaining(['cs', 'en']));
    expect(LANGUAGES).not.toContain('en');
  });

  it('zkušební okna pokrývají sloupec kategorií (iPad, zmenšené, telefon na šířku) i výběr kategorie (na výšku)', () => {
    const layouts = MENU_WINDOWS.map((window) => layoutFor(window, menuTextsOf('cs')));
    expect(layouts.some((layout) => layout.categoryPicker === null)).toBe(true);
    expect(layouts.some((layout) => layout.categoryPicker !== null)).toBe(true);
    expect(new Set(layouts.map((layout) => layout.mode))).toEqual(
      new Set(['tablet', 'scaled', 'phoneLandscape', 'phonePortrait']),
    );
  });

  it('každá hra v menu má název v textech hry v každém jazyce se souborem textů menu', () => {
    for (const language of Object.keys(MENU_FILES)) {
      for (const game of GAMES) {
        expect(gameTitleOf(game.id, language), `${language}, ${game.id}`).not.toBe('');
      }
    }
  });

  for (const language of Object.keys(MENU_FILES)) {
    it(`jazyk ${language}: kategorie, výběr kategorie, názvy her, název jazyka, formulář profilu i potvrzení smazání se vejdou ve všech oknech`, () => {
      expect(overflowsEverywhere(language, menuTextsOf(language))).toEqual([]);
    });
  }
});

describe('#137 AC2: kontrola menu opravdu zachytí příliš dlouhý text (umělý jazyk jen v testu)', () => {
  const czech = menuTextsOf('cs');
  const ipad = findWindow('iPad 1180×820');
  const phoneLandscape = findWindow('844×340');
  const phonePortrait = findWindow('390×844');

  function longLanguage(change: Partial<MenuLanguageTexts>): MenuLanguageTexts {
    return { ...czech, ...change };
  }

  function problemWith(problems: readonly string[], text: string): string {
    const found = problems.find((problem) => problem.includes(`„${text}“`));
    expect(found, problems.join('\n')).toBeDefined();
    return found ?? '';
  }

  it('čeština dnes projde všechny nové kontroly beze změny rozložení', () => {
    expect(overflowsEverywhere('cs', czech)).toEqual([]);
  });

  it('dlouhou kategorii ve sloupci zachytí na iPadu a zpráva řekne jazyk, okno, místo, text a px', () => {
    const long = 'Sčítání, odčítání a porovnávání';
    const texts = longLanguage({
      categoryTitles: [czech.categoryTitles[0] ?? '', long, ...czech.categoryTitles.slice(2)],
    });
    const problem = problemWith(overflowsIn('xx', texts, ipad), long);
    expect(problem).toContain('jazyk xx');
    expect(problem).toContain(ipad.name);
    expect(problem).toContain('kategorie ve sloupci vlevo');
    const pill = layoutFor(ipad, texts).categories[1]?.pill;
    const expected =
      [...long].length * CHARACTER_WIDTH_RATIO * layoutFor(ipad, texts).categoryFontSize +
      2 * TEXT_PADDING -
      (pill === undefined ? 0 : widthOf(pill));
    expect(overflowAmount(problem)).toBeCloseTo(expected, 1);
    expect(overflowAmount(problem)).toBeGreaterThan(0);
  });

  it('dlouhou kategorii ve sloupci zachytí i na telefonu na šířku', () => {
    const long = 'Sčítání, odčítání a porovnávání';
    const texts = longLanguage({
      categoryTitles: [czech.categoryTitles[0] ?? '', long, ...czech.categoryTitles.slice(2)],
    });
    const problem = problemWith(overflowsIn('xx', texts, phoneLandscape), long);
    expect(problem).toContain('kategorie ve sloupci vlevo');
  });

  it('dlouhou kategorii na tlačítku i v seznamu výběru kategorie zachytí na telefonu na výšku', () => {
    const long = 'Sčítání a odčítání čísel do sta';
    const texts = longLanguage({
      categoryTitles: [czech.categoryTitles[0] ?? '', long, ...czech.categoryTitles.slice(2)],
    });
    const problems = overflowsIn('xx', texts, phonePortrait).filter((problem) =>
      problem.includes(long),
    );
    expect(problems.some((problem) => problem.includes('tlačítko výběru kategorie'))).toBe(true);
    expect(problems.some((problem) => problem.includes('řádek seznamu kategorií'))).toBe(true);
    expect(
      problems.every((problem) => problem.includes('jazyk xx') && overflowAmount(problem) > 0),
    ).toBe(true);
  });

  it('dlouhý název hry na dlaždici zachytí v každém okně', () => {
    const long = 'Počítání s kamarády na dlouhé cestě';
    const texts = longLanguage({ gameTitles: [long, ...czech.gameTitles.slice(1)] });
    for (const window of MENU_WINDOWS) {
      const problem = problemWith(overflowsIn('xx', texts, window), long);
      expect(problem, window.name).toContain('název hry na dlaždici');
      expect(problem, window.name).toContain(window.name);
      expect(overflowAmount(problem), window.name).toBeGreaterThan(0);
    }
  });

  it('dlouhý vlastní název jazyka v nabídce jazyků zachytí na telefonu na výšku', () => {
    const long = 'Xxština s velmi dlouhým názvem, který se nevejde';
    const problem = problemWith(
      overflowsIn('xx', longLanguage({ languageName: long }), phonePortrait),
      long,
    );
    expect(problem).toContain('název jazyka v nabídce jazyků');
    expect(problem).toContain('jazyk xx');
    expect(overflowAmount(problem)).toBeGreaterThan(0);
  });

  it('dlouhý text v potvrzení smazání zachytí', () => {
    const long = 'Opravdu chcete tento profil nadobro smazat?';
    const problem = problemWith(
      overflowsIn('xx', longLanguage({ deleteQuestion: long }), phonePortrait),
      long,
    );
    expect(problem).toContain('otázka potvrzení smazání');
  });

  it('chybějící text zachytí jako chybu, ne jako text, který se vejde', () => {
    const problems = overflowsIn('xx', longLanguage({ languageName: ' ' }), ipad);
    expect(
      problems.some(
        (problem) => problem.includes('název jazyka v nabídce jazyků') && problem.includes('chybí'),
      ),
    ).toBe(true);
  });

  it('přeložená kategorie „Adding and subtracting“ by se do sloupce na iPadu nevešla, proto platí záloha „Plus and minus“', () => {
    const adding = longLanguage({ categoryTitles: ['All', 'Adding and subtracting', 'Drawing'] });
    expect(problemWith(overflowsIn('en', adding, ipad), 'Adding and subtracting')).toContain(
      'kategorie ve sloupci vlevo',
    );
    const plusMinus = longLanguage({ categoryTitles: ['All', 'Plus and minus', 'Drawing'] });
    expect(overflowsEverywhere('en', plusMinus)).toEqual([]);
  });
});
