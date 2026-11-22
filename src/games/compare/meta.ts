/// <reference types="vite/client" />
/**
 * Údaje o hře Znaménka (do #190 Porovnávání) pro menu (#178): id, kategorie Čísla, symbol
 * dlaždice (znaky bez emoji varianty), přístup zdarma a název hry z textů
 * jazyků. Menu je zná bez stažení hry, proto tu nic jiného (scény,
 * logika, Phaser) být nesmí.
 *
 * Přehled pro rodiče (#192) je jen popis záznamů jako data, menu podle
 * něj čte záznamy Znamének bez kódu hry.
 *
 * Obrázek dlaždice `tile.webp` se importuje jako adresa, menu ho načte
 * samo; bez dotazu (`?raw` a podobně), to hlídá test hranic.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import type { GameOverviewSpec } from '../../shared/logic/overviewProblems';
import cs from './texts/cs';
import en from './texts/en';
import tile from './tile.webp';

/** Přehled pro rodiče v menu (#192): co hra zapisuje; hra ho používá i sama při zápisu. */
export const COMPARE_OVERVIEW: GameOverviewSpec = {
  // Nejvyšší rozsah nastavení (do 20).
  maxNumber: 20,
  problemForms: ['missingSign', 'comparison'],
  operations: [],
  hints: false,
};

export const COMPARE_META: GameMeta = {
  id: 'compare',
  categoryId: 'numbers',
  symbol: '4☐2',
  access: 'free',
  titles: { cs: cs.title, en: en.title },
  tile,
  overview: COMPARE_OVERVIEW,
};
