/**
 * Domeček ve hře (#68) je tlačítko stránky vlevo nahoře, zrcadlově ke
 * kolečku nastavení. Podržením 1 s se dítě vrátí do menu, během držení se
 * kolem domečku plní kroužek (CSS třída `is-holding` v index.html).
 * Ťuknutí domeček jen zhoupne. Logika podržení je v
 * `src/shared/logic/holdButton.ts`, tady se jen napojí na prvek stránky.
 */

import { sharedToneContext } from '../audio/sharedAudio';
import { createTonePlayer } from '../audio/tonePlayer';
import { createHoldButton } from '../logic/holdButton';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../logic/homeButton';
import type { HomeButton } from '../logic/homeButton';

const VIEWBOX_SIZE = 64;
const VIEWBOX_CENTER = VIEWBOX_SIZE / 2;

/** Velikost a poloha domečku podle okna (hodnoty počítá `homeButtonFor`). */
export function applyHomeButton(button: HTMLElement, home: HomeButton): void {
  const style = button.style;
  style.top = `${home.top}px`;
  style.left = `${home.left}px`;
  style.width = `${home.hitSize}px`;
  style.height = `${home.hitSize}px`;

  // Plocha pro prst je celé SVG; kreslený domeček se zmenší do jejího středu.
  const unitsPerPx = VIEWBOX_SIZE / home.hitSize;
  const scale = home.iconSize / home.hitSize;
  button
    .querySelector('.home-art')
    ?.setAttribute(
      'transform',
      `translate(${VIEWBOX_CENTER} ${VIEWBOX_CENTER}) scale(${scale}) translate(${-VIEWBOX_CENTER} ${-VIEWBOX_CENTER})`,
    );

  const ring = button.querySelector('.progress');
  const radius = (home.ringDiameter / 2) * unitsPerPx;
  ring?.setAttribute('r', String(radius));
  ring?.setAttribute('stroke-width', String(home.ringStrokeWidth * unitsPerPx));
  style.setProperty('--ring-length', String(2 * Math.PI * radius));
}

export interface HomeButtonOptions {
  /** Jde teď domečkem odejít (ne při otevřeném nastavení nebo průvodci)? */
  readonly isEnabled: () => boolean;
  /** Domeček se držel 1 s: dítě se vrací do menu, nebo o úroveň výš ve hře (#124). */
  readonly onGoHome: () => void;
  /** Kroužek kolem domečku se začal plnit (`true`), nebo zmizel (`false`) (#129). */
  readonly onHoldingChange?: (holding: boolean) => void;
}

/** Je bod prstu mimo domeček? */
function isOutside(button: HTMLElement, event: PointerEvent): boolean {
  const rect = button.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/** Zhoupnutí domečku po ťuknutí (jako zhoupnutí v menu). */
const WOBBLE_KEYFRAMES: Keyframe[] = [
  { transform: 'rotate(0deg)' },
  { transform: 'rotate(-10deg)' },
  { transform: 'rotate(10deg)' },
  { transform: 'rotate(0deg)' },
];
const WOBBLE_MS = 360;

function wobble(button: HTMLElement): void {
  button.querySelector('svg')?.animate(WOBBLE_KEYFRAMES, {
    duration: WOBBLE_MS,
    easing: 'ease-in-out',
  });
}

/** Napojí domeček na odchod do menu. Vrátí odpojení (po odchodu z hry). */
export function attachHomeButton(button: HTMLElement, options: HomeButtonOptions): () => void {
  const sounds = createTonePlayer(sharedToneContext);
  const hold = createHoldButton({
    holdMs: HOLD_TO_GO_HOME_MS,
    isEnabled: options.isEnabled,
    onHoldComplete: options.onGoHome,
    onTap: () => {
      wobble(button);
      sounds.play(HOME_WOBBLE_TONES);
    },
    onHoldingChange: (holding) => {
      button.classList.toggle('is-holding', holding);
      options.onHoldingChange?.(holding);
    },
  });

  const onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    hold.press(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent): void => hold.release(event.pointerId);
  const onPointerCancel = (event: PointerEvent): void => hold.cancel(event.pointerId);
  const onPointerLeave = (event: PointerEvent): void => hold.leave(event.pointerId);
  // Dotyk prohlížeč často „přichytí“ k tlačítku, proto se sjetí pozná i podle polohy prstu.
  const onPointerMove = (event: PointerEvent): void => {
    if (isOutside(button, event)) {
      hold.leave(event.pointerId);
    }
  };
  // Chrome na Androidu by při dlouhém podržení otevřel vlastní nabídku.
  const onContextMenu = (event: Event): void => event.preventDefault();

  const listeners: Array<[string, EventListener]> = [
    ['pointerdown', onPointerDown as EventListener],
    ['pointerup', onPointerUp as EventListener],
    ['pointercancel', onPointerCancel as EventListener],
    ['pointerleave', onPointerLeave as EventListener],
    ['pointermove', onPointerMove as EventListener],
    ['contextmenu', onContextMenu],
  ];
  for (const [type, listener] of listeners) {
    button.addEventListener(type, listener);
  }

  return () => {
    hold.dispose();
    for (const [type, listener] of listeners) {
      button.removeEventListener(type, listener);
    }
    button.classList.remove('is-holding');
  };
}
