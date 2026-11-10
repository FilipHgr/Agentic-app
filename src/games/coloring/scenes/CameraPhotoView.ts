/**
 * Animace uložení obrázku do alba (#126 AC1, schválené obrázky): bílý
 * záblesk přes obrázek a stisknutí fotoaparátu, pak se fotka obrázku
 * s bílým okrajem zmenší a odletí po oblouku do fotoaparátu, který
 * poskočí. Fotka je kopie obrázku ve chvíli cvaku, takže stránka pod ní
 * se smí vyčistit hned po potvrzeném uložení. Animace jen kreslí; co se
 * uloží, řeší logika (`savedPicture.ts`).
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect, PictureTurn } from '../logic/coloringLayout';
import { CAMERA_PHOTO_STYLE, PICTURE_STYLE } from '../logic/theme';
import type { IconButtonView } from './IconButtonView';

/** Co animace potřebuje vědět o obrazovce malování. */
export interface CameraPhotoStart {
  /** Obrázek na obrazovce (herní jednotky). */
  readonly picture: LayoutRect;
  readonly pictureTurn: PictureTurn;
  /** Rozměr vrstvy barev a obrysu před otočením (herní jednotky). */
  readonly layerSize: { readonly width: number; readonly height: number };
  /** Kopie obrázku ve chvíli cvaku a textura obrysu. */
  readonly snapshot: HTMLCanvasElement;
  readonly outlineTextureKey: string;
  readonly camera: IconButtonView;
  readonly cssScale: number;
  readonly depth: number;
}

const style = CAMERA_PHOTO_STYLE;

/** Zpomalení na konci pohybu. */
function easeOut(value: number): number {
  return 1 - (1 - value) * (1 - value);
}

function between(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

/** Díl úseku animace od `start` do `end` v čase `time` (0 až 1). */
function shareOf(time: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (time - start) / (end - start)));
}

export class CameraPhotoView {
  private photo: Phaser.GameObjects.Container | null = null;
  private flash: Phaser.GameObjects.Rectangle | null = null;
  private counter: Phaser.Tweens.Tween | null = null;
  private snapshotKey: string | null = null;
  private camera: IconButtonView | null = null;
  /** Číslo další textury fotky, aby nová nikdy nepřepsala tu, která je vidět. */
  private photoCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly name: string,
  ) {}

  /** Spustí animaci od cvaku; předchozí rozběhnutá skončí. */
  start(start: CameraPhotoStart): void {
    this.stop();
    this.photoCount += 1;
    const key = `${this.name}:${this.photoCount}`;
    if (this.scene.textures.addCanvas(key, start.snapshot) === null) {
      return;
    }
    this.snapshotKey = key;
    this.camera = start.camera;
    this.photo = this.buildPhoto(start, key);
    const { picture } = start;
    this.flash = this.scene.add
      .rectangle(
        picture.left,
        picture.top,
        picture.width,
        picture.height,
        colorNumber(style.flashColor),
      )
      .setOrigin(0, 0)
      .setDepth(start.depth + 1);
    this.counter = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: style.durationMs,
      onUpdate: (tween) => this.pose(start, tween.getValue() ?? 0),
      onComplete: () => this.land(),
    });
    this.pose(start, 0);
  }

  /** Úložiště uložení odmítlo: fotka zmizí, fotoaparát se vrátí do klidu. */
  cancel(): void {
    this.stop();
  }

  destroy(): void {
    this.stop();
  }

  /** Fotka: stín, bílá karta s okrajem, kopie obrázku, obrys a rámeček. */
  private buildPhoto(start: CameraPhotoStart, snapshotKey: string): Phaser.GameObjects.Container {
    const { picture, pictureTurn, layerSize, cssScale } = start;
    const unitsPerCss = 1 / cssScale;
    const border = style.borderCss * unitsPerCss;
    const corner = style.cornerCss * unitsPerCss;
    const halfWidth = picture.width / 2;
    const halfHeight = picture.height / 2;
    const card = this.scene.add.graphics();
    for (const spreadCss of style.shadowSpreadsCss) {
      const spread = spreadCss * unitsPerCss;
      card
        .fillStyle(0x000000, style.shadowAlpha)
        .fillRoundedRect(
          -halfWidth - border - spread,
          -halfHeight - border - spread + style.shadowOffsetCss * unitsPerCss,
          picture.width + 2 * (border + spread),
          picture.height + 2 * (border + spread),
          corner + spread,
        );
    }
    card
      .fillStyle(colorNumber(PICTURE_STYLE.background), 1)
      .fillRoundedRect(
        -halfWidth - border,
        -halfHeight - border,
        picture.width + 2 * border,
        picture.height + 2 * border,
        corner,
      );
    const layer = (key: string): Phaser.GameObjects.Image =>
      this.scene.add
        .image(0, 0, key)
        .setAngle(pictureTurn)
        .setDisplaySize(layerSize.width, layerSize.height);
    const frame = this.scene.add
      .rectangle(0, 0, picture.width, picture.height)
      .setStrokeStyle(
        PICTURE_STYLE.frameWidthCss * unitsPerCss,
        colorNumber(PICTURE_STYLE.frameColor),
      );
    return this.scene.add
      .container(picture.left + halfWidth, picture.top + halfHeight, [
        card,
        layer(snapshotKey),
        layer(start.outlineTextureKey),
        frame,
      ])
      .setDepth(start.depth);
  }

  /** Vzhled animace v čase `time` (0 až 1). */
  private pose(start: CameraPhotoStart, time: number): void {
    const photo = this.photo;
    if (photo === null) {
      return;
    }
    const { picture } = start;
    this.flash
      ?.setVisible(time < style.flashEnd)
      .setAlpha(style.flashAlpha * (1 - shareOf(time, 0, style.flashEnd)));
    start.camera.setPressScale(time < style.pressEnd ? style.pressScale : 1);
    const centerX = picture.left + picture.width / 2;
    const centerY = picture.top + picture.height / 2;
    if (time < style.flyStart) {
      const shrink = easeOut(shareOf(time, style.shrinkStart, style.flyStart));
      photo
        .setPosition(centerX, centerY)
        .setScale(between(1, style.shrunkScale, shrink))
        .setAngle(between(0, style.shrunkAngle, shrink))
        .setAlpha(1);
      return;
    }
    const fly = easeOut(shareOf(time, style.flyStart, 1));
    const target = start.camera.center() ?? { x: centerX, y: centerY };
    const landedScale = (0.5 * (start.camera.side() ?? 0)) / picture.width;
    // Odlet po mírném oblouku nahoru.
    const arc = -Math.sin(fly * Math.PI) * picture.height * style.arcShare;
    photo
      .setPosition(between(centerX, target.x, fly), between(centerY, target.y, fly) + arc)
      .setScale(between(style.shrunkScale, landedScale, fly))
      .setAngle(between(style.shrunkAngle, style.landedAngle, fly))
      .setAlpha(fly > 1 - style.fadeShare ? (1 - fly) / style.fadeShare : 1);
  }

  /** Fotka doletěla: zmizí a fotoaparát poskočí. */
  private land(): void {
    const camera = this.camera;
    this.stop();
    camera?.bounce();
  }

  private stop(): void {
    if (this.counter !== null) {
      this.counter.remove();
      this.counter = null;
    }
    this.photo?.destroy();
    this.photo = null;
    this.flash?.destroy();
    this.flash = null;
    this.camera?.setPressScale(1);
    this.camera = null;
    if (this.snapshotKey !== null && this.scene.textures.exists(this.snapshotKey)) {
      this.scene.textures.remove(this.snapshotKey);
    }
    this.snapshotKey = null;
  }
}
