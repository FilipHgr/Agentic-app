/**
 * Zástupný symbol proužkového fixu (#102) ve stylu A3: kulatá stopa
 * ze šikmých plných proužků „/“ ve vybrané barvě, bez textu. Proužky
 * a mezery jsou mezi sebou stejně široké, okrajové úseče kruhu
 * jsou mezery, aby byly proužky vidět celé. Kreslí se do úchytu a do
 * místa proužkového fixu v panelu.
 */

import type Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { STRIPES_STYLE } from '../logic/theme';

/** Poloměr kulaté stopy jako díl velikosti symbolu. */
const STROKE_RADIUS_SHARE = 0.42;

/** Na kolik stejně širokých pásů (střídavě mezera a proužek) se kruh rozdělí. */
const BAND_COUNT = 9;

/** Kolik bodů má každý okraj proužku podél kruhu. */
const EDGE_POINTS = 6;

/**
 * Proužek mezi kolmými vzdálenostmi `from` a `to` od středu, uříznutý
 * kruhem poloměru `radius`. Souřadnice `along` jde podél proužku „/“
 * (doprava nahoru), `across` kolmo na něj (doprava dolů).
 */
function stripePoints(
  x: number,
  y: number,
  radius: number,
  from: number,
  to: number,
): Phaser.Types.Math.Vector2Like[] {
  const toPicture = (along: number, across: number): Phaser.Types.Math.Vector2Like => ({
    x: x + (along + across) / Math.SQRT2,
    y: y + (across - along) / Math.SQRT2,
  });
  const halfChord = (across: number): number =>
    Math.sqrt(Math.max(0, radius * radius - across * across));
  const right: Phaser.Types.Math.Vector2Like[] = [];
  const left: Phaser.Types.Math.Vector2Like[] = [];
  for (let step = 0; step <= EDGE_POINTS; step += 1) {
    const across = from + ((to - from) * step) / EDGE_POINTS;
    right.push(toPicture(halfChord(across), across));
    left.push(toPicture(-halfChord(across), across));
  }
  return [...right, ...left.reverse()];
}

/** Proužkový fix se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawStripes(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  graphics.fillStyle(colorNumber(inkHex ?? STRIPES_STYLE.noColor), 1);
  const radius = STROKE_RADIUS_SHARE * size;
  const band = (2 * radius) / BAND_COUNT;
  // Liché pásy jsou proužky, sudé (i oba okrajové) mezery.
  for (let index = 1; index < BAND_COUNT; index += 2) {
    const from = -radius + index * band;
    graphics.fillPoints(stripePoints(x, y, radius, from, from + band), true);
  }
}
