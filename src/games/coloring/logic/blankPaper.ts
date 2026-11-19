/**
 * Prázdný papír na volné kreslení (#151). Papír je v sadě omalovánek na
 * 1. místě a pro výběr, malování, ukládání i album je to omalovánka jako
 * ostatní. Jen nemá obrys: celá plocha vrstvy barev je jedna oblast, takže
 * tah barví všude a ořez tahu do oblasti, kde začal, nic neubere.
 * Papír není nikdy zamčený (`pictureLocks.ts`).
 * Čistý TypeScript bez Phaseru.
 */

import type { RegionMap } from './regionMap';
import type { PictureIdentity } from './savedPicture';

/** Označení papíru v sadě (#151 Upřesnění 3). */
export const BLANK_PAPER: PictureIdentity = { id: 'paper', version: 1 };

/** Rozměr papíru: stejný jako vrstva barev malování (naležato, #127). */
const PAPER_WIDTH = 1024;
const PAPER_HEIGHT = 768;

/** Číslo jediné oblasti papíru (oblasti se číslují od 1, obrys má 0). */
const PAPER_REGION = 1;

/** Je omalovánka prázdný papír? */
export function isBlankPaper(picture: PictureIdentity): boolean {
  return picture.id === BLANK_PAPER.id;
}

/** Mapa oblastí papíru: celá plocha 1024 × 768 je jedna oblast, žádný pixel obrysu. */
export function blankPaperRegions(): RegionMap {
  const regionIds = new Int32Array(PAPER_WIDTH * PAPER_HEIGHT).fill(PAPER_REGION);
  return { width: PAPER_WIDTH, height: PAPER_HEIGHT, regionCount: 1, regionIds };
}
