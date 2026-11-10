/**
 * Sada omalovánek (#124): seznam označení omalovánek v pořadí náhledů na
 * výběru. Při změně obrysu omalovánky se zvýší její verze (#92). Obrysy
 * k označením přiřadí scéna (`scenes/pictureCanvas.ts`). Při jediné
 * omalovánce v sadě se výběr přeskočí a hra se otevře rovnou v malování.
 * Kruhy a hvězda jsou zástupné omalovánky do příchodu skutečných obrázků.
 * Čistý TypeScript bez Phaseru.
 */

import type { PictureIdentity } from './savedPicture';

export const COLORING_PICTURES: readonly PictureIdentity[] = [
  // Domek má dál dnešní označení, aby se dnešní uložené obrázky otevřely (#124 AC2).
  { id: 'house', version: 1 },
  { id: 'circles', version: 1 },
  { id: 'star', version: 1 },
];
