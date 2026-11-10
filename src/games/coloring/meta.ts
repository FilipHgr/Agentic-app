/**
 * Údaje o Omalovánkách pro menu (#88): id, kategorie Kreslení, symbol
 * dlaždice ✎ (znak bez emoji varianty), přístup zdarma a název hry
 * z textů jazyků. Menu je zná bez stažení hry, proto tu nic jiného
 * (scény, logika, Phaser) být nesmí.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import cs from './texts/cs';

export const COLORING_META: GameMeta = {
  id: 'coloring',
  categoryId: 'drawing',
  symbol: '✎',
  access: 'free',
  titles: { cs: cs.title },
};
