/**
 * Velikost a poloha kolečka nastavení podle okna (#55). Hodnoty počítá
 * `settingsGearFor` v `src/logic/deviceLayout.ts`, tady se jen promítnou
 * do tlačítka stránky. SVG má pevný viewBox 64 × 64.
 */

import type { SettingsGear } from '../logic/deviceLayout';

const VIEWBOX_SIZE = 64;
const VIEWBOX_CENTER = VIEWBOX_SIZE / 2;

export function applySettingsGear(button: HTMLElement, gear: SettingsGear): void {
  const style = button.style;
  style.top = `${gear.top}px`;
  style.right = `${gear.right}px`;
  style.width = `${gear.hitSize}px`;
  style.height = `${gear.hitSize}px`;

  // Plocha pro prst je celé SVG; kreslené kolečko se zmenší do jejího středu.
  const unitsPerPx = VIEWBOX_SIZE / gear.hitSize;
  const art = button.querySelector('.gear-art');
  const scale = gear.gearSize / gear.hitSize;
  art?.setAttribute(
    'transform',
    `translate(${VIEWBOX_CENTER} ${VIEWBOX_CENTER}) scale(${scale}) translate(${-VIEWBOX_CENTER} ${-VIEWBOX_CENTER})`,
  );

  const ring = button.querySelector('.progress');
  const radius = (gear.ringDiameter / 2) * unitsPerPx;
  ring?.setAttribute('r', String(radius));
  ring?.setAttribute('stroke-width', String(gear.ringStrokeWidth * unitsPerPx));
  style.setProperty('--ring-length', String(2 * Math.PI * radius));
}
