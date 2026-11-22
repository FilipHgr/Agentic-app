import Phaser from 'phaser';

import { colorNumber } from '../logic/theme';
import type { MapPlacePad, MapPlacePads, PlacePadKind, PlacePadLook } from '../logic/mapPlacePads';
import type { MapThemeId } from '../logic/progressMap';
import { MAP_PLACE_PAD_COLORS } from '../logic/mapTheme';

/**
 * Podložky zastávek na mapě postupu (#147): pod každým místem malá kresba
 * z jednoduchých tvarů (žádné obrázky navíc), nakreslená jednou do jedné
 * grafiky pod místy, takže mapu při chůzi značky nic nezpomalí. Okraj je
 * zvětšená silueta v barvě okraje pod výplní, aby obtáhl celý tvar
 * (i kořeny pařezu a řasu). Kruh místa leží uprostřed, proto jsou
 * podrobnosti (letokruh, zrnka, spára, krátery) v pruhu kolem něj.
 */

/** Tloušťka okraje podložky jako díl menší strany. */
const OUTLINE_SHARE = 0.035;

/** Kolik bodů má lístek řasy na každé straně. */
const LEAF_POINTS = 12;

/** Jak moc se lístek řasy vlní napříč, díl jeho šířky. */
const LEAF_WAVE = 0.35;

/** Barvy jedné podložky jako čísla pro Phaser. */
interface PadColors {
  readonly fill: number;
  readonly outline: number;
  readonly details: readonly number[];
}

type Painter = (graphics: Phaser.GameObjects.Graphics, pad: MapPlacePad, colors: PadColors) => void;

function detail(colors: PadColors, index: number): number {
  return colors.details[index] ?? colors.details[0] ?? colors.outline;
}

function outlineOf(pad: MapPlacePad): number {
  return Math.min(pad.width, pad.height) * OUTLINE_SHARE;
}

/**
 * Pařez: řez se středem ve středu místa, kolem kruhu místa souměrný
 * prstenec světlého dřeva s letokruhem; kůra a dva kořeny vykukují dole.
 */
const paintStump: Painter = (graphics, pad, colors) => {
  const line = outlineOf(pad);
  const { x, y, width, height } = pad;
  const faceRadius = height * 0.45;
  const skirtTop = y;
  const skirtBottom = y + height * 0.42;
  const bottomWidth = faceRadius * 2 * 0.9;
  const bottomHeight = height * 0.16;
  const rootX = width * 0.34;
  const rootY = y + height * 0.42;
  const rootWidth = width * 0.3;
  const rootHeight = height * 0.14;
  // Silueta celého pařezu v barvě okraje, o okraj větší.
  graphics.fillStyle(colors.outline);
  graphics.fillEllipse(x - rootX, rootY, rootWidth + 2 * line, rootHeight + 2 * line);
  graphics.fillEllipse(x + rootX, rootY, rootWidth + 2 * line, rootHeight + 2 * line);
  graphics.fillRect(
    x - bottomWidth / 2 - line,
    skirtTop,
    bottomWidth + 2 * line,
    skirtBottom - skirtTop,
  );
  graphics.fillEllipse(x, skirtBottom, bottomWidth + 2 * line, bottomHeight + 2 * line);
  graphics.fillCircle(x, y, faceRadius + line);
  // Kůra a kořeny.
  graphics.fillStyle(detail(colors, 1));
  graphics.fillEllipse(x - rootX, rootY, rootWidth, rootHeight);
  graphics.fillEllipse(x + rootX, rootY, rootWidth, rootHeight);
  graphics.fillRect(x - bottomWidth / 2, skirtTop, bottomWidth, skirtBottom - skirtTop);
  graphics.fillEllipse(x, skirtBottom, bottomWidth, bottomHeight);
  // Řez: okraj, světlé dřevo a letokruh těsně vně kruhu místa.
  graphics.fillStyle(colors.outline);
  graphics.fillCircle(x, y, faceRadius);
  graphics.fillStyle(colors.fill);
  graphics.fillCircle(x, y, faceRadius - line);
  graphics.lineStyle(line * 0.7, detail(colors, 0));
  graphics.strokeCircle(x, y, faceRadius - line * 1.9);
};

/**
 * Písečný kopeček: široký nízký kopec s vrškem nad místem a pár kamínky
 * po stranách, které vyčnívají mimo kruh místa.
 */
const paintSandMound: Painter = (graphics, pad, colors) => {
  const line = outlineOf(pad);
  const { x, y, width, height } = pad;
  const baseY = y + height * 0.12;
  const baseHeight = height * 0.76;
  const topY = y - height * 0.2;
  const topWidth = width * 0.64;
  const topHeight = height * 0.6;
  const pebbles = [
    [-0.4, 0.3, 0.13],
    [-0.3, 0.4, 0.09],
    [0.38, 0.33, 0.11],
  ] as const;
  graphics.fillStyle(colors.outline);
  graphics.fillEllipse(x, baseY, width, baseHeight);
  graphics.fillEllipse(x, topY, topWidth, topHeight);
  graphics.fillStyle(colors.fill);
  graphics.fillEllipse(x, baseY, width - 2 * line, baseHeight - 2 * line);
  graphics.fillEllipse(x, topY, topWidth - 2 * line, topHeight - 2 * line);
  // Zrnka na vršku a na bocích.
  graphics.fillStyle(detail(colors, 0));
  for (const [dx, dy] of [
    [-0.42, 0.08],
    [0.43, 0.12],
    [-0.12, -0.42],
    [0.14, -0.4],
  ] as const) {
    graphics.fillCircle(x + dx * width, y + dy * height, line * 0.8);
  }
  // Kamínky s okrajem.
  for (const [dx, dy, size] of pebbles) {
    const px = x + dx * width;
    const py = y + dy * height;
    graphics.fillStyle(colors.outline);
    graphics.fillEllipse(
      px,
      py,
      width * size + 2 * line * 0.7,
      width * size * 0.7 + 2 * line * 0.7,
    );
    graphics.fillStyle(detail(colors, 1));
    graphics.fillEllipse(px, py, width * size, width * size * 0.7);
  }
};

/** Kamenná dlaždice: zaoblený čtverec se spárou kolem dokola (vidět v rozích). */
const paintStoneTile: Painter = (graphics, pad, colors) => {
  const line = outlineOf(pad);
  const left = pad.x - pad.width / 2;
  const top = pad.y - pad.height / 2;
  const corner = Math.min(pad.width, pad.height) * 0.14;
  graphics.fillStyle(colors.outline);
  graphics.fillRoundedRect(left, top, pad.width, pad.height, corner);
  graphics.fillStyle(colors.fill);
  graphics.fillRoundedRect(
    left + line,
    top + line,
    pad.width - 2 * line,
    pad.height - 2 * line,
    Math.max(corner - line, 0),
  );
  const inset = line * 2.6;
  graphics.lineStyle(line * 0.6, detail(colors, 0));
  graphics.strokeRoundedRect(
    left + inset,
    top + inset,
    pad.width - 2 * inset,
    pad.height - 2 * inset,
    Math.max(corner - inset, 0),
  );
};

/** Vlnitý lístek řasy od `base` ke špičce `tip`, nejširší `width` uprostřed. */
function leafPoints(
  base: Phaser.Math.Vector2,
  tip: Phaser.Math.Vector2,
  width: number,
): Phaser.Math.Vector2[] {
  const along = tip.clone().subtract(base);
  const across = new Phaser.Math.Vector2(-along.y, along.x).normalize();
  const side = (sign: number): Phaser.Math.Vector2[] =>
    Array.from({ length: LEAF_POINTS + 1 }, (_, index) => {
      const share = index / LEAF_POINTS;
      const wave = Math.sin(Math.PI * 2 * share) * width * LEAF_WAVE;
      const bulge = Math.sin(Math.PI * share) * (width / 2) * sign;
      return base
        .clone()
        .add(along.clone().scale(share))
        .add(across.clone().scale(bulge + wave));
    });
  return [...side(1), ...side(-1).reverse()];
}

/** Kámen s řasou: oblý kámen, za ním vlnité lístky řasy, které vykukují nahoře a po stranách. */
const paintSeaweedRock: Painter = (graphics, pad, colors) => {
  const line = outlineOf(pad);
  const { x, y, width, height } = pad;
  const rockX = x + width * 0.04;
  const rockY = y + height * 0.06;
  const rockWidth = width * 0.9;
  const rockHeight = height * 0.86;
  const leafWidth = width * 0.13;
  const leaves = [
    [-0.3, 0.15, -0.4, -0.47],
    [-0.12, -0.1, -0.2, -0.48],
    [0.3, -0.05, 0.4, -0.45],
  ].map(([baseX = 0, baseY = 0, tipX = 0, tipY = 0]) => ({
    base: new Phaser.Math.Vector2(x + baseX * width, y + baseY * height),
    tip: new Phaser.Math.Vector2(x + tipX * width, y + tipY * height),
  }));
  graphics.fillStyle(colors.outline);
  for (const { base, tip } of leaves) {
    // Silueta lístku pro okraj: o okraj širší a delší.
    const longer = tip.clone().subtract(base).normalize().scale(line);
    graphics.fillPoints(leafPoints(base, tip.clone().add(longer), leafWidth + 2 * line), true);
  }
  graphics.fillEllipse(rockX, rockY, rockWidth, rockHeight);
  graphics.fillStyle(detail(colors, 0));
  for (const { base, tip } of leaves) {
    graphics.fillPoints(leafPoints(base, tip, leafWidth), true);
  }
  graphics.fillStyle(colors.fill);
  graphics.fillEllipse(rockX, rockY, rockWidth - 2 * line, rockHeight - 2 * line);
  graphics.fillStyle(detail(colors, 1));
  graphics.fillEllipse(rockX - rockWidth * 0.36, rockY + rockHeight * 0.18, line * 3, line * 2);
  graphics.fillEllipse(rockX + rockWidth * 0.37, rockY + rockHeight * 0.2, line * 2.4, line * 1.6);
};

/**
 * Planetka: kulatá s velkými krátery a s prstencem přes celou šířku, který
 * vyčnívá vlevo a vpravo (pod kruhem místa je schovaný).
 */
const paintPlanetoid: Painter = (graphics, pad, colors) => {
  const line = outlineOf(pad);
  const { x, y, width, height } = pad;
  const radius = Math.min(width, height) * 0.4;
  const ringHeight = height * 0.4;
  const ringLine = line * 2.2;
  // Prstenec: okraj a pod ním barevný pás, přes celou šířku podložky.
  graphics.lineStyle(ringLine + 2 * line, colors.outline);
  graphics.strokeEllipse(x, y, width - ringLine - 2 * line, ringHeight);
  graphics.lineStyle(ringLine, detail(colors, 1));
  graphics.strokeEllipse(x, y, width - ringLine - 2 * line, ringHeight);
  graphics.fillStyle(colors.outline);
  graphics.fillCircle(x, y, radius);
  graphics.fillStyle(colors.fill);
  graphics.fillCircle(x, y, radius - line);
  graphics.fillStyle(detail(colors, 0));
  for (const [angle, size] of [
    [-55, 1.5],
    [-130, 1.2],
    [125, 1.4],
    [55, 1.1],
  ] as const) {
    const radians = (angle * Math.PI) / 180;
    // Krátery leží v pruhu mezi kruhem místa a okrajem planetky.
    const distance = radius - line * 1.2;
    graphics.fillCircle(
      x + Math.cos(radians) * distance,
      y + Math.sin(radians) * distance,
      line * size,
    );
  }
};

const PAINTERS: Readonly<Record<PlacePadKind, Painter>> = {
  stump: paintStump,
  sandMound: paintSandMound,
  stoneTile: paintStoneTile,
  seaweedRock: paintSeaweedRock,
  planetoid: paintPlanetoid,
};

/** Nakreslí podložky všech míst mapy do jedné grafiky (kreslí se jen jednou). */
export function drawPlacePads(
  scene: Phaser.Scene,
  theme: MapThemeId,
  pads: MapPlacePads,
  look: PlacePadLook,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const colors: PadColors = {
    fill: colorNumber(look.fillColor),
    outline: colorNumber(look.outlineColor),
    details: MAP_PLACE_PAD_COLORS[theme].details.map(colorNumber),
  };
  const paint = PAINTERS[pads.kind];
  for (const pad of pads.pads) {
    paint(graphics, pad, colors);
  }
  return graphics;
}
