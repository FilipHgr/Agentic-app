/**
 * Pomůcky pro testy nedávných barev v Omalovánkách (#99). Ťuknutí na
 * nedávnou barvu v pruhu (`touchTargetAt(…).kind === 'recentColor'`) hlásí
 * scéna jako `game.tapRecentColor(index)`, ťuknutí na barvu v panelu jako
 * `game.tapColor(index)`. Co je v místech pruhu vidět, je
 * `game.recentColors()`: dvě místa, index barvy `PALETTE` nebo `null`
 * u prázdného místa.
 */

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';

/** Barvy palety podle indexu (schválně ne konstanty z kódu). */
export const RED = 0;
export const ORANGE = 1;
export const YELLOW = 2;
export const GREEN = 3;
export const BLUE = 4;
export const PURPLE = 5;
export const BROWN = 6;
export const BLACK = 7;

/** Kolik barev má paleta (#88 AC4, od #100 12 barev). */
export const PALETTE_SIZE = 12;

/** Míst pro nedávné barvy v pruhu (#99, otázka 1). */
export const RECENT_PLACES = 2;

/** Co dítě vidí: vybranou barvu a dvě místa nedávných barev. */
export interface ColorChoice {
  readonly selected: number;
  readonly recent: readonly (number | null)[];
}

/** Co dítě právě vidí ve hře. */
export function choiceOf(game: SavedColoring): ColorChoice {
  return { selected: game.palette().selected, recent: [...game.recentColors()] };
}

/**
 * Pravidlo z #99 AC2 přepsané přímo ze zadání: je vybraná S a nedávné
 * [A, B]. Výběr X jiné než S: vybraná je X, nedávné S a za ní první ze
 * starých nedávných, která není X. Výběr S nic nezmění.
 */
export function expectedAfterPick(before: ColorChoice, picked: number): ColorChoice {
  if (picked === before.selected) {
    return before;
  }
  const kept = before.recent.find((color) => color !== picked) ?? null;
  return { selected: picked, recent: [before.selected, kept] };
}

/**
 * Připraví stav „vybraná `selected`, nedávné [`first`, `second`]“ výběrem
 * barev v panelu: `second`, `first`, `selected`. Hra začíná první barvou
 * (červenou), barvy musí být navzájem různé a `second` ne červená.
 */
export function arrange(
  game: SavedColoring,
  selected: number,
  first: number,
  second: number,
): void {
  game.tapColor(second);
  game.tapColor(first);
  game.tapColor(selected);
}

/** Barvy, které dítě vidí: vybraná a obsazená místa nedávných barev. */
export function visibleColors(choice: ColorChoice): number[] {
  return [choice.selected, ...choice.recent.filter((color): color is number => color !== null)];
}

/**
 * Generátor čísel v [0, 1) s pevným seedem (mulberry32), aby náhodné řady
 * ťuknutí dopadly pokaždé stejně.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Celé číslo v [0, `count`) z generátoru `random`. */
export function pick(random: () => number, count: number): number {
  return Math.floor(random() * count);
}
