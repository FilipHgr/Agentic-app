/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';

import { GAMES, GAME_METAS } from '../../../src/gameList';
import { COMPARE_META } from '../../../src/games/compare/meta';
import { compareTexts } from '../../../src/games/compare/texts/compareTexts';
import { createMenu } from '../../../src/menu/logic/menu';
import { menuText } from '../../../src/menu/logic/menuTexts';
import { isGameUnlocked } from '../../../src/shared/logic/gameAccess';
import { GAME_CATEGORIES, findGame } from '../../../src/shared/logic/gameRegistry';
import type { GameEntry } from '../../../src/shared/logic/gameRegistry';
import { chooseSubscriptionSource } from '../../../src/shared/logic/subscriptionSource';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { IPAD_WINDOWS, freeAreaOf, viewportOf } from '../../shared/viewportFixtures';
import { dictionariesByLanguage, leavesOf } from '../../shared/textChecks';

/**
 * Testy k #178 AC1 (dlaždice Porovnávání v nové kategorii Čísla, ťuknutí
 * spustí hru) a AC8 (texty cs/en). Scéna potřebuje Phaser a prohlížeč,
 * v testu ji nahradí prázdná třída; zkouší se, co vstup hry vydá stránce.
 */

vi.mock('../../../src/games/compare/scenes/CompareScene', () => ({
  CompareScene: class {},
}));

const COMPARE_ID = 'compare';
const NUMBERS_CATEGORY = 'numbers';

const COMPARE_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/compare/texts/*.ts', { eager: true }),
);

function menuIn(
  language: 'cs' | 'en',
  start: (game: GameEntry, loaded: unknown) => void = () => undefined,
) {
  return createMenu({
    games: GAMES,
    categories: GAME_CATEGORIES,
    translate: (key) => menuText(key, language) ?? key,
    start,
    feedback: () => undefined,
  });
}

describe('#178 AC1: v menu je dlaždice Porovnávání v nové kategorii Čísla', () => {
  it('seznam her obsahuje Porovnávání a Počítání i Omalovánky zůstávají', () => {
    const ids = GAMES.map((game) => game.id);
    expect(ids).toContain(COMPARE_ID);
    expect(ids).toContain('counting');
    expect(ids).toContain('coloring');
    expect(GAME_METAS).toContain(COMPARE_META);
  });

  it('dlaždice se jmenuje česky „Porovnávání“ a anglicky „Compare“', () => {
    expect(compareTexts('cs').title).toBe('Porovnávání');
    expect(compareTexts('en').title).toBe('Compare');
    expect(menuText('games.compare.title', 'cs')).toBe('Porovnávání');
    expect(menuText('games.compare.title', 'en')).toBe('Compare');
  });

  it('kategorie se jmenuje česky „Čísla“ a anglicky „Numbers“ a má symbol „< >“', () => {
    const numbers = GAME_CATEGORIES.find((category) => category.id === NUMBERS_CATEGORY);
    expect(numbers?.symbol).toBe('< >');
    expect(menuText('categories.numbers.title', 'cs')).toBe('Čísla');
    expect(menuText('categories.numbers.title', 'en')).toBe('Numbers');
  });

  it('Porovnávání je v kategorii Čísla a ta v menu ukáže jen jeho dlaždici', () => {
    expect(findGame(GAMES, COMPARE_ID)?.categoryId).toBe(NUMBERS_CATEGORY);
    const menu = menuIn('cs');
    expect(menu.categories().map((category) => category.id)).toContain(NUMBERS_CATEGORY);
    menu.tapCategory(NUMBERS_CATEGORY);
    expect(menu.tiles()).toEqual([
      { gameId: COMPARE_ID, symbol: COMPARE_META.symbol, title: 'Porovnávání' },
    ]);
  });

  it('v kategorii Vše je dlaždice Porovnávání vedle ostatních her', () => {
    const tiles = menuIn('en')
      .tiles()
      .map((tile) => tile.gameId);
    expect(tiles).toEqual(expect.arrayContaining(['counting', 'coloring', COMPARE_ID]));
  });

  it('dlaždice má symbol bez emoji varianty a obrázek ze stejné stránky', () => {
    const game = findGame(GAMES, COMPARE_ID);
    expect(game?.symbol).toBe(COMPARE_META.symbol);
    expect(COMPARE_META.symbol).not.toContain('️');
    expect(typeof game?.tile).toBe('string');
    expect(game?.tile).not.toBe('');
  });

  it('Porovnávání je zdarma a odemčené', () => {
    const game = findGame(GAMES, COMPARE_ID);
    expect(game?.access).toBe('free');
    if (game !== undefined) {
      expect(isGameUnlocked(game, chooseSubscriptionSource())).toBe(true);
    }
  });

  it('ťuknutí na dlaždici stáhne hru a spustí ji se scénami', async () => {
    const start = vi.fn();
    const menu = menuIn('cs', start);
    menu.tapTile(COMPARE_ID);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    const [game, loaded] = start.mock.calls[0] as [GameEntry, unknown];
    expect(game.id).toBe(COMPARE_ID);
    const scenes = (loaded as { scenes?: unknown }).scenes;
    expect(Array.isArray(scenes) && scenes.length > 0).toBe(true);
  });

  it('vstup hry chce plochu přes celé okno, i na iPadu', async () => {
    const compare = await import('../../../src/games/compare');
    expect(compare.gameAreaFit).toBe('fullWindow');
    for (const window of IPAD_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), compare.gameAreaFit);
      const free = freeAreaOf(window);
      expect(area.width * area.scale, window.name).toBeCloseTo(free.right - free.left, 0);
    }
  });
});

describe('#178 AC8: texty hry jsou v češtině i angličtině', () => {
  it('Porovnávání má soubor textů pro češtinu i angličtinu', () => {
    expect(Object.keys(COMPARE_FILES).sort()).toEqual(['cs', 'en']);
  });

  // #179 přidal popisky řad nastavení pro rodiče, #181 repliky Rudyho, které
  // jen zazní nahrávkou (hlídá je rudyVoiceFiles.test.ts). Od #187 má
  // nastavení řadu „Do kolika“, od #188 i „Odpověď“, a otázky průvodce (#182)
  // jsou pryč; jiné texty hra nemá, symboly + − = ☐ nejsou texty jazyka.
  it('texty hry mají název hry, popisky řad nastavení a repliky Rudyho a nic z nich není v žádném jazyce prázdné', () => {
    for (const [language, texts] of Object.entries(COMPARE_FILES)) {
      const shown = [...leavesOf(texts).keys()].filter((key) => !key.startsWith('rudyLines.'));
      expect(shown.sort(), language).toEqual(
        ['rowLabels.answerInput', 'rowLabels.maxNumber', 'title'].sort(),
      );
      expect(Object.keys(texts), language).not.toContain('guideLines');
      for (const [key, value] of leavesOf(texts)) {
        expect(String(value ?? '').trim().length, `${language}: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('popisky řad nastavení jsou česky „Do kolika“ a „Odpověď“, anglicky „Up to“ a „Answer“ (#179, #187, #188)', () => {
    expect(compareTexts('cs').rowLabels).toEqual({
      maxNumber: 'Do kolika',
      answerInput: 'Odpověď',
    });
    expect(compareTexts('en').rowLabels).toEqual({ maxNumber: 'Up to', answerInput: 'Answer' });
  });
});
