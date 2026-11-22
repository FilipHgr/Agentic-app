/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { GAMES, GAME_METAS } from '../../../src/gameList';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { coloringTexts } from '../../../src/games/coloring/texts/coloringTexts';
import { createMenu } from '../../../src/menu/logic/menu';
import { menuText } from '../../../src/menu/logic/menuTexts';
import { isGameUnlocked } from '../../../src/shared/logic/gameAccess';
import { GAME_CATEGORIES, findGame } from '../../../src/shared/logic/gameRegistry';
import { chooseSubscriptionSource } from '../../../src/shared/logic/subscriptionSource';
import { ACTIVE_SOURCE, NOT_ACTIVE_SOURCES } from '../../shared/subscriptionFixtures';
import { dictionariesByLanguage, leavesOf } from '../../shared/textChecks';

/**
 * Testy k #88 AC1 (dlaždice Omalovánky v nové kategorii, hra hned
 * dostupná) a k části AC7 „hra nemá žádné texty kromě názvu v menu“, kterou
 * jde ověřit na souborech textů. Rozhodnutí vlastníka k otázce 3: kategorie
 * „Kreslení“ a symbol ✎ (znak bez emoji varianty).
 *
 * Navržené rozhraní:
 * - `src/games/coloring/meta.ts` vydává `COLORING_META: GameMeta`
 *   (`id: 'coloring'`, `categoryId: 'drawing'`, `symbol: '✎'`, `access: 'free'`),
 * - `src/games/coloring/texts/coloringTexts.ts` vydává
 *   `coloringTexts(language?): ColoringTexts` s jediným klíčem `title`,
 * - nová kategorie `{ id: 'drawing', titleKey: 'categories.drawing.title' }`
 *   v `GAME_CATEGORIES` a její název v `src/menu/texts/cs.ts`.
 */

const COLORING_ID = 'coloring';
const DRAWING_CATEGORY = 'drawing';

/** Texty Omalovánek každého jazyka se souborem `src/games/coloring/texts/<jazyk>.ts`. */
const COLORING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/coloring/texts/*.ts', { eager: true }),
);

/** Menu se skutečným seznamem her a kategorií v češtině; hra se nespouští. */
function czechMenu() {
  return createMenu({
    games: GAMES,
    categories: GAME_CATEGORIES,
    translate: (key) => menuText(key, 'cs') ?? key,
    start: () => undefined,
    feedback: () => undefined,
  });
}

describe('#88 AC1: v menu je dlaždice Omalovánky v nové kategorii', () => {
  it('seznam her obsahuje Omalovánky', () => {
    expect(GAMES.map((game) => game.id)).toContain(COLORING_ID);
    expect(GAME_METAS).toContain(COLORING_META);
  });

  it('Počítání v seznamu her zůstává', () => {
    expect(GAMES.map((game) => game.id)).toContain('counting');
  });

  it('dlaždice Omalovánek má symbol ✎ bez emoji varianty', () => {
    const symbol = findGame(GAMES, COLORING_ID)?.symbol;
    expect(symbol).toBe('✎');
    expect(symbol).not.toContain('️');
  });

  it('dlaždice ukáže česky název „Omalovánky“ z textů hry', () => {
    expect(coloringTexts('cs').title).toBe('Omalovánky');
    expect(menuText('games.coloring.title', 'cs')).toBe('Omalovánky');
    expect(COLORING_META.titles.cs).toBe('Omalovánky');
  });

  it('Omalovánky jsou v nové kategorii „Kreslení“, ne ve Sčítání a odčítání', () => {
    expect(findGame(GAMES, COLORING_ID)?.categoryId).toBe(DRAWING_CATEGORY);
    expect(GAME_CATEGORIES.map((category) => category.id)).toContain(DRAWING_CATEGORY);
    expect(menuText('categories.drawing.title', 'cs')).toBe('Kreslení');
  });

  it('menu ukáže kategorii Kreslení a v ní dlaždici Omalovánky', () => {
    const menu = czechMenu();
    const drawing = menu.categories().find((category) => category.id === DRAWING_CATEGORY);
    expect(drawing?.title).toBe('Kreslení');

    menu.tapCategory(DRAWING_CATEGORY);
    expect(menu.tiles()).toEqual([{ gameId: COLORING_ID, symbol: '✎', title: 'Omalovánky' }]);
  });

  it('v kategorii Vše jsou Omalovánky i Počítání', () => {
    const tiles = czechMenu()
      .tiles()
      .map((tile) => tile.gameId);
    expect(tiles).toContain(COLORING_ID);
    expect(tiles).toContain('counting');
  });
});

describe('#88 AC1: Omalovánky jsou hned dostupné, bez odemykání', () => {
  it('Omalovánky jsou zdarma', () => {
    expect(findGame(GAMES, COLORING_ID)?.access).toBe('free');
  });

  it('Omalovánky jsou odemčené dnes i bez aktivního předplatného', () => {
    const game = findGame(GAMES, COLORING_ID);
    expect(game).toBeDefined();
    if (game === undefined) {
      return;
    }
    expect(isGameUnlocked(game, chooseSubscriptionSource())).toBe(true);
    expect(isGameUnlocked(game, ACTIVE_SOURCE)).toBe(true);
    for (const [name, source] of NOT_ACTIVE_SOURCES) {
      expect(isGameUnlocked(game, source), name).toBe(true);
    }
  });
});

describe('#88 AC7 (část): hra nemá žádné texty kromě názvu v menu', () => {
  it('Omalovánky mají soubor textů aspoň v češtině', () => {
    expect(Object.keys(COLORING_FILES)).toContain('cs');
  });

  it('texty Omalovánek v každém jazyce obsahují jen název hry', () => {
    for (const [language, texts] of Object.entries(COLORING_FILES)) {
      expect([...leavesOf(texts).keys()], language).toEqual(['title']);
    }
  });

  it('název hry není v žádném jazyce prázdný', () => {
    for (const [language, texts] of Object.entries(COLORING_FILES)) {
      expect(String(texts['title'] ?? '').trim().length, language).toBeGreaterThan(0);
    }
  });
});
