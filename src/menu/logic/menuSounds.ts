/**
 * Zvuky menu (#67): zmáčknutí dlaždice, tiché zhoupnutí a zatřesení po
 * selhání (stejně tiché a hluboké jako špatná odpověď v Počítání).
 * Čistý TypeScript bez Phaseru a bez Web Audio. Který tón k odezvě menu
 * zazní, říká `menuSoundFor`.
 */

import type { Tone } from '../../shared/audio/tonePlayer';
import type { MenuFeedback } from './menu';

export type MenuSoundName = 'press' | 'select' | 'wobble' | 'shake';

export const MENU_SOUNDS: Readonly<Record<MenuSoundName, readonly Tone[]>> = {
  /** Krátké veselé „ťuk“ o dvou tónech. */
  press: [
    { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.25 },
    { frequencyHz: 880, startSeconds: 0.06, durationSeconds: 0.1, volume: 0.25 },
  ],
  /** Tichý krátký tón po výběru nové kategorie. */
  select: [{ frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.07, volume: 0.12 }],
  /** Tichý krátký tón, nic se nestalo. */
  wobble: [{ frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.12 }],
  /** Jeden krátký, tichý a hluboký tón, žádný bzučák. */
  shake: [{ frequencyHz: 220, startSeconds: 0, durationSeconds: 0.18, volume: 0.2 }],
};

/**
 * Tón, který scéna menu k odezvě zahraje, nebo `undefined` bez tónu.
 * Otevření a zavření nabídky jazyků (#70) i seznamu kategorií (#95) má
 * stejný tichý tón jako výběr kategorie; tiché zavření seznamu (po výběru
 * v něm nebo po otočení) tón nemá, zazní jen tón výběru.
 */
export function menuSoundFor(event: MenuFeedback): MenuSoundName | undefined {
  switch (event.kind) {
    case 'press':
    case 'profilePress':
      return 'press';
    case 'shake':
      return 'shake';
    case 'select':
    case 'languageMenu':
      return 'select';
    case 'categoryMenu':
      return event.quiet ? undefined : 'select';
    case 'wobble':
      return 'wobble';
    case 'pulse':
    case 'stopPulse':
    case 'language':
      return undefined;
  }
}
