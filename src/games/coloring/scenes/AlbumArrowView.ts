/**
 * Šipka ◀ nebo ▶ v albu Omalovánek (#149): podklad a okraj jako tlačítka
 * s ikonou (kniha, koš), uprostřed plný modrý trojúhelník. Ťuknutí pozná
 * scéna; šipka se umí zhoupnout (na krajní stránce).
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { ALBUM_ARROW_STYLE, ICON_BUTTON_STYLE } from '../logic/theme';
import { backgroundOf } from './IconButtonView';

export class AlbumArrowView {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly direction: 'previous' | 'next',
  ) {}

  /** Postaví šipku na místo `rect` (herní jednotky). */
  place(rect: LayoutRect, cssScale: number): void {
    this.destroy();
    const container = this.scene.add.container(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    container.add(backgroundOf(this.scene, rect, cssScale));
    container.add(this.triangle(Math.min(rect.width, rect.height)));
    this.container = container;
  }

  /** Zhoupnutí jako u tlačítek s ikonou. */
  wobble(): void {
    const target = this.container;
    if (target === null) {
      return;
    }
    const { wobbleAngle: angle, wobbleMs: ms } = ICON_BUTTON_STYLE;
    this.scene.tweens.killTweensOf(target);
    target.setAngle(0);
    this.scene.tweens.chain({
      targets: target,
      tweens: [
        { angle, duration: ms, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * ms, ease: 'Sine.easeInOut' },
        { angle: 0, duration: ms, ease: 'Sine.easeIn' },
      ],
    });
  }

  destroy(): void {
    if (this.container !== null) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy();
    }
    this.container = null;
  }

  /** Plný trojúhelník se středem v počátku, hrotem ve směru listování. */
  private triangle(side: number): Phaser.GameObjects.Graphics {
    const height = side * ALBUM_ARROW_STYLE.triangleShare;
    // Rovnostranný trojúhelník: hloubka od základny k hrotu.
    const depth = (height * Math.sqrt(3)) / 2;
    const tip = this.direction === 'next' ? 1 : -1;
    // Těžiště trojúhelníku je uprostřed tlačítka.
    const tipX = (tip * 2 * depth) / 3;
    const baseX = (-tip * depth) / 3;
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(colorNumber(ALBUM_ARROW_STYLE.symbolColor), 1);
    graphics.fillTriangle(tipX, 0, baseX, -height / 2, baseX, height / 2);
    return graphics;
  }
}
