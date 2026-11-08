/**
 * Lesk třpytek během tahu (#103 AC3): bílé jiskry, které odlétají od
 * prstu. Kde jiskry jsou, řeší logika `glitterShine.ts`; tady se jen
 * vykreslí. Všechny jiskry jsou v jednom objektu Graphics nad obrázkem,
 * který se překreslí jednou za snímek a jen dokud je co kreslit. Do vrstvy
 * barev se nic nezapíše. Jiskry mají jemný šedý okraj, aby byl bílý lesk
 * vidět i na nevybarvené bílé ploše.
 */

import type Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { createGlitterShine } from '../logic/glitterShine';
import type { GlitterShine } from '../logic/glitterShine';
import { GLITTER_STYLE } from '../logic/theme';
import { starPoints } from '../logic/toolIcons';

/** Délka cípu největší jiskry lesku jako díl W tahu. */
const SPARK_REACH_SHARE = 0.6;

/** Šířka okraje jiskry v CSS pixelech. */
const OUTLINE_CSS = 1.5;

/** Neprůhlednost okraje jiskry při plném lesku. */
const OUTLINE_ALPHA = 0.9;

/** Hloubka zářezů mezi cípy jiskry jako díl délky cípu. */
const NOTCH_SHARE = 0.3;

/** Kam se vrstva barev kreslí: obdélník obrázku a rozměr vrstvy v pixelech. */
export interface ShinePlacement {
  readonly picture: LayoutRect;
  readonly layerWidth: number;
  readonly layerHeight: number;
  /** Kolik CSS pixelů je jedna herní jednotka. */
  readonly cssScale: number;
}

export class GlitterShineView {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private shine: GlitterShine | null = null;
  /** Prst, jehož tah se právě leskne; `null` mimo tah třpytkami. */
  private pointerId: number | null = null;
  private brushWidth = 1;
  /** Byly při posledním snímku nějaké jiskry (je co smazat)? */
  private drawnAny = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  /** Prst `pointerId` začal tah třpytkami s W `brushWidth` v bodě `point` (pixely vrstvy). */
  start(pointerId: number, brushWidth: number, point: { x: number; y: number }): void {
    if (this.pointerId !== null) {
      return;
    }
    if (this.shine === null || brushWidth !== this.brushWidth) {
      this.shine = createGlitterShine({ random: Math.random, brushWidth });
      this.brushWidth = brushWidth;
    }
    this.pointerId = pointerId;
    this.shine.fingerAt(point, this.scene.time.now);
  }

  /** Prst `pointerId` se posunul do bodu `point` (pixely vrstvy). */
  move(pointerId: number, point: { x: number; y: number }): void {
    if (this.pointerId === pointerId && Number.isFinite(point.x + point.y)) {
      this.shine?.fingerAt(point, this.scene.time.now);
    }
  }

  /** Prst `pointerId` se zvedl; bez čísla tah skončil jinak (přerušení, odchod). */
  end(pointerId?: number): void {
    if (this.pointerId === null || (pointerId !== undefined && this.pointerId !== pointerId)) {
      return;
    }
    this.pointerId = null;
    this.shine?.fingerLifted(this.scene.time.now);
  }

  /** Překreslí lesk pro tento snímek; když nic nesvítí a nic nezbylo, nedělá nic. */
  draw(placement: ShinePlacement): void {
    const sparks = this.shine?.sparksAt(this.scene.time.now) ?? [];
    if (sparks.length === 0 && !this.drawnAny) {
      return;
    }
    const graphics = this.graphicsObject();
    graphics.clear();
    this.drawnAny = sparks.length > 0;
    const { picture, layerWidth, layerHeight, cssScale } = placement;
    const scaleX = picture.width / layerWidth;
    const scaleY = picture.height / layerHeight;
    const maxReach = SPARK_REACH_SHARE * this.brushWidth * scaleX;
    const outlineWidth = OUTLINE_CSS / cssScale;
    for (const spark of sparks) {
      const x = picture.left + spark.x * scaleX;
      const y = picture.top + spark.y * scaleY;
      const reach = spark.size * maxReach;
      graphics.lineStyle(
        outlineWidth,
        colorNumber(GLITTER_STYLE.shineOutline),
        OUTLINE_ALPHA * spark.opacity,
      );
      graphics.fillStyle(colorNumber(GLITTER_STYLE.shineColor), spark.opacity);
      // Čtyřcípá jiskra ✦ s cípy nahoru, doprava, dolů a doleva.
      const points = starPoints({
        x,
        y,
        tips: 4,
        outerRadius: reach,
        innerRadius: reach * NOTCH_SHARE,
        rotation: 0,
      });
      graphics.fillPoints(points, true);
      graphics.strokePoints(points, true);
    }
  }

  private graphicsObject(): Phaser.GameObjects.Graphics {
    this.graphics ??= this.scene.add.graphics().setDepth(this.depth);
    return this.graphics;
  }
}
