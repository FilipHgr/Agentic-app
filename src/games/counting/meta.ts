/// <reference types="vite/client" />
/**
 * Údaje o Počítání pro menu (#67): id, kategorie, symbol dlaždice, úroveň
 * přístupu (#74, zdarma) a název hry z textů jazyků. Menu je zná bez
 * stažení hry, proto tu nic jiného (scény, logika, Phaser) být nesmí.
 *
 * Obrázek dlaždice `tile.webp` (#122) se importuje jako adresa, menu ho
 * načte samo; bez dotazu (`?raw` a podobně), to hlídá test hranic.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import cs from './texts/cs';
import en from './texts/en';
import tile from './tile.webp';

export const COUNTING_META: GameMeta = {
  id: 'counting',
  categoryId: 'addingSubtracting',
  symbol: '2+3',
  access: 'free',
  titles: { cs: cs.title, en: en.title },
  tile,
};
