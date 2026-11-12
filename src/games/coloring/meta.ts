/// <reference types="vite/client" />
/**
 * Údaje o Omalovánkách pro menu (#88): id, kategorie Kreslení, symbol
 * dlaždice ✎ (znak bez emoji varianty), přístup zdarma a název hry
 * z textů jazyků. Menu je zná bez stažení hry, proto tu nic jiného
 * (scény, logika, Phaser) být nesmí.
 *
 * Obrázek dlaždice `tile.webp` (#122) se importuje jako adresa, menu ho
 * načte samo; bez dotazu (`?raw` a podobně), to hlídá test hranic.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import cs from './texts/cs';
import en from './texts/en';
import tile from './tile.webp';

export const COLORING_META: GameMeta = {
  id: 'coloring',
  categoryId: 'drawing',
  symbol: '✎',
  access: 'free',
  titles: { cs: cs.title, en: en.title },
  tile,
};
