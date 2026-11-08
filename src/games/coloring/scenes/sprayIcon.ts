/**
 * Zástupný symbol spreje (#104) ve stylu A3: modrá plechovka vlevo dole
 * s tryskou a z ní šikmo nahoru obláček drobných teček ve vybrané barvě,
 * u trysky hustší, dál řidší. Bez textu. Kreslí se do úchytu a do místa
 * spreje v panelu.
 */

import type Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { SPRAY_STYLE } from '../logic/theme';

/** Plechovka: levý horní roh, šířka a výška jako díly velikosti symbolu. */
const CAN = { left: -0.38, top: -0.02, width: 0.3, height: 0.42 } as const;

/** Zaoblení rohů plechovky jako díl velikosti symbolu. */
const CAN_CORNER_SHARE = 0.06;

/** Tryska na plechovce: levý horní roh, šířka a výška jako díly velikosti symbolu. */
const NOZZLE = { left: -0.31, top: -0.14, width: 0.16, height: 0.1 } as const;

/** Tečky obláčku: střed a poloměr jako díly velikosti symbolu. */
const DOTS = [
  { x: -0.02, y: -0.12, radius: 0.045 },
  { x: 0.08, y: -0.2, radius: 0.04 },
  { x: 0.06, y: -0.04, radius: 0.04 },
  { x: 0.17, y: -0.11, radius: 0.04 },
  { x: 0.15, y: -0.3, radius: 0.035 },
  { x: 0.2, y: 0.03, radius: 0.035 },
  { x: 0.27, y: -0.22, radius: 0.035 },
  { x: 0.3, y: -0.04, radius: 0.03 },
  { x: 0.26, y: -0.37, radius: 0.03 },
  { x: 0.37, y: -0.15, radius: 0.03 },
  { x: 0.36, y: 0.08, radius: 0.025 },
  { x: 0.4, y: -0.32, radius: 0.025 },
] as const;

/** Sprej se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawSpray(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  graphics.fillStyle(colorNumber(SPRAY_STYLE.nozzleColor), 1);
  graphics.fillRect(
    x + NOZZLE.left * size,
    y + NOZZLE.top * size,
    NOZZLE.width * size,
    NOZZLE.height * size,
  );
  graphics.fillStyle(colorNumber(SPRAY_STYLE.canColor), 1);
  graphics.fillRoundedRect(
    x + CAN.left * size,
    y + CAN.top * size,
    CAN.width * size,
    CAN.height * size,
    CAN_CORNER_SHARE * size,
  );
  graphics.fillStyle(colorNumber(inkHex ?? SPRAY_STYLE.noColor), 1);
  for (const dot of DOTS) {
    graphics.fillCircle(x + dot.x * size, y + dot.y * size, dot.radius * size);
  }
}
