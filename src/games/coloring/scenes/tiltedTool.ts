/**
 * Body šikmého nástroje pro zástupné symboly fixu a pastelky (#93):
 * nástroj leží úhlopříčně, hrot vlevo dole a konec vpravo nahoře.
 */

import Phaser from 'phaser';

/** Nástroj je skloněný o tento úhel. */
const TILT_RADIANS = -Math.PI / 4;

export interface TiltedTool {
  /** Bod `along` od hrotu (0) ke konci (1), `across` napříč v dílech velikosti. */
  point(along: number, across: number): Phaser.Math.Vector2;
  /** Obdélník těla od `from` do `to` a tloušťky `thickness` (díl velikosti). */
  band(from: number, to: number, thickness: number): Phaser.Math.Vector2[];
}

/** Šikmý nástroj se středem `x`, `y`, délky `length` (díl `size`) v čtverci strany `size`. */
export function tiltedTool(x: number, y: number, size: number, length: number): TiltedTool {
  const point = (along: number, across: number): Phaser.Math.Vector2 => {
    const localX = (along - 0.5) * length * size;
    const localY = across * size;
    return new Phaser.Math.Vector2(
      x + localX * Math.cos(TILT_RADIANS) - localY * Math.sin(TILT_RADIANS),
      y + localX * Math.sin(TILT_RADIANS) + localY * Math.cos(TILT_RADIANS),
    );
  };
  const band = (from: number, to: number, thickness: number): Phaser.Math.Vector2[] => [
    point(from, -thickness / 2),
    point(to, -thickness / 2),
    point(to, thickness / 2),
    point(from, thickness / 2),
  ];
  return { point, band };
}
