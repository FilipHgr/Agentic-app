import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { cardDots } from '../logic/compareLayout';
import type { DotGroups, Rect } from '../logic/compareLayout';
import { CARD_STYLE, DOT_COLORS, EQUAL_BUTTON_STYLE } from '../logic/theme';

/** Jak daleko a jak dlouho se karta nebo „=“ po chybě zatřese (CSS px, ms). */
const SHAKE_DISTANCE_CSS = 8;
const SHAKE_STEP_MS = 50;
const SHAKE_REPEATS = 3;

/** Krátké zvětšení po správném ťuknutí. */
const BOUNCE_SCALE = 1.05;
const BOUNCE_MS = 140;

/**
 * Ťukací plocha hry (karta s tečkami nebo „=“): kontejner na středu
 * obdélníku, zatřesení po chybě a zhoupnutí po správné odpovědi.
 */
abstract class TapTarget {
  readonly container: Phaser.GameObjects.Container;
  protected readonly background: Phaser.GameObjects.Graphics;

  protected constructor(
    protected readonly scene: Phaser.Scene,
    protected readonly rect: Rect,
    protected readonly unit: number,
    onTap: () => void,
  ) {
    this.background = scene.add.graphics();
    this.container = scene.add.container(rect.left + rect.width / 2, rect.top + rect.height / 2, [
      this.background,
    ]);
    this.container.setSize(rect.width, rect.height).setInteractive();
    this.container.on('pointerdown', onTap);
  }

  /** Střed plochy: odtud vyletí hvězdička. */
  get center(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /** Jemné zatřesení do stran; plocha se vrátí přesně na své místo. */
  shake(): void {
    const homeX = this.rect.left + this.rect.width / 2;
    this.scene.tweens.killTweensOf(this.container);
    this.container.setPosition(homeX, this.container.y).setScale(1);
    this.scene.tweens.add({
      targets: this.container,
      x: homeX + SHAKE_DISTANCE_CSS * this.unit,
      duration: SHAKE_STEP_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: 'Sine.easeInOut',
      onComplete: () => this.container.setX(homeX),
    });
  }

  /** Krátké zvětšení a zpět. */
  bounce(): void {
    this.scene.tweens.add({
      targets: this.container,
      scale: BOUNCE_SCALE,
      duration: BOUNCE_MS,
      yoyo: true,
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  /** Zaoblený obdélník na středu kontejneru. */
  protected paintBox(fill: string, border: string, borderCss: number, radius: number): void {
    const { width, height } = this.rect;
    this.background
      .clear()
      .fillStyle(colorNumber(fill))
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
      .lineStyle(borderCss * this.unit, colorNumber(border))
      .strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  }
}

/** Karta s tečkami po pěti v řadách nebo ve sloupcích (#178 AC1). */
export class CardView extends TapTarget {
  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    unit: number,
    private readonly radius: number,
    dots: { readonly count: number; readonly groups: DotGroups; readonly side: 0 | 1 },
    onTap: () => void,
  ) {
    super(scene, rect, unit, onTap);
    this.paintBox(CARD_STYLE.fill, CARD_STYLE.border, CARD_STYLE.borderWidth, radius);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    for (const dot of cardDots(rect, dots.count, dots.groups)) {
      this.container.add(
        scene.add.circle(
          dot.x - centerX,
          dot.y - centerY,
          dot.radius,
          colorNumber(DOT_COLORS[dots.side]),
        ),
      );
    }
  }

  /** Správná karta dostane zelený okraj; po ťuknutí se i zhoupne (po otočení ne). */
  markCorrect(animate = true): void {
    this.paintBox(
      CARD_STYLE.fill,
      CARD_STYLE.correctBorder,
      CARD_STYLE.correctBorderWidth,
      this.radius,
    );
    if (animate) {
      this.bounce();
    }
  }
}

/** Tlačítko „=“ mezi kartami. Symbol, ne text jazyka. */
export class EqualButtonView extends TapTarget {
  constructor(scene: Phaser.Scene, rect: Rect, unit: number, onTap: () => void) {
    super(scene, rect, unit, onTap);
    this.paintBox(
      EQUAL_BUTTON_STYLE.fill,
      EQUAL_BUTTON_STYLE.border,
      EQUAL_BUTTON_STYLE.borderWidth,
      rect.width * 0.25,
    );
    const label = scene.add
      .text(0, 0, '=', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(rect.height * 0.7)}px`,
        fontStyle: EQUAL_BUTTON_STYLE.fontWeight,
        color: EQUAL_BUTTON_STYLE.symbolColor,
      })
      .setOrigin(0.5);
    this.container.add(label);
  }

  /** Po správné odpovědi tlačítko ustoupí znaku. */
  hide(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(false);
  }
}
