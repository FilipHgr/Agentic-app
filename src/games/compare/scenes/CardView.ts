import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { HintDot } from '../logic/compareHint';
import { cardDots, cardNumeral } from '../logic/compareLayout';
import type { CardLook, Dot, DotGroups, Numeral, Point, Rect } from '../logic/compareLayout';
import {
  CARD_STYLE,
  DOT_COLORS,
  EQUAL_BUTTON_STYLE,
  HINT_STYLE,
  NUMERAL_STYLE,
} from '../logic/theme';

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

/**
 * Karta s tečkami po pěti v řadách nebo ve sloupcích (#178 AC1), podle
 * nastavení s číslem pod nimi, nebo jen s číslem (#179 AC3). S nápovědou
 * (#180) se tečky spárují a tečky bez dvojice rozsvítí.
 */
export class CardView extends TapTarget {
  private readonly color: string;
  private readonly count: number;
  private dotCircles: Phaser.GameObjects.Arc[] = [];
  private glows: Phaser.GameObjects.Arc[] = [];
  /** Kusy spojení dvojic nápovědy na kartě, pod tečkami. */
  private linkParts: Phaser.GameObjects.Graphics[] = [];
  private label: Phaser.GameObjects.Text | null = null;
  private hintDots: readonly HintDot[] = [];

  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    unit: number,
    private readonly radius: number,
    dots: {
      readonly count: number;
      readonly groups: DotGroups;
      readonly side: 0 | 1;
      readonly look: CardLook;
    },
    onTap: () => void,
  ) {
    super(scene, rect, unit, onTap);
    this.color = DOT_COLORS[dots.side];
    this.count = dots.count;
    this.paintBox(CARD_STYLE.fill, CARD_STYLE.border, CARD_STYLE.borderWidth, radius);
    this.drawContent(
      cardDots(rect, dots.count, dots.groups, dots.look),
      cardNumeral(rect, dots.look),
    );
  }

  /** Tečky a číslo karty (souřadnice herní plochy, kreslí se od středu karty). */
  private drawContent(dots: readonly Dot[], numeral: Numeral | null): void {
    const centerX = this.rect.left + this.rect.width / 2;
    const centerY = this.rect.top + this.rect.height / 2;
    this.dotCircles = dots.map((dot) =>
      this.scene.add.circle(dot.x - centerX, dot.y - centerY, dot.radius, colorNumber(this.color)),
    );
    this.container.add(this.dotCircles);
    if (numeral) {
      // Číslice jsou symbol, ne text jazyka.
      this.label = this.scene.add
        .text(numeral.x - centerX, numeral.y - centerY, String(this.count), {
          fontFamily: FONT_FAMILY,
          fontSize: `${Math.round(numeral.fontSize)}px`,
          fontStyle: NUMERAL_STYLE.fontWeight,
          color: this.color,
        })
        .setOrigin(0.5);
      this.container.add(this.label);
    }
  }

  /** Smaže tečky, záře i číslo karty. */
  private clearContent(): void {
    for (const item of [...this.dotCircles, ...this.glows, ...this.linkParts]) {
      this.scene.tweens.killTweensOf(item);
      item.destroy();
    }
    this.dotCircles = [];
    this.glows = [];
    this.linkParts = [];
    this.label?.destroy();
    this.label = null;
  }

  /**
   * Nápověda (#180): karta ukáže tečky nápovědy (u samotného čísla nově
   * pod číslem, s `animate` naskočí). Spárování a rozsvícení řídí scéna
   * přes `pairDot` a `lightExtras`.
   */
  showHint(dots: readonly HintDot[], numeral: Numeral | null, animate: boolean): void {
    const hadDots = this.dotCircles.length > 0;
    this.clearContent();
    this.hintDots = dots;
    this.drawContent(dots, numeral);
    if (animate && !hadDots) {
      for (const circle of this.dotCircles) {
        circle.setScale(0);
        this.scene.tweens.add({
          targets: circle,
          scale: 1,
          duration: HINT_STYLE.dotsAppearMs,
          ease: 'Back.easeOut',
        });
      }
    }
  }

  /** Tečka dvojice `pair` se spojí: krátce poskočí a ztlumí se. */
  pairDot(pair: number, animate: boolean): void {
    const index = this.hintDots.findIndex((dot) => dot.pair === pair);
    const circle = this.dotCircles[index];
    if (!circle) {
      return;
    }
    if (!animate) {
      circle.setAlpha(HINT_STYLE.pairedAlpha);
      return;
    }
    this.scene.tweens.killTweensOf(circle);
    circle.setScale(1);
    this.scene.tweens.add({
      targets: circle,
      scale: HINT_STYLE.popScale,
      duration: HINT_STYLE.popMs,
      yoyo: true,
      onComplete: () => circle.setAlpha(HINT_STYLE.pairedAlpha),
    });
  }

  /**
   * Kus spojení dvojice na kartě (souřadnice herní plochy): hned nad
   * podkladem karty, pod všemi tečkami, aby je čára nepřekryla.
   */
  addLinkPart(
    part: { readonly from: Point; readonly to: Point },
    width: number,
    color: string,
  ): Phaser.GameObjects.Graphics {
    const centerX = this.rect.left + this.rect.width / 2;
    const centerY = this.rect.top + this.rect.height / 2;
    const line = this.scene.add
      .graphics()
      .lineStyle(width, colorNumber(color))
      .lineBetween(
        part.from.x - centerX,
        part.from.y - centerY,
        part.to.x - centerX,
        part.to.y - centerY,
      );
    this.container.addAt(line, this.container.getIndex(this.background) + 1);
    this.linkParts.push(line);
    return line;
  }

  /** Tečky bez dvojice svítí: kolem nich pulzuje záře v barvě karty. */
  lightExtras(): void {
    const centerX = this.rect.left + this.rect.width / 2;
    const centerY = this.rect.top + this.rect.height / 2;
    for (const [index, dot] of this.hintDots.entries()) {
      const circle = this.dotCircles[index];
      if (dot.role !== 'extra' || !circle) {
        continue;
      }
      const glow = this.scene.add
        .circle(
          dot.x - centerX,
          dot.y - centerY,
          dot.glowRadius / HINT_STYLE.glowPulseScale,
          colorNumber(this.color),
          HINT_STYLE.glowAlpha,
        )
        .setScale(1);
      // Záře je pod tečkou, aby tečka zůstala ostrá.
      this.container.addAt(glow, this.container.getIndex(circle));
      this.glows.push(glow);
      this.scene.tweens.add({
        targets: glow,
        scale: HINT_STYLE.glowPulseScale,
        duration: HINT_STYLE.glowPulseMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  override destroy(): void {
    this.clearContent();
    super.destroy();
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
