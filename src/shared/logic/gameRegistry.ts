/**
 * Registr her (#67): tvar záznamu hry, seznam kategorií v pevném pořadí
 * a vyhledání hry podle id. Samotný seznam her leží vedle vstupu stránky
 * (`src/gameList.ts`), protože sdílená část nesmí importovat hry.
 * Čistý TypeScript bez Phaseru.
 */

import type { Language } from '../texts/languages';
import type { GameAccess } from './gameAccess';

/** Kategorie her v menu. Id je stálé, název se bere z textů menu podle klíče. */
export interface GameCategory {
  readonly id: string;
  readonly titleKey: string;
}

/**
 * Kategorie v pořadí, v jakém je menu ukáže. Menu ukáže jen ty, ve kterých
 * je aspoň jedna hra. Nová kategorie potřebuje název v textech menu
 * (`src/menu/texts/<jazyk>.ts`).
 */
export const GAME_CATEGORIES: readonly GameCategory[] = [
  { id: 'addingSubtracting', titleKey: 'categories.addingSubtracting.title' },
  { id: 'drawing', titleKey: 'categories.drawing.title' },
];

/**
 * Údaje o hře pro menu ze souboru `src/games/<hra>/meta.ts`: menu je zná
 * dřív, než se hra stáhne.
 */
export interface GameMeta {
  /** Malá písmena bez diakritiky, stejné jako složka hry. */
  readonly id: string;
  readonly categoryId: string;
  /** Symbol na dlaždici (třeba „2+3“); není to text jazyka. */
  readonly symbol: string;
  /** Zdarma, nebo v předplatném (#74). O odemčení rozhoduje `gameAccess.ts`. */
  readonly access: GameAccess;
  /** Název hry v každém jazyce, z textů hry. */
  readonly titles: Readonly<Record<Language, string>>;
}

/** Záznam hry v registru. */
export interface GameEntry {
  readonly id: string;
  /** Klíč názvu hry v textech (`games.<id>.title`). */
  readonly titleKey: string;
  readonly categoryId: string;
  readonly symbol: string;
  /** Zdarma, nebo v předplatném (#74). */
  readonly access: GameAccess;
  /** Stáhne hru (vstup `src/games/<hra>/index.ts`). */
  readonly load: () => Promise<unknown>;
}

/** Klíč názvu hry v textech. */
export function gameTitleKey(gameId: string): string {
  return `games.${gameId}.title`;
}

/** Záznam registru z údajů hry a funkce, která ji stáhne. */
export function gameEntry(meta: GameMeta, load: () => Promise<unknown>): GameEntry {
  return {
    id: meta.id,
    titleKey: gameTitleKey(meta.id),
    categoryId: meta.categoryId,
    symbol: meta.symbol,
    access: meta.access,
    load,
  };
}

/** Hra podle přesného id; neznámé, prázdné i chybějící id nic nenajde. */
export function findGame(
  games: readonly GameEntry[],
  id: string | null | undefined,
): GameEntry | undefined {
  if (typeof id !== 'string' || id === '') {
    return undefined;
  }
  return games.find((game) => game.id === id);
}
