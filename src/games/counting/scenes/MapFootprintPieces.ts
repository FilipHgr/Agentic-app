import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { footprintMomentAt } from '../logic/mapFootprints';
import type {
  FootprintKind,
  FootprintLook,
  MapFootprint,
  MapFootprintStyle,
  MapFootprints,
} from '../logic/mapFootprints';
import type { MapMove } from '../logic/progressMap';
import type { ProgressMapLayout } from '../logic/progressMapLayout';

/**
 * Stopy na cestě mapy postupu (#144): každá stopa je malá kresba
 * z jednoduchých tvarů (žádné obrázky navíc) kolem svého středu, po směru
 * chůze míří doprava. Obrys je zvětšená výplň pod výplní. Neprošlé stopy
 * se kreslí naplno do jedné textury a ta je celá poloprůhledná, aby se na
 * překryvech výplně a obrysu neukázaly švy. Prošlé stopy jsou plné, každá
 * je vlastní kresba, která při rozsvícení krátce poskočí.
 */

/** Tloušťka obrysu jako díl delší strany stopy. */
const OUTLINE_SHARE = 0.07;

/** Bílý odlesk bublinky: poloha a velikost jako díl průměru. */
const BUBBLE_SHINE_OFFSET = 0.16;
const BUBBLE_SHINE_RADIUS = 0.09;

/** Kolik obrysů široký je tmavý kroužek kolem hvězdičky cesty. */
const STAR_BADGE_RING = 1.3;

/** Pěticípá hvězdička: vnitřní poloměr jako díl vnějšího. */
const STAR_INNER_SHARE = 0.48;

/** O kolik se stopa při poskoku navíc zvětší (díl výšky poskoku). */
const HOP_GROWTH = 0.35;

/** Rezerva kolem textury neprošlých stop v herních jednotkách (obrys, zaokrouhlení). */
const TEXTURE_MARGIN = 4;

/** Tvar kresby v souřadnicích stopy (x po směru chůze, y doprava od něj). */
type Part =
  | {
      readonly type: 'ellipse';
      readonly x: number;
      readonly y: number;
      readonly rx: number;
      readonly ry: number;
    }
  | {
      readonly type: 'roundRect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly radius: number;
    }
  | { readonly type: 'star'; readonly radius: number };

/**
 * Díly stopy velikosti `width × height`, už zmenšené o obrys, aby se
 * kresba i s obrysem vešla do obdélníku stopy. `side` 1 je levá noha
 * (palec vpravo, blíž k cestě), −1 pravá.
 */
function partsOf(print: MapFootprint, kind: FootprintKind, outline: number): Part[] {
  const w = print.width - outline * 2;
  const h = print.height - outline * 2;
  const inner = print.side;
  switch (kind) {
    case 'paw':
      return [
        { type: 'ellipse', x: -0.2 * w, y: 0, rx: 0.28 * w, ry: 0.3 * h },
        { type: 'ellipse', x: 0.18 * w, y: -0.35 * h, rx: 0.12 * w, ry: 0.14 * h },
        { type: 'ellipse', x: 0.36 * w, y: -0.12 * h, rx: 0.12 * w, ry: 0.13 * h },
        { type: 'ellipse', x: 0.36 * w, y: 0.12 * h, rx: 0.12 * w, ry: 0.13 * h },
        { type: 'ellipse', x: 0.18 * w, y: 0.35 * h, rx: 0.12 * w, ry: 0.14 * h },
      ];
    case 'bareFoot':
      return [
        { type: 'ellipse', x: -0.3 * w, y: 0, rx: 0.2 * w, ry: 0.32 * h },
        { type: 'ellipse', x: 0.04 * w, y: 0.04 * h * inner, rx: 0.28 * w, ry: 0.42 * h },
        { type: 'ellipse', x: 0.4 * w, y: 0.3 * h * inner, rx: 0.1 * w, ry: 0.18 * h },
        { type: 'ellipse', x: 0.42 * w, y: 0.02 * h * inner, rx: 0.07 * w, ry: 0.12 * h },
        { type: 'ellipse', x: 0.38 * w, y: -0.22 * h * inner, rx: 0.06 * w, ry: 0.11 * h },
        { type: 'ellipse', x: 0.3 * w, y: -0.42 * h * inner, rx: 0.05 * w, ry: 0.08 * h },
      ];
    case 'boot':
      // Podrážka široká u špičky a užší v nártu, za mezerou užší pata.
      return [
        { type: 'ellipse', x: 0.27 * w, y: 0, rx: 0.23 * w, ry: 0.5 * h },
        {
          type: 'roundRect',
          x: 0.075 * w,
          y: 0,
          width: 0.25 * w,
          height: 0.6 * h,
          radius: 0.3 * h,
        },
        {
          type: 'roundRect',
          x: -0.39 * w,
          y: 0,
          width: 0.22 * w,
          height: 0.8 * h,
          radius: 0.35 * h,
        },
      ];
    case 'bubble':
      return [{ type: 'ellipse', x: 0, y: 0, rx: w / 2, ry: h / 2 }];
    case 'star':
      return [{ type: 'star', radius: Math.min(w, h) / 2 }];
  }
}

/** Body pěticípé hvězdičky se středem v počátku, špička nahoru. */
function starPoints(radius: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = (index * Math.PI) / 5 - Math.PI / 2;
    const reach = index % 2 === 0 ? radius : radius * STAR_INNER_SHARE;
    return new Phaser.Math.Vector2(Math.cos(angle) * reach, Math.sin(angle) * reach);
  });
}

/** Díl `part` zvětšený o `grow` na každou stranu (pro obrys). */
function fillPart(graphics: Phaser.GameObjects.Graphics, part: Part, grow: number): void {
  if (part.type === 'ellipse') {
    graphics.fillEllipse(part.x, part.y, (part.rx + grow) * 2, (part.ry + grow) * 2);
  } else if (part.type === 'roundRect') {
    const width = part.width + grow * 2;
    const height = part.height + grow * 2;
    const radius = Math.min(part.radius + grow, width / 2, height / 2);
    graphics.fillRoundedRect(part.x - width / 2, part.y - height / 2, width, height, radius);
  } else {
    // Hvězdička se zvětší víc, aby obrys v cípech nebyl tenčí než jinde.
    graphics.fillPoints(starPoints(part.radius + grow * 1.6), true);
  }
}

/** Nakreslí stopu do `graphics` kolem počátku: obrys, výplň a u bublinky odlesk. */
function paintFootprint(
  graphics: Phaser.GameObjects.Graphics,
  print: MapFootprint,
  kind: FootprintKind,
  look: FootprintLook,
): void {
  const longer = Math.max(print.width, print.height);
  const outline = longer * OUTLINE_SHARE;
  if (kind === 'star') {
    paintStarBadge(graphics, print, look, outline);
    return;
  }
  const parts = partsOf(print, kind, outline);
  graphics.fillStyle(colorNumber(look.outlineColor), 1);
  parts.forEach((part) => fillPart(graphics, part, outline));
  graphics.fillStyle(colorNumber(look.fillColor), 1);
  parts.forEach((part) => fillPart(graphics, part, 0));
  if (kind === 'bubble') {
    const size = print.width - outline * 2;
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(
      -size * BUBBLE_SHINE_OFFSET,
      -size * BUBBLE_SHINE_OFFSET,
      size * BUBBLE_SHINE_RADIUS,
    );
  }
}

/**
 * Hvězdička cesty ve vesmíru: hvězdička v barvě výplně na kroužku
 * v barvě obrysu, aby nesplývala s hvězdami na obrázku.
 */
function paintStarBadge(
  graphics: Phaser.GameObjects.Graphics,
  print: MapFootprint,
  look: FootprintLook,
  outline: number,
): void {
  const radius = Math.min(print.width, print.height) / 2;
  graphics.fillStyle(colorNumber(look.outlineColor), 1);
  graphics.fillCircle(0, 0, radius);
  graphics.fillStyle(colorNumber(look.fillColor), 1);
  graphics.fillPoints(starPoints(radius - outline * STAR_BADGE_RING), true);
}

/** Nakreslené stopy jedné mapy. */
export interface DrawnFootprints {
  /** Co patří do kontejneru mapy: textura neprošlých stop a prošlé stopy. */
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  /** Každý snímek: rozsvícení a poskok podle času od ukázání mapy. */
  update(elapsedMs: number): void;
  /** Uvolní kresby, které nejsou v kontejneru mapy. */
  destroy(): void;
}

/**
 * Nakreslí stopy `footprints`. `zoom` je zvětšení kamery: textura
 * neprošlých stop má tolik pixelů na herní jednotku, aby byla ostrá.
 */
export function drawFootprints(
  scene: Phaser.Scene,
  layout: ProgressMapLayout,
  move: MapMove,
  footprints: MapFootprints,
  style: MapFootprintStyle,
  zoom: number,
): DrawnFootprints {
  const { kind, prints } = footprints;
  const lit = prints.map((print) => {
    const graphics = scene.add.graphics();
    paintFootprint(graphics, print, kind, style.lit);
    return graphics
      .setPosition(print.x, print.y)
      .setRotation(Phaser.Math.DegToRad(print.angle))
      .setVisible(false);
  });
  const unlit = prints.map((print) => {
    const graphics = scene.make.graphics({}, false);
    paintFootprint(graphics, print, kind, style.unlit);
    return graphics.setRotation(Phaser.Math.DegToRad(print.angle)).setScale(zoom);
  });
  const bounds = printBounds(prints);
  const texture = scene.add
    .renderTexture(
      bounds.left,
      bounds.top,
      Math.max(1, Math.ceil(bounds.width * zoom)),
      Math.max(1, Math.ceil(bounds.height * zoom)),
    )
    .setOrigin(0, 0)
    .setScale(1 / zoom)
    .setAlpha(style.unlit.alpha);
  let drawnLitCount = -1;

  const redrawUnlit = (isLit: readonly boolean[]): void => {
    texture.clear();
    prints.forEach((print, index) => {
      const graphics = unlit[index];
      if (graphics && !isLit[index]) {
        texture.draw(graphics, (print.x - bounds.left) * zoom, (print.y - bounds.top) * zoom);
      }
    });
  };

  const update = (elapsedMs: number): void => {
    const moments = prints.map((print) => footprintMomentAt(layout, move, print, elapsedMs));
    const isLit = moments.map((moment) => moment.lit);
    const litCount = isLit.filter(Boolean).length;
    if (litCount !== drawnLitCount) {
      drawnLitCount = litCount;
      redrawUnlit(isLit);
    }
    moments.forEach((moment, index) => {
      const graphics = lit[index];
      const print = prints[index];
      if (!graphics || !print) {
        return;
      }
      graphics.setVisible(moment.lit);
      const longer = Math.max(print.width, print.height);
      graphics.setY(print.y - moment.hop * longer);
      graphics.setScale(1 + moment.hop * HOP_GROWTH);
    });
  };

  return {
    objects: [texture, ...lit],
    update,
    destroy: () => unlit.forEach((graphics) => graphics.destroy()),
  };
}

/** Obdélník, do kterého se vejdou všechny stopy i s rezervou. */
function printBounds(prints: readonly MapFootprint[]): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  if (prints.length === 0) {
    return { left: 0, top: 0, width: 1, height: 1 };
  }
  const reach = (print: MapFootprint): number => Math.hypot(print.width, print.height) / 2;
  const left = Math.min(...prints.map((print) => print.x - reach(print))) - TEXTURE_MARGIN;
  const top = Math.min(...prints.map((print) => print.y - reach(print))) - TEXTURE_MARGIN;
  const right = Math.max(...prints.map((print) => print.x + reach(print))) + TEXTURE_MARGIN;
  const bottom = Math.max(...prints.map((print) => print.y + reach(print))) + TEXTURE_MARGIN;
  return { left, top, width: right - left, height: bottom - top };
}
