/// <reference types="vite/client" />
/**
 * Údaje o Počítání pro menu (#67): id, kategorie, symbol dlaždice, úroveň
 * přístupu (#74, zdarma) a název hry z textů jazyků. Menu je zná bez
 * stažení hry, proto tu nic jiného (scény, logika, Phaser) být nesmí.
 *
 * Přehled pro rodiče (#192) je jen popis záznamů jako data, menu podle
 * něj čte záznamy Počítání bez kódu hry.
 *
 * Obrázek dlaždice `tile.webp` (#122) se importuje jako adresa, menu ho
 * načte samo; bez dotazu (`?raw` a podobně), to hlídá test hranic.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import type { GameOverviewSpec } from '../../shared/logic/overviewProblems';
import cs from './texts/cs';
import en from './texts/en';
import tile from './tile.webp';

/** Přehled pro rodiče v menu (#192): co hra zapisuje; hra ho používá i sama při zápisu. */
export const COUNTING_OVERVIEW: GameOverviewSpec = {
  // Nejvyšší rozsah nastavení (do 20).
  maxNumber: 20,
  problemForms: ['equation'],
  operations: ['plus', 'minus'],
  hints: true,
};

export const COUNTING_META: GameMeta = {
  id: 'counting',
  categoryId: 'addingSubtracting',
  symbol: '2+3',
  access: 'free',
  titles: { cs: cs.title, en: en.title },
  tile,
  overview: COUNTING_OVERVIEW,
};
