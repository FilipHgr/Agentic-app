import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { sceneryPoseAt, scenerySizeOf } from '../logic/mapScenery';
import type { MapScenery, SceneryKind, SceneryPiece } from '../logic/mapScenery';
import { MAP_SCENERY_COLORS } from '../logic/theme';

/**
 * Kousky prostředí na mapě postupu (#136): každý kousek je jedna malá
 * kresba z jednoduchých tvarů (žádné obrázky navíc), nakreslená jednou
 * kolem svého středu. Každý snímek se jí jen nastaví poloha, natočení,
 * zvětšení a průhlednost podle `sceneryPoseAt`, aby mapa běžela v 60 fps.
 * Kousky nemají ťukací plochu (otázka 1 v #136).
 */

const SCENERY = {
  wave: colorNumber(MAP_SCENERY_COLORS.wave),
  gull: colorNumber(MAP_SCENERY_COLORS.gull),
  leaves: MAP_SCENERY_COLORS.leaves.map(colorNumber),
  leafVein: colorNumber(MAP_SCENERY_COLORS.leafVein),
  butterflyWings: MAP_SCENERY_COLORS.butterflyWings.map(colorNumber),
  butterflySpots: colorNumber(MAP_SCENERY_COLORS.butterflySpots),
  butterflyBody: colorNumber(MAP_SCENERY_COLORS.butterflyBody),
  flagPole: colorNumber(MAP_SCENERY_COLORS.flagPole),
  flagCloths: MAP_SCENERY_COLORS.flagCloths.map(colorNumber),
  cloud: colorNumber(MAP_SCENERY_COLORS.cloud),
  bubble: colorNumber(MAP_SCENERY_COLORS.bubble),
  fish: MAP_SCENERY_COLORS.fish.map(colorNumber),
  fishFin: colorNumber(MAP_SCENERY_COLORS.fishFin),
  fishEye: colorNumber(MAP_SCENERY_COLORS.fishEye),
  stars: MAP_SCENERY_COLORS.stars.map(colorNumber),
  cometHead: colorNumber(MAP_SCENERY_COLORS.cometHead),
  cometTail: colorNumber(MAP_SCENERY_COLORS.cometTail),
};

/** Barva z řady podle pořadí kousku. */
function pick(colors: readonly number[], index: number): number {
  return colors[index % colors.length] ?? colors[0] ?? SCENERY.wave;
}

/** Tloušťka čáry vlnky a racka jako díl výšky kousku. */
const LINE_SHARE = 0.25;

/** Kolik bodů má křivka vlny nebo křídla (dost hustě, aby čára byla hladká). */
const CURVE_POINTS = 48;

type Painter = (
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  index: number,
) => void;

function curve(
  count: number,
  point: (share: number) => Phaser.Math.Vector2,
): Phaser.Math.Vector2[] {
  return Array.from({ length: count + 1 }, (_, step) => point(step / count));
}

/**
 * Hladká čára s kulatými konci i spoji: úseky a v každém bodě kolečko
 * o průměru čáry, takže nikde nejsou zubaté rohy.
 */
function roundLine(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Phaser.Math.Vector2[],
  width: number,
  color: number,
): void {
  graphics.lineStyle(width, color, 1);
  graphics.fillStyle(color, 1);
  points.forEach((point, index) => {
    const next = points[index + 1];
    if (next) {
      graphics.lineBetween(point.x, point.y, next.x, next.y);
    }
    graphics.fillCircle(point.x, point.y, width / 2);
  });
}

/** Bílá vlnka „~“: jeden měkký hřebínek a jedno údolíčko. */
const paintWave: Painter = (graphics, width, height) => {
  const line = height * LINE_SHARE;
  const reachX = width / 2 - line / 2;
  const reachY = height / 2 - line / 2;
  const points = curve(CURVE_POINTS, (share) => {
    const x = -reachX + share * 2 * reachX;
    return new Phaser.Math.Vector2(x, -reachY * Math.sin(Math.PI * 2 * share));
  });
  roundLine(graphics, points, line, SCENERY.wave);
};

/** Racek: dvě ploché bílé obloučky křídel „︵︵“. */
const paintGull: Painter = (graphics, width, height) => {
  const line = height * LINE_SHARE;
  const reachX = width / 2 - line / 2;
  const bottom = height / 2 - line / 2;
  const rise = height - line;
  const points = curve(CURVE_POINTS, (share) => {
    const x = -reachX + share * 2 * reachX;
    return new Phaser.Math.Vector2(x, bottom - rise * Math.abs(Math.sin(Math.PI * 2 * share)));
  });
  roundLine(graphics, points, line, SCENERY.gull);
};

/** List: čočka v barvě podzimu se žilkou. */
const paintLeaf: Painter = (graphics, width, height, index) => {
  const top = curve(
    CURVE_POINTS,
    (share) =>
      new Phaser.Math.Vector2(
        -width / 2 + share * width,
        (-height / 2) * Math.sin(Math.PI * share),
      ),
  );
  const bottom = curve(
    CURVE_POINTS,
    (share) =>
      new Phaser.Math.Vector2(width / 2 - share * width, (height / 2) * Math.sin(Math.PI * share)),
  );
  graphics.fillStyle(pick(SCENERY.leaves, index), 1);
  graphics.fillPoints([...top, ...bottom], true);
  graphics.lineStyle(Math.max(1, height * 0.1), SCENERY.leafVein, 0.6);
  graphics.lineBetween(-width * 0.42, 0, width * 0.42, 0);
};

/** Motýl: dvě velká a dvě malá křídla s tečkou a tmavé tělíčko. */
const paintButterfly: Painter = (graphics, width, height, index) => {
  graphics.fillStyle(pick(SCENERY.butterflyWings, index), 1);
  for (const side of [-1, 1]) {
    graphics.fillEllipse(side * width * 0.25, -height * 0.12, width * 0.48, height * 0.55);
    graphics.fillEllipse(side * width * 0.2, height * 0.22, width * 0.36, height * 0.4);
  }
  graphics.fillStyle(SCENERY.butterflySpots, 1);
  for (const side of [-1, 1]) {
    graphics.fillCircle(side * width * 0.27, -height * 0.14, height * 0.08);
  }
  graphics.fillStyle(SCENERY.butterflyBody, 1);
  graphics.fillRoundedRect(-width * 0.035, -height * 0.4, width * 0.07, height * 0.8, width * 0.03);
};

/** Vlaječka: krátká tyčka a trojúhelníkový praporek v její horní půlce. */
const paintFlag: Painter = (graphics, width, height, index) => {
  const pole = width * 0.12;
  const poleLeft = -width / 2;
  graphics.fillStyle(SCENERY.flagPole, 1);
  graphics.fillRoundedRect(poleLeft, -height / 2, pole, height, pole / 2);
  graphics.fillStyle(pick(SCENERY.flagCloths, index), 1);
  graphics.fillTriangle(
    poleLeft + pole,
    -height / 2 + height * 0.04,
    width / 2,
    -height / 2 + height * 0.27,
    poleLeft + pole,
    -height / 2 + height * 0.5,
  );
};

/** Mráček: tři bílé kruhy na zaobleném spodku. */
const paintCloud: Painter = (graphics, width, height) => {
  graphics.fillStyle(SCENERY.cloud, 1);
  graphics.fillCircle(-width * 0.22, height * 0.12, height * 0.36);
  graphics.fillCircle(width * 0.05, -height * 0.05, height * 0.45);
  graphics.fillCircle(width * 0.27, height * 0.12, height * 0.34);
  graphics.fillRoundedRect(-width * 0.42, 0, width * 0.84, height * 0.46, height * 0.23);
};

/** Bublinka: průsvitný kroužek s odleskem. */
const paintBubble: Painter = (graphics, width) => {
  const ring = Math.max(1, width * 0.12);
  const radius = width / 2 - ring / 2;
  graphics.fillStyle(SCENERY.bubble, 0.25);
  graphics.fillCircle(0, 0, radius);
  graphics.lineStyle(ring, SCENERY.bubble, 0.9);
  graphics.strokeCircle(0, 0, radius);
  graphics.fillStyle(SCENERY.bubble, 1);
  graphics.fillCircle(-radius * 0.35, -radius * 0.35, radius * 0.25);
};

/** Rybka plující doprava: tělo, ocásek a oko. */
const paintFish: Painter = (graphics, width, height, index) => {
  graphics.fillStyle(SCENERY.fishFin, 1);
  graphics.fillTriangle(-width * 0.2, 0, -width / 2, -height * 0.42, -width / 2, height * 0.42);
  graphics.fillStyle(pick(SCENERY.fish, index), 1);
  graphics.fillEllipse(width * 0.12, 0, width * 0.74, height * 0.9);
  graphics.fillStyle(SCENERY.fishEye, 1);
  graphics.fillCircle(width * 0.3, -height * 0.1, height * 0.1);
};

/** Pěticípá hvězdička. */
const paintStar: Painter = (graphics, width, _height, index) => {
  const outer = width / 2;
  const inner = outer * 0.45;
  const points = Array.from({ length: 10 }, (_, step) => {
    const angle = (step * Math.PI) / 5 - Math.PI / 2;
    const reach = step % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(Math.cos(angle) * reach, Math.sin(angle) * reach);
  });
  graphics.fillStyle(pick(SCENERY.stars, index), 1);
  graphics.fillPoints(points, true);
};

/** Kometa: zářící hlava vlevo a ohon doprava, ke konci slábne. */
const paintComet: Painter = (graphics, width, height) => {
  const radius = height / 2;
  const headX = -width / 2 + radius;
  graphics.fillStyle(SCENERY.cometTail, 0.35);
  graphics.fillTriangle(headX, -radius * 0.9, headX, radius * 0.9, width / 2, 0);
  graphics.fillStyle(SCENERY.cometTail, 0.7);
  graphics.fillTriangle(headX, -radius * 0.5, headX, radius * 0.5, width * 0.2, 0);
  graphics.fillStyle(SCENERY.cometHead, 1);
  graphics.fillCircle(headX, 0, radius);
};

const PAINTERS: Readonly<Record<SceneryKind, Painter>> = {
  waves: paintWave,
  gull: paintGull,
  fallingLeaves: paintLeaf,
  butterfly: paintButterfly,
  flag: paintFlag,
  cloud: paintCloud,
  bubbles: paintBubble,
  fish: paintFish,
  stars: paintStar,
  comet: paintComet,
};

/** Nakreslený kousek a kousek z rozložení, podle kterého se hýbe. */
export interface DrawnSceneryPiece {
  readonly piece: SceneryPiece;
  readonly graphics: Phaser.GameObjects.Graphics;
}

/** Nakreslí kousky prostředí; do mapy je přidá volající pod cestu. */
export function drawScenery(scene: Phaser.Scene, scenery: MapScenery): DrawnSceneryPiece[] {
  return scenery.pieces.map((piece) => {
    const graphics = scene.add.graphics();
    const { width, height } = scenerySizeOf(piece);
    PAINTERS[piece.kind](graphics, width, height, piece.index);
    return { piece, graphics };
  });
}

/** Posune kousky tam, kde jsou v čase `elapsedMs` od ukázání mapy. */
export function moveScenery(pieces: readonly DrawnSceneryPiece[], elapsedMs: number): void {
  for (const { piece, graphics } of pieces) {
    const pose = sceneryPoseAt(piece, elapsedMs);
    graphics
      .setPosition(pose.x, pose.y)
      .setAngle(pose.angle)
      .setScale(pose.scaleX, pose.scaleY)
      .setAlpha(pose.alpha);
  }
}
