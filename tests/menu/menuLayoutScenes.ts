import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { letterKeys } from '../../src/menu/logic/letterGrid';
import type { LetterKey, LetterLayer } from '../../src/menu/logic/letterGrid';
import { ALL_CATEGORY, visibleCategories } from '../../src/menu/logic/menuCategories';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLanguagePanel, MenuLayout } from '../../src/menu/logic/menuLayout';
import { menuText } from '../../src/menu/logic/menuTexts';
import {
  colorStepLayoutFor,
  deleteConfirmLayoutFor,
  nicknameStepLayoutFor,
  profilePickerLayoutFor,
} from '../../src/menu/logic/profileLayout';
import type { ColorStepLayout, NicknameStepLayout } from '../../src/menu/logic/profileLayout';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
import { LANGUAGES } from '../../src/shared/texts/languages';
import type { Language } from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
import { LAYOUT_RULES, textFitViolations } from '../shared/layoutRules';
import type { LayoutItem, LayoutRule, LayoutScene, LayoutText } from '../shared/layoutRules';
import { freeAreaOf, isInside, viewportOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import {
  MANY_GAMES,
  MANY_GAMES_COUNT,
  MANY_LANGUAGE_CODES,
  MANY_LANGUAGE_NAMES,
  MANY_MENU_CATEGORY_TITLES,
  MANY_TEXTS_CS,
  MENU_WINDOWS,
  manyGamesLayout,
} from './manyGamesFixtures';

/**
 * Obrazovky menu pro společná pravidla rozložení (#82): mřížka her
 * a kategorie, posouvání, nabídka jazyků, výběr profilu, formulář profilu
 * a potvrzení smazání ve všech zkušebních oknech menu a stavech (počet her,
 * profilů, jazyků, vrstva písmen, posunutí). Každý případ je `LayoutScene`
 * z `tests/shared/layoutRules.ts` s prvky v CSS px okna a s popisem
 * „obrazovka, okno, stav“ pro zprávu při selhání.
 *
 * Posouvané plochy (mřížka, kategorie, seznam jazyků) mají v případu
 * viditelnou část každého prvku tak, jak ji kreslí scéna: oříznutou
 * ořezem kamery (`clip`, `MenuScene.ts`). Zkouší se posuny z dřívějších
 * testů a k nim posuny, po kterých je každý prvek celý vidět. Prvek, který
 * při posunu vidět není, je v případu skrytý (`hidden`): 64 px a text se
 * měří na celém prvku (`whole`) vždy, ostatní pravidla ho přeskočí.
 *
 * Výjimka k rozhodnutí vlastníka (#82): ořez kamery mřížky a kategorií
 * dnes na telefonu na šířku sahá až k liště (0 px; iPad 16 px a telefon na
 * výšku 12 px by 8 px splnily), na telefonu na výšku jsou kategorie od
 * mřížky jen 4 px a ve všech oknech sahá ořez mřížky až ke spodnímu okraji
 * volné plochy (0 px). Mezi posouvaným obsahem a lištou nebo druhou
 * posouvanou plochou proto pravidlo mezery hlídá jen 0 px (`minGap`: nic
 * se nepřekrývá, nic nezajede pod lištu) a viditelná část posouvaného
 * prvku smí být u okraje volné plochy (`minEdge` 0 px, do plochy se vejít
 * musí). O 8 px a 4 px rozhodne vlastník. Jinak menu výjimky z pravidel
 * nemá.
 *
 * Karta (nabídka jazyků, rámeček potvrzení) leží nad obrazovkou a nese
 * svůj obsah: obsah smí ležet na kartě, jen když je na ní celý.
 *
 * Šířka textu se odhaduje jako v #65 (znaky × 0,6 × písmo) s rezervou
 * 8 px z obou stran, široké písmeno „W“ v přezdívce a v kolečku jako
 * 1,0 × písmo (#72 AC4). Přezdívka pod kolečkem má nejvýš dva řádky po
 * 20 px, dohromady 40 px, a měří se bez rezervy jako v #72 AC4.
 */

/** Všechna pravidla menu podle názvu: společná z #81 a „text se vejde“ (#82). */
export const MENU_LAYOUT_RULES: Readonly<Record<string, LayoutRule>> = {
  ...LAYOUT_RULES,
  'text se vejde do své plochy': textFitViolations,
};

export const MENU_RULE_NAMES: readonly string[] = Object.keys(MENU_LAYOUT_RULES);

/** Nejširší přezdívka: 12 písmen „W“ (#72 AC4). */
export const WIDEST_NICKNAME = 'WWWWWWWWWWWW';
/** Písmeno „W“ a přezdívka se počítají jako 1,0 × písmo na písmeno (#72 AC4). */
const WIDE_LETTER = 1;
/** Řádek přezdívky pod kolečkem: 16 px písma na 20 px, dva řádky mají 40 px (#72). */
const NICKNAME_LINE_HEIGHT = 20;

const NICKNAME_TITLE_KEY = 'profiles.nicknameTitle';
const COLOR_TITLE_KEY = 'profiles.colorTitle';
const QUESTION_KEY = 'profiles.deleteQuestion';
const CONFIRM_KEY = 'profiles.deleteConfirm';
const CANCEL_KEY = 'profiles.deleteCancel';

/** Vlastní názvy dnešních jazyků v pořadí nabídky. */
export const TODAY_LANGUAGE_NAMES: readonly string[] = LANGUAGES.map(
  (language) => sharedTexts(language).languageName,
);

/** Vlastní názvy 12 zkušebních jazyků (#70 AC2) v pořadí nabídky. */
export const MANY_LANGUAGE_LIST: readonly string[] = MANY_LANGUAGE_CODES.map(
  (code) => MANY_LANGUAGE_NAMES[code] ?? code,
);

// ---------------------------------------------------------------------------
// Pomůcky
// ---------------------------------------------------------------------------

export function shiftY(box: MenuBox, offset: number): MenuBox {
  return { ...box, top: box.top - offset, bottom: box.bottom - offset };
}

export function shiftX(box: MenuBox, offset: number): MenuBox {
  return { ...box, left: box.left - offset, right: box.right - offset };
}

/** Posun kategorie podle směru: řada vodorovně, sloupec svisle. */
export function shiftCategory(layout: MenuLayout, box: MenuBox, offset: number): MenuBox {
  return layout.categoryDirection === 'row' ? shiftX(box, offset) : shiftY(box, offset);
}

/** Část obdélníku, která je vidět ve viditelné ploše, nebo `undefined`. */
export function visiblePart(box: MenuBox, viewport: MenuBox): MenuBox | undefined {
  const part = {
    left: Math.max(box.left, viewport.left),
    right: Math.min(box.right, viewport.right),
    top: Math.max(box.top, viewport.top),
    bottom: Math.min(box.bottom, viewport.bottom),
  };
  return part.left < part.right && part.top < part.bottom ? part : undefined;
}

/** Ťukací prvek posouvané plochy: jen jeho viditelná část, nebo nic. */
function scrolledItem(
  name: string,
  whole: MenuBox,
  viewport: MenuBox,
  texts: readonly LayoutText[],
): LayoutItem[] {
  const part = visiblePart(whole, viewport);
  if (part === undefined) {
    return [{ name, box: whole, whole, hidden: true, tappable: true, texts }];
  }
  // Ořez kamery smí sahat až k okraji volné plochy (viz začátek souboru).
  return [{ name, box: part, whole, tappable: true, texts, minEdge: 0 }];
}

/** Obsah smí ležet na kartě `cardName`, jen když je na ní celý. */
function onCard(cardName: string): (first: LayoutItem, second: LayoutItem) => boolean {
  return (first, second) => {
    if (first.name === cardName) {
      return isInside(second.box, first.box);
    }
    if (second.name === cardName) {
      return isInside(first.box, second.box);
    }
    return false;
  };
}

/** Zkratky jazyků na tlačítku jazyka, jak je tlačítko ukáže. */
function codeTexts(codes: readonly string[], fontSize: number): LayoutText[] {
  return codes.map((code) => ({ text: code.toUpperCase(), fontSize }));
}

/** Popis posunu pro zprávu: začátek, část cesty, konec. */
interface Offset {
  readonly name: string;
  readonly value: number;
}

/**
 * Posuny, které dostanou každý prvek celý do viditelné plochy (#82):
 * pro každý prvek nejmenší posun, po kterém je vidět jeho konec. Posun,
 * který už v seznamu je, se nepřidá.
 */
function reachOffsets(
  maxOffset: number,
  wholes: ReadonlyArray<{ readonly name: string; readonly end: number }>,
  viewportEnd: number,
  known: readonly Offset[],
): Offset[] {
  const result: Offset[] = [...known];
  for (const { name, end } of wholes) {
    const value = Math.min(maxOffset, Math.max(0, end - viewportEnd));
    if (!result.some((offset) => Math.abs(offset.value - value) < 0.01)) {
      result.push({ name: `u prvku ${name}`, value });
    }
  }
  return result.slice(known.length);
}

/** Zkoušené posuny bez opakování (bez posouvání jen začátek). */
function offsetsOf(maxOffset: number, fractions: readonly number[]): Offset[] {
  const names: Readonly<Record<number, string>> = {
    0: 'na začátku',
    [1 / 3]: 'na třetině',
    [1 / 2]: 'v půlce',
    1: 'na konci',
  };
  if (maxOffset === 0) {
    return [{ name: 'bez posouvání', value: 0 }];
  }
  return fractions.map((fraction) => ({
    name: names[fraction] ?? String(fraction),
    value: maxOffset * fraction,
  }));
}

/** Posuny mřížky, které zkoušely dřívější testy (#69 AC1). */
export const GRID_OFFSET_FRACTIONS: readonly number[] = [0, 1 / 3, 1 / 2, 1];
/** Posuny kategorií a seznamu jazyků, které zkoušely dřívější testy (#69 AC4, #70 AC2). */
export const LIST_OFFSET_FRACTIONS: readonly number[] = [0, 1 / 2, 1];

// ---------------------------------------------------------------------------
// Lišta menu (profil, jazyk, zástupná tlačítka)
// ---------------------------------------------------------------------------

const BAR_NAMES: readonly string[] = ['místo pro profil', 'tlačítko jazyka', 'zástupné tlačítko'];

function barItems(layout: MenuLayout, codes: readonly string[]): LayoutItem[] {
  return [
    { name: 'místo pro profil', box: layout.profileSlot, tappable: true },
    {
      name: 'tlačítko jazyka',
      box: layout.languageSlot,
      tappable: true,
      texts: codeTexts(codes, layout.languageButtonFontSize),
    },
    ...layout.placeholders.map((box, index) => ({
      name: `zástupné tlačítko ${index + 1}`,
      box,
      tappable: true,
    })),
  ];
}

/** Karta nabídky jazyků a viditelné části řádků při posunu `offset`. */
function languagePanelItems(
  panel: MenuLanguagePanel,
  names: readonly string[],
  offset: number,
): LayoutItem[] {
  const rows = panel.rows.flatMap((row, index) =>
    scrolledItem(`jazyk ${names[index] ?? index + 1}`, shiftY(row, offset), panel.list.clip, [
      {
        text: names[index] ?? '',
        fontSize: panel.fontSize,
        padding: panel.textInset,
        reserve: panel.checkWidth,
      },
    ]),
  );
  return [{ name: LANGUAGE_CARD, box: panel.panel }, ...rows];
}

const LANGUAGE_CARD = 'nabídka jazyků';
const DELETE_CARD = 'rámeček potvrzení';

// ---------------------------------------------------------------------------
// Mřížka her a kategorie (dnešní obsah, #67)
// ---------------------------------------------------------------------------

/** Názvy kategorií, které dnes menu ukáže, v jazyce. */
export function todayCategoryTitles(language: Language = 'cs'): string[] {
  const all = [ALL_CATEGORY, ...GAME_CATEGORIES];
  return visibleCategories(GAMES, GAME_CATEGORIES).map((id) => {
    const category = all.find((candidate) => candidate.id === id);
    return menuText(category?.titleKey ?? '', language) ?? '';
  });
}

/** Menu s dnešními hrami a kategoriemi. */
export function todayLayout(window: TestWindow, language: Language = 'cs'): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: todayCategoryTitles(language),
    tileCount: GAMES.length,
  });
}

export function gridScenes(): LayoutScene[] {
  return LANGUAGES.flatMap((language) =>
    MENU_WINDOWS.map((window): LayoutScene => {
      const layout = todayLayout(window, language);
      const titles = todayCategoryTitles(language);
      const categories = layout.categories.map((category, index): LayoutItem => ({
        name: `kategorie ${titles[index] ?? index + 1}`,
        box: category.hit,
        tappable: true,
        texts: [
          { text: titles[index] ?? '', fontSize: layout.categoryFontSize, box: category.pill },
        ],
      }));
      const tiles = layout.tiles.map((tile, index): LayoutItem => {
        const game = GAMES[index];
        return {
          name: `dlaždice ${game?.id ?? index + 1}`,
          box: tile,
          tappable: true,
          texts: [
            {
              text: menuText(game?.titleKey ?? '', language) ?? '',
              fontSize: layout.tileTitleFontSize,
            },
          ],
        };
      });
      return {
        label: `mřížka her a kategorie, ${window.name}, ${language}`,
        free: freeAreaOf(window),
        items: [...barItems(layout, LANGUAGES), ...categories, ...tiles],
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Posouvání (40 her a 13 kategorií, #69)
// ---------------------------------------------------------------------------

/** Počty her vybrané kategorie ve zkušebním menu se 40 hrami. */
export const SCROLL_CONTENTS: ReadonlyArray<{ readonly name: string; readonly count: number }> = [
  { name: `${MANY_GAMES_COUNT} her ve „Vše“`, count: MANY_GAMES_COUNT },
  { name: '4 hry v kategorii', count: 4 },
  { name: '1 hra v kategorii', count: 1 },
];

function scrollScene(
  window: TestWindow,
  contentName: string,
  layout: MenuLayout,
  gridOffset: Offset,
  categoryOffset: Offset,
): LayoutScene {
  const categories = layout.categories.flatMap((category, index) => {
    const title = MANY_MENU_CATEGORY_TITLES[index] ?? '';
    return scrolledItem(
      `kategorie ${title}`,
      shiftCategory(layout, category.hit, categoryOffset.value),
      layout.categoryScroll.clip,
      [
        {
          text: title,
          fontSize: layout.categoryFontSize,
          box: shiftCategory(layout, category.pill, categoryOffset.value),
        },
      ],
    );
  });
  const tiles = layout.tiles.flatMap((tile, index) => {
    const game = MANY_GAMES[index];
    return scrolledItem(
      `dlaždice ${index + 1}`,
      shiftY(tile, gridOffset.value),
      layout.gridScroll.clip,
      [{ text: MANY_TEXTS_CS[game?.titleKey ?? ''] ?? '', fontSize: layout.tileTitleFontSize }],
    );
  });
  return {
    label:
      `posouvání, ${window.name}, ${contentName}, ` +
      `mřížka ${gridOffset.name}, kategorie ${categoryOffset.name}`,
    free: freeAreaOf(window),
    items: [...barItems(layout, LANGUAGES), ...categories, ...tiles],
    minGap: scrolledGap,
  };
}

/** Konec kategorie ve směru posouvání (řada vpravo, sloupec dole). */
function categoryEnd(layout: MenuLayout, box: MenuBox): number {
  return layout.categoryDirection === 'row' ? box.right : box.bottom;
}

/** Lišta, kategorie, nebo mřížka: do které části menu prvek patří. */
function partOf(item: LayoutItem): 'lišta' | 'kategorie' | 'mřížka' | 'jiné' {
  if (BAR_NAMES.some((name) => item.name.startsWith(name))) {
    return 'lišta';
  }
  if (item.whole === undefined) {
    return 'jiné';
  }
  return item.name.startsWith('kategorie') ? 'kategorie' : 'mřížka';
}

/**
 * Mezi posouvaným obsahem a lištou nebo druhou posouvanou plochou se
 * hlídá jen 0 px (nic se nepřekrývá, nic nezajede pod lištu), o 8 px
 * rozhodne vlastník (viz začátek souboru). Uvnitř jedné posouvané plochy
 * platí 8 px.
 */
function scrolledGap(first: LayoutItem, second: LayoutItem): number | undefined {
  const parts = [partOf(first), partOf(second)];
  const scrolled = parts.filter((part) => part === 'kategorie' || part === 'mřížka');
  if (scrolled.length === 0 || parts[0] === parts[1]) {
    return undefined;
  }
  return parts.includes('jiné') ? undefined : 0;
}

export function scrollScenes(): LayoutScene[] {
  return SCROLL_CONTENTS.flatMap(({ name, count }) =>
    MENU_WINDOWS.flatMap((window) => {
      const layout = manyGamesLayout(window, count);
      const gridOffsets = offsetsOf(layout.gridScroll.maxOffset, GRID_OFFSET_FRACTIONS);
      const categoryOffsets = offsetsOf(layout.categoryScroll.maxOffset, LIST_OFFSET_FRACTIONS);
      const [gridStart, categoryStart] = [gridOffsets[0], categoryOffsets[0]] as [Offset, Offset];
      const crossed = gridOffsets.flatMap((gridOffset) =>
        categoryOffsets.map((categoryOffset) =>
          scrollScene(window, name, layout, gridOffset, categoryOffset),
        ),
      );
      // Posuny, po kterých je každá dlaždice a kategorie celá vidět.
      const tileReach = reachOffsets(
        layout.gridScroll.maxOffset,
        layout.tiles.map((tile, index) => ({ name: `dlaždice ${index + 1}`, end: tile.bottom })),
        layout.gridScroll.viewport.bottom,
        gridOffsets,
      ).map((gridOffset) => scrollScene(window, name, layout, gridOffset, categoryStart));
      const categoryReach = reachOffsets(
        layout.categoryScroll.maxOffset,
        layout.categories.map((category, index) => ({
          name: `kategorie ${MANY_MENU_CATEGORY_TITLES[index] ?? index + 1}`,
          end: categoryEnd(layout, category.hit),
        })),
        categoryEnd(layout, layout.categoryScroll.viewport),
        categoryOffsets,
      ).map((categoryOffset) => scrollScene(window, name, layout, gridStart, categoryOffset));
      return [...crossed, ...tileReach, ...categoryReach];
    }),
  );
}

// ---------------------------------------------------------------------------
// Nabídka jazyků (#70)
// ---------------------------------------------------------------------------

export const LANGUAGE_CASES: ReadonlyArray<{
  readonly name: string;
  readonly names: readonly string[];
  readonly codes: readonly string[];
}> = [
  { name: 'dnešní jazyky', names: TODAY_LANGUAGE_NAMES, codes: LANGUAGES },
  { name: '12 jazyků', names: MANY_LANGUAGE_LIST, codes: MANY_LANGUAGE_CODES },
];

export function languageLayout(window: TestWindow, names: readonly string[]): MenuLayout {
  return manyGamesLayout(window, MANY_GAMES_COUNT, names);
}

export function languageScenes(): LayoutScene[] {
  return LANGUAGE_CASES.flatMap(({ name, names, codes }) =>
    MENU_WINDOWS.flatMap((window) => {
      const layout = languageLayout(window, names);
      const panel = layout.languagePanel;
      const fractions = offsetsOf(panel.list.maxOffset, LIST_OFFSET_FRACTIONS);
      const reach = reachOffsets(
        panel.list.maxOffset,
        panel.rows.map((row, index) => ({
          name: `jazyk ${names[index] ?? index + 1}`,
          end: row.bottom,
        })),
        panel.list.viewport.bottom,
        fractions,
      );
      return [...fractions, ...reach].map((offset): LayoutScene => ({
        label: `nabídka jazyků, ${window.name}, ${name}, seznam ${offset.name}`,
        free: freeAreaOf(window),
        items: [...barItems(layout, codes), ...languagePanelItems(panel, names, offset.value)],
        mayOverlap: onCard(LANGUAGE_CARD),
      }));
    }),
  );
}

// ---------------------------------------------------------------------------
// Výběr profilu (#72 AC1, AC4)
// ---------------------------------------------------------------------------

export const PICKER_CASES: ReadonlyArray<{
  readonly name: string;
  readonly count: number;
  readonly add: boolean;
}> = [
  { name: '6 profilů bez „+“', count: 6, add: false },
  { name: '5 profilů a „+“', count: 5, add: true },
  { name: '2 profily a „+“', count: 2, add: true },
];

export function pickerLayout(window: TestWindow, profileCount: number, showAdd: boolean) {
  return profilePickerLayoutFor(viewportOf(window), {
    profileCount,
    showAdd,
    languageNames: TODAY_LANGUAGE_NAMES,
  });
}

export function pickerScenes(): LayoutScene[] {
  return PICKER_CASES.flatMap(({ name, count, add }) =>
    MENU_WINDOWS.flatMap((window): LayoutScene[] => {
      const layout = pickerLayout(window, count, add);
      const free = freeAreaOf(window);
      const symbol = (): LayoutText[] => [
        { text: 'W', fontSize: layout.symbolFontSize, charWidth: WIDE_LETTER },
      ];
      const languageButton: LayoutItem = {
        name: 'tlačítko jazyka',
        box: layout.languageSlot,
        tappable: true,
        texts: codeTexts(LANGUAGES, layout.languageButtonFontSize),
      };
      const profiles = layout.profiles.flatMap((slot, index): LayoutItem[] => [
        {
          name: `kolečko ${index + 1}`,
          box: slot.circle,
          tappable: true,
          texts: symbol(),
        },
        {
          name: `přezdívka ${index + 1}`,
          box: slot.nickname,
          texts: [
            {
              text: WIDEST_NICKNAME,
              fontSize: layout.nicknameFontSize,
              charWidth: WIDE_LETTER,
              maxLines: layout.nicknameMaxLines,
              lineHeight: NICKNAME_LINE_HEIGHT,
              // Přezdívka pod kolečkem se měří bez rezervy, přesně podle #72 AC4.
              padding: 0,
            },
          ],
        },
      ]);
      const addButton: LayoutItem[] =
        layout.add === null
          ? []
          : [{ name: '„+“', box: layout.add, tappable: true, texts: symbol() }];
      return [
        {
          label: `výběr profilu, ${window.name}, ${name}`,
          free,
          items: [languageButton, ...profiles, ...addButton],
        },
        {
          label: `výběr profilu, ${window.name}, ${name}, otevřená nabídka jazyků`,
          free,
          items: [
            languageButton,
            ...languagePanelItems(layout.languagePanel, TODAY_LANGUAGE_NAMES, 0),
          ],
          mayOverlap: onCard(LANGUAGE_CARD),
        },
      ];
    }),
  );
}

// ---------------------------------------------------------------------------
// Formulář profilu (#72 AC2–AC4, koš z #73 AC2)
// ---------------------------------------------------------------------------

export type FormStep = 'základní vrstva' | 'diakritika' | 'barva' | 'barva s košem';
export const FORM_STEPS: readonly FormStep[] = [
  'základní vrstva',
  'diakritika',
  'barva',
  'barva s košem',
];

export function nicknameLayout(window: TestWindow, layer: LetterLayer): NicknameStepLayout {
  return nicknameStepLayoutFor(viewportOf(window), { layer });
}

export function colorLayout(window: TestWindow, withTrash = false): ColorStepLayout {
  return colorStepLayoutFor(viewportOf(window), { withTrash });
}

function keyName(key: LetterKey): string {
  if (key.kind === 'letter') {
    return `klávesa ${key.letter}`;
  }
  return key.kind === 'switch' ? 'přepínač vrstvy' : '⌫';
}

/** Nadpis a počítadlo kroku, kde na ně je místo. */
function headingItems(
  layout: NicknameStepLayout | ColorStepLayout,
  titleKey: string,
  language: Language,
): LayoutItem[] {
  const items: LayoutItem[] = [];
  if (layout.title !== null) {
    items.push({
      name: 'nadpis',
      box: layout.title,
      texts: [{ text: menuText(titleKey, language) ?? '', fontSize: layout.titleFontSize }],
    });
  }
  if (layout.stepCounter !== null) {
    items.push({ name: 'počítadlo kroků', box: layout.stepCounter });
  }
  return items;
}

function nicknameStepItems(window: TestWindow, layer: LetterLayer, language: Language) {
  const layout = nicknameLayout(window, layer);
  const keys = letterKeys(layer);
  const keyItems = layout.keys.map((box, index): LayoutItem => ({
    name: keyName(keys[index] ?? { kind: 'backspace' }),
    box,
    tappable: true,
    texts: [
      { text: 'W', fontSize: layout.keyFontSize, charWidth: WIDE_LETTER },
      { text: 'ÁČ', fontSize: layout.keyFontSize },
    ],
  }));
  return [
    ...keyItems,
    {
      name: 'pole přezdívky',
      box: layout.field,
      texts: [{ text: WIDEST_NICKNAME, fontSize: layout.fieldFontSize, charWidth: WIDE_LETTER }],
    },
    { name: 'zpět', box: layout.back, tappable: true },
    { name: '→', box: layout.next, tappable: true },
    ...headingItems(layout, NICKNAME_TITLE_KEY, language),
  ];
}

function colorStepItems(window: TestWindow, withTrash: boolean, language: Language) {
  const layout = colorLayout(window, withTrash);
  const trash: LayoutItem[] =
    layout.trash === null ? [] : [{ name: 'koš', box: layout.trash, tappable: true }];
  return [
    {
      name: 'náhled kolečka',
      box: layout.preview,
      texts: [{ text: 'W', fontSize: layout.previewSymbolFontSize, charWidth: WIDE_LETTER }],
    },
    {
      name: 'přezdívka',
      box: layout.nickname,
      texts: [{ text: WIDEST_NICKNAME, fontSize: layout.nicknameFontSize, charWidth: WIDE_LETTER }],
    },
    ...layout.swatches.map((box, index): LayoutItem => ({
      name: `barva ${index + 1}`,
      box,
      tappable: true,
    })),
    { name: 'zpět', box: layout.back, tappable: true },
    { name: '✓', box: layout.save, tappable: true },
    ...trash,
    ...headingItems(layout, COLOR_TITLE_KEY, language),
  ];
}

function formStepItems(window: TestWindow, step: FormStep, language: Language): LayoutItem[] {
  switch (step) {
    case 'základní vrstva':
      return nicknameStepItems(window, 'base', language);
    case 'diakritika':
      return nicknameStepItems(window, 'accents', language);
    case 'barva':
      return colorStepItems(window, false, language);
    case 'barva s košem':
      return colorStepItems(window, true, language);
  }
}

export function formScenes(): LayoutScene[] {
  return LANGUAGES.flatMap((language) =>
    FORM_STEPS.flatMap((step) =>
      MENU_WINDOWS.map((window): LayoutScene => ({
        label: `formulář profilu, ${window.name}, ${step}, ${language}`,
        free: freeAreaOf(window),
        items: formStepItems(window, step, language),
      })),
    ),
  );
}

// ---------------------------------------------------------------------------
// Potvrzení smazání (#73 AC2)
// ---------------------------------------------------------------------------

export function deleteScenes(): LayoutScene[] {
  return LANGUAGES.flatMap((language) =>
    MENU_WINDOWS.map((window): LayoutScene => {
      const layout = deleteConfirmLayoutFor(viewportOf(window));
      const text = (key: string, fontSize: number): LayoutText[] => [
        { text: menuText(key, language) ?? '', fontSize },
      ];
      return {
        label: `smazání profilu, ${window.name}, ${language}`,
        free: freeAreaOf(window),
        items: [
          { name: DELETE_CARD, box: layout.panel },
          {
            name: 'náhled kolečka',
            box: layout.preview,
            texts: [{ text: 'W', fontSize: layout.previewSymbolFontSize, charWidth: WIDE_LETTER }],
          },
          {
            name: 'přezdívka',
            box: layout.nickname,
            texts: [
              { text: WIDEST_NICKNAME, fontSize: layout.nicknameFontSize, charWidth: WIDE_LETTER },
            ],
          },
          {
            name: 'otázka',
            box: layout.question,
            texts: text(QUESTION_KEY, layout.questionFontSize),
          },
          {
            name: '„Smazat“',
            box: layout.confirm,
            tappable: true,
            texts: text(CONFIRM_KEY, layout.buttonFontSize),
          },
          {
            name: '„Zpět“',
            box: layout.cancel,
            tappable: true,
            texts: text(CANCEL_KEY, layout.buttonFontSize),
          },
        ],
        mayOverlap: onCard(DELETE_CARD),
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Testy pravidel a počtu kombinací (AC1, AC4)
// ---------------------------------------------------------------------------

/**
 * Projde posouvané prvky `names` v případech jednoho okna a stavu (#82):
 * každý prvek musí být v každém případu (viditelný nebo skrytý, aby ho
 * pravidla 64 px a text změřila) a aspoň v jednom případu celý vidět.
 * Vrátí seznam problémů jako věty, prázdný znamená, že je všechno v pořádku.
 */
export function unseenElements(scenes: readonly LayoutScene[], names: readonly string[]): string[] {
  const isWhole = (item: LayoutItem): boolean =>
    !item.hidden && item.whole !== undefined && isInside(item.whole, item.box);
  return names.flatMap((name) => {
    const problems: string[] = [];
    const missing = scenes.find((scene) => !scene.items.some((item) => item.name === name));
    if (missing !== undefined) {
      problems.push(`${missing.label}: chybí ${name}`);
    }
    const seen = scenes.some((scene) =>
      scene.items.some((item) => item.name === name && isWhole(item)),
    );
    if (!seen) {
      problems.push(`${name} není celý vidět v žádném případu`);
    }
    return problems;
  });
}

const shown = (scene: LayoutScene): LayoutItem[] => scene.items.filter((item) => !item.hidden);
const drawn = (scene: LayoutScene): LayoutItem[] => shown(scene).filter((item) => !item.reserved);
const taps = (scene: LayoutScene): LayoutItem[] =>
  scene.items.filter((item) => item.tappable === true && !item.reserved);

/**
 * Použije se pravidlo na případ doopravdy? Případ se do počtu kombinací
 * (AC4) počítá, jen když má pravidlo co měřit: vidět aspoň jeden prvek
 * (vejde se, 4 px), aspoň dva prvky (překryv), aspoň jednu ťukací plochu
 * (64 px), aspoň dvě viditelné ťukací plochy (8 px) a aspoň jeden text.
 */
const RULE_APPLIES: Readonly<Record<string, (scene: LayoutScene) => boolean>> = {
  'vejde se do okna i mimo výřez': (scene) => drawn(scene).length > 0,
  'nic se nepřekrývá': (scene) => shown(scene).length > 1,
  'ťukací plocha aspoň 64 px': (scene) => taps(scene).length > 0,
  'mezera mezi plochami aspoň 8 px': (scene) =>
    taps(scene).filter((item) => !item.hidden).length > 1,
  'aspoň 4 px od okraje': (scene) => drawn(scene).length > 0,
  'text se vejde do své plochy': (scene) =>
    scene.items.some((item) => (item.texts ?? []).length > 0),
};

/**
 * Pro obrazovku přidá jeden test na každé pravidlo (AC1): v cyklu projde
 * všechny případy a zpráva při selhání řekne obrazovku, okno, stav
 * a prvek. Druhý blok porovná počet různých případů, na které se pravidlo
 * opravdu použije, s počtem kombinací
 * (obrazovka × okno × stav), které pravidlo hlídalo před #82 (AC4).
 */
export function describeLayoutRules(
  screenTitle: string,
  buildScenes: () => LayoutScene[],
  todayCombinations: Readonly<Record<string, number>>,
): void {
  let cached: LayoutScene[] | undefined;
  const scenes = (): LayoutScene[] => {
    cached ??= buildScenes();
    return cached;
  };

  describe(`#82 AC1: ${screenTitle} dodrží společná pravidla v každém okně a stavu`, () => {
    for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
      it(`${ruleName}`, () => {
        for (const scene of scenes()) {
          expect(rule(scene), scene.label).toEqual([]);
        }
      });
    }
  });

  describe(`#82 AC4: ${screenTitle} projde aspoň tolik kombinací jako testy před #82`, () => {
    for (const ruleName of MENU_RULE_NAMES) {
      it(`${ruleName}: aspoň ${todayCombinations[ruleName] ?? '?'} různých kombinací, na které se pravidlo použije`, () => {
        const today = todayCombinations[ruleName];
        const applies = RULE_APPLIES[ruleName];
        expect(today, ruleName).toBeDefined();
        expect(applies, ruleName).toBeDefined();
        const labels = scenes()
          .filter((scene) => applies?.(scene) ?? false)
          .map((scene) => scene.label);
        expect(new Set(labels).size, 'každý případ je jiná kombinace').toBe(labels.length);
        expect(labels.length).toBeGreaterThanOrEqual(today ?? Infinity);
      });
    }
  });
}
