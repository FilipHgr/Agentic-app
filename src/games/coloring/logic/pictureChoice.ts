/**
 * Výběr omalovánky ze sady (#124), čistá logika bez Phaseru. Výběr dostane
 * sadu zvenku a drží, co je vidět: výběr, otevírání omalovánky, nebo
 * malování. Scéna jen kreslí a hlásí ťuknutí, zobrazení malování
 * a podržení domečku.
 *
 * - Při 2 a více omalovánkách začíná výběr, při jediné se otevře rovnou
 *   malování a domeček vede do menu.
 * - Ťuknutí na náhled otevře omalovánku jen na výběru: druhý prst nebo
 *   dvojí ťuknutí během otevírání nic neotevře (AC5).
 * - Domeček v malování vede na výběr, na výběru do menu (AC4). Podržení se
 *   počítá až od chvíle, kdy je malování vidět (AC5): podržení dokončené
 *   během otevírání nebo dřív než za 1 s po zobrazení malování začalo
 *   ještě před ním a nepočítá se.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { HomeHoldDecision } from '../../../shared/logic/gameHost';
import { HOLD_TO_GO_HOME_MS } from '../../../shared/logic/homeButton';
import type { PictureIdentity } from './savedPicture';

/** Co je vidět: výběr, otevírání omalovánky, nebo malování. */
export type ColoringScreen =
  | { readonly kind: 'picker' }
  | { readonly kind: 'opening'; readonly picture: PictureIdentity }
  | { readonly kind: 'painting'; readonly picture: PictureIdentity };

/** Co udělá ťuknutí na náhled: otevře omalovánku s tónem, nebo nic. */
export type PreviewTap =
  | {
      readonly kind: 'open';
      readonly index: number;
      readonly picture: PictureIdentity;
      readonly tones: readonly Tone[];
    }
  | { readonly kind: 'ignored' };

/** Kam vede podržení domečku: na výběr, do menu, nebo nikam. */
export type HomeHold = 'toPicker' | 'toMenu' | 'ignored';

/** Tón ťuknutí na náhled: krátký vzestupný dvojtón. */
export const PREVIEW_TAP_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.09, volume: 0.13 },
  { frequencyHz: 880, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.13 },
];

export interface PictureChoice {
  /** Omalovánky na výběru v pořadí náhledů; při jediné omalovánce žádné. */
  previews(): readonly PictureIdentity[];
  screen(): ColoringScreen;
  /** Ťuknutí na náhled `index`. */
  tapPreview(index: number): PreviewTap;
  /** Scéna ukázala malování otevírané omalovánky. */
  paintingShown(): void;
  /** Domeček se držel 1 s. */
  holdHome(): HomeHold;
}

export interface PictureChoiceOptions {
  /** Hodiny v ms (v testech zkušební). */
  readonly now?: () => number;
}

/** Co má stránka udělat po podržení domečku: do menu odejít, jinak zůstat ve hře. */
export function homeHoldDecision(hold: HomeHold): HomeHoldDecision {
  return hold === 'toMenu' ? 'leave' : 'stay';
}

/** Výběr nad sadou `pictures`. */
export function startPictureChoice(
  pictures: readonly PictureIdentity[],
  options: PictureChoiceOptions = {},
): PictureChoice {
  const now = options.now ?? (() => Date.now());
  const onlyPicture = pictures.length === 1 ? pictures[0] : undefined;
  let screen: ColoringScreen =
    onlyPicture === undefined ? { kind: 'picker' } : { kind: 'opening', picture: onlyPicture };
  let paintingShownAt = Number.NEGATIVE_INFINITY;

  /** Začalo podržení až ve chvíli, kdy bylo malování vidět? */
  const heldSincePaintingShown = (): boolean => now() - paintingShownAt >= HOLD_TO_GO_HOME_MS;

  return {
    previews: () => (onlyPicture === undefined ? pictures : []),
    screen: () => screen,
    tapPreview: (index) => {
      const picture = Number.isInteger(index) ? pictures[index] : undefined;
      if (screen.kind !== 'picker' || picture === undefined) {
        return { kind: 'ignored' };
      }
      screen = { kind: 'opening', picture };
      return { kind: 'open', index, picture, tones: PREVIEW_TAP_TONES };
    },
    paintingShown: () => {
      if (screen.kind !== 'opening') {
        return;
      }
      screen = { kind: 'painting', picture: screen.picture };
      paintingShownAt = now();
    },
    holdHome: () => {
      switch (screen.kind) {
        case 'picker':
          return 'toMenu';
        case 'opening':
          return 'ignored';
        case 'painting':
          if (!heldSincePaintingShown()) {
            return 'ignored';
          }
          if (onlyPicture !== undefined) {
            return 'toMenu';
          }
          screen = { kind: 'picker' };
          return 'toPicker';
      }
    },
  };
}
