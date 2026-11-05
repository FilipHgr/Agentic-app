/**
 * Údaje o Počítání pro menu (#67): id, kategorie, symbol dlaždice a název
 * hry z textů jazyků. Menu je zná bez stažení hry, proto tu nic jiného
 * (scény, logika, Phaser) být nesmí.
 */

import type { GameMeta } from '../../shared/logic/gameRegistry';
import cs from './texts/cs';

export const COUNTING_META: GameMeta = {
  id: 'counting',
  categoryId: 'addingSubtracting',
  symbol: '2+3',
  titles: { cs: cs.title },
};
