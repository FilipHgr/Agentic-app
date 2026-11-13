/**
 * Smetení barev koštětem (#142): kopie jen barev ve chvíli zrušení (bílá
 * plocha a obrys průhledné) leží nad stránkou pod obrysem, krátce odjede
 * do strany a zmizí. Maska ji ořízne na obdélník obrázku, takže nevyjede
 * na pozadí. Stránka pod
 * ní je už na začátku, takže animace jen kreslí; co se vrátí, řeší logika
 * (`savedPicture.ts`). Jediný obrázek s jednou animací, 60 fps zůstane.
 */

import Phaser from 'phaser';

import type { LayoutRect } from '../logic/coloringLayout';
import { BROOM_SWEEP_STYLE } from '../logic/theme';

/** Co smetení potřebuje vědět o obrazovce malování. */
export interface BroomSweepStart {
  /** Obrázek na obrazovce (herní jednotky). */
  readonly picture: LayoutRect;
  /** Rozměr vrstvy barev na obrazovce (herní jednotky). */
  readonly layerSize: { readonly width: number; readonly height: number };
  /** Kopie jen barev před zrušením (bez bílé plochy a obrysu). */
  readonly snapshot: HTMLCanvasElement;
  /** Hloubka nad vrstvou barev a pod obrysem. */
  readonly depth: number;
}

export class BroomSweepView {
  private image: Phaser.GameObjects.Image | null = null;
  private textureKey: string | null = null;
  /** Obdélník obrázku, na který maska kopii ořízne. */
  private maskShape: Phaser.GameObjects.Graphics | null = null;
  /** Číslo další textury, aby nová nikdy nepřepsala tu, která je vidět. */
  private sweepCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly name: string,
  ) {}

  /** Spustí smetení; předchozí rozběhnuté skončí. */
  start(start: BroomSweepStart): void {
    this.stop();
    this.sweepCount += 1;
    const key = `${this.name}:${this.sweepCount}`;
    if (this.scene.textures.addCanvas(key, start.snapshot) === null) {
      return;
    }
    this.textureKey = key;
    const { picture, layerSize } = start;
    const centerX = picture.left + picture.width / 2;
    const image = this.scene.add
      .image(centerX, picture.top + picture.height / 2, key)
      .setDisplaySize(layerSize.width, layerSize.height)
      .setDepth(start.depth);
    const maskShape = this.scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(picture.left, picture.top, picture.width, picture.height);
    image.setMask(maskShape.createGeometryMask());
    this.maskShape = maskShape;
    this.image = image;
    this.scene.tweens.add({
      targets: image,
      x: centerX + picture.width * BROOM_SWEEP_STYLE.shiftShare,
      alpha: 0,
      duration: BROOM_SWEEP_STYLE.durationMs,
      ease: 'Sine.easeIn',
      onComplete: () => this.stop(),
    });
  }

  destroy(): void {
    this.stop();
  }

  private stop(): void {
    if (this.image !== null) {
      this.scene.tweens.killTweensOf(this.image);
      this.image.clearMask(true);
      this.image.destroy();
    }
    this.image = null;
    this.maskShape?.destroy();
    this.maskShape = null;
    if (this.textureKey !== null) {
      this.scene.textures.remove(this.textureKey);
    }
    this.textureKey = null;
  }
}
