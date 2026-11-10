/**
 * Kategorie v menu (#67 AC3): nejdřív „Vše“, pak jen kategorie, ve kterých
 * je aspoň jedna hra, v pořadí seznamu kategorií. Hry v mřížce jsou
 * v pořadí registru. Pořadí nezávisí na jazyce ani na abecedě názvů.
 */

import type { GameCategory, GameEntry } from '../../shared/logic/gameRegistry';

/** „Vše“ není kategorie ze seznamu, ukáže všechny hry. Symbol ▦ podle obrázku D4 (#95). */
export const ALL_CATEGORY: GameCategory = {
  id: 'all',
  titleKey: 'categories.all.title',
  symbol: '▦',
};

/** Id kategorií, které menu ukáže: „Vše“ a kategorie s aspoň jednou hrou. */
export function visibleCategories(
  games: readonly GameEntry[],
  categories: readonly GameCategory[],
): string[] {
  const used = categories.filter((category) =>
    games.some((game) => game.categoryId === category.id),
  );
  return [ALL_CATEGORY.id, ...used.map((category) => category.id)];
}

/** Hry vybrané kategorie v pořadí registru; „Vše“ dá všechny. */
export function gamesInCategory(games: readonly GameEntry[], categoryId: string): GameEntry[] {
  if (categoryId === ALL_CATEGORY.id) {
    return [...games];
  }
  return games.filter((game) => game.categoryId === categoryId);
}
