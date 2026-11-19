/**
 * Sada omalovánek (#124): seznam označení omalovánek v pořadí náhledů na
 * výběru. Při změně obrysu omalovánky se zvýší její verze (#92). Obrysy
 * k označením přiřadí scéna (`scenes/pictureCanvas.ts`). Při jediné
 * omalovánce v sadě se výběr přeskočí a hra se otevře rovnou v malování.
 * Od #128 jsou v sadě skutečné omalovánky; zástupné kruhy a hvězda zmizely
 * (jejich uložené obrázky zůstanou v úložišti, jen se nikde neukážou).
 * Od #151 je na 1. místě prázdný papír na volné kreslení (`blankPaper.ts`).
 * Čistý TypeScript bez Phaseru.
 */

import { BLANK_PAPER } from './blankPaper';
import type { PictureIdentity } from './savedPicture';

export const COLORING_PICTURES: readonly PictureIdentity[] = [
  BLANK_PAPER,
  // Domek má dál dnešní označení, aby se dnešní uložené obrázky otevřely (#124 AC2).
  { id: 'house', version: 1 },
  { id: 'cat', version: 1 },
  { id: 'dog', version: 1 },
  { id: 'car', version: 1 },
  { id: 'butterfly', version: 1 },
  { id: 'fish', version: 1 },
  { id: 'sea', version: 1 },
  { id: 'mermaid', version: 1 },
  { id: 'rainbow', version: 1 },
  { id: 'ornament', version: 1 },
  { id: 'unicorn', version: 1 },
  { id: 'dinosaur', version: 1 },
  { id: 'rocket', version: 1 },
  { id: 'tractor', version: 1 },
  { id: 'castle', version: 1 },
  { id: 'owl', version: 1 },
];
