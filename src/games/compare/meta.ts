/// <reference types="vite/client" />
/**
 * Údaje o Porovnávání pro menu (#178): id, kategorie Čísla, symbol
 * dlaždice (znaky bez emoji varianty), přístup zdarma a název hry z textů
 * jazyků. Menu je zná bez stažení hry, proto tu nic jiného (scény,
 * logika, Phaser) být nesmí.
 *
 * Obrázek dlaždice `tile.webp` se importuje jako adresa, menu ho načte
 * samo; bez dotazu (`?raw` a podobně), to hlídá test hranic.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import cs from './texts/cs';
import en from './texts/en';
import tile from './tile.webp';

export const COMPARE_META: GameMeta = {
  id: 'compare',
  categoryId: 'numbers',
  symbol: '4☐2',
  access: 'free',
  titles: { cs: cs.title, en: en.title },
  tile,
};
