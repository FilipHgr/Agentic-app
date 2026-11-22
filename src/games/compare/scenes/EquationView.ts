import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { EquationLayout, Rect, SignButtonsLayout } from '../logic/compareLayout';
import type { CompareProblem, CompareSign } from '../logic/compareProblems';
import { EQUATION_STYLE, SIGN_BOX_STYLE, SIGN_BUTTON_STYLE } from '../logic/theme';

/** Jak daleko a jak dlouho se okénko po chybě zatřese (CSS px, ms). */
const SHAKE_DISTANCE_CSS = 8;
const SHAKE_STEP_MS = 50;
const SHAKE_REPEATS = 3;
/** Znaménko po správné odpovědi naskočí ze zmenšení. */
const SIGN_POP_FROM = 0.3;
const SIGN_POP_MS = 220;
/** Tlačítko se po ťuknutí krátce zmáčkne. */
const PRESS_SCALE = 0.92;
const PRESS_MS = 80;
/** Okénko se po ťuknutí zhoupne do stran (stupně, ms jednoho kmitu). */
const SWAY_DEGREES = 8;
const SWAY_MS = 110;
/** Tlačítka se po ťuknutí na okénko krátce zvětší a rozzáří. */
const HIGHLIGHT_SCALE = 1.1;
const HIGHLIGHT_MS = 160;
const HIGHLIGHT_REPEATS = 1;
/** Nový příklad naskočí ze zmenšení. */
const PROBLEM_POP_FROM = 0.92;
const PROBLEM_POP_MS = 180;

/** Text na středu obdélníku. */
function centeredText(
  scene: Phaser.Scene,
  rect: Rect,
  text: string,
  fontSize: number,
  color: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(rect.left + rect.width / 2, rect.top + rect.height / 2, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.round(fontSize)}px`,
      fontStyle: EQUATION_STYLE.fontWeight,
      color,
    })
    .setOrigin(0.5);
}

/**
 * Příklad „a ☐ b = c“ (#187): velká čísla a „=“ a okénko na místě
 * znaménka. Okénko se po správné odpovědi vyplní znaménkem a zezelená, po
 * chybě v něm chvíli šedě problikne ťuknuté znaménko, okénko se zatřese
 * a vyprázdní. Ťuknutí na okénko (aspoň 64 px kolem středu) ohlásí `onBoxTap`.
 */
export class EquationView {
  private readonly parts: Phaser.GameObjects.Text[];
  private readonly box: Phaser.GameObjects.Container;
  private readonly boxBackground: Phaser.GameObjects.Graphics;
  private readonly boxSign: Phaser.GameObjects.Text;
  private readonly boxHit: Phaser.GameObjects.Zone;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: EquationLayout,
    private readonly unit: number,
    problem: CompareProblem,
    onBoxTap: () => void,
  ) {
    const { fontSize } = layout;
    const color = EQUATION_STYLE.color;
    this.parts = [
      centeredText(scene, layout.first, String(problem.a), fontSize, color),
      centeredText(scene, layout.second, String(problem.b), fontSize, color),
      centeredText(scene, layout.equals, '=', fontSize, color),
      centeredText(scene, layout.result, String(problem.result), fontSize, color),
    ];
    this.boxBackground = scene.add.graphics();
    this.boxSign = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(layout.signSize)}px`,
        fontStyle: SIGN_BOX_STYLE.fontWeight,
      })
      .setOrigin(0.5);
    this.box = scene.add.container(this.boxCenter.x, this.boxCenter.y, [
      this.boxBackground,
      this.boxSign,
    ]);
    const hit = layout.boxHit;
    this.boxHit = scene.add
      .zone(hit.left, hit.top, hit.width, hit.height)
      .setOrigin(0)
      .setInteractive();
    this.boxHit.on('pointerdown', onBoxTap);
    this.empty();
  }

  /** Střed okénka: odtud vyletí hvězdička. */
  get boxCenter(): { x: number; y: number } {
    const { box } = this.layout;
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  /** Nový příklad naskočí ze zmenšení. */
  popIn(): void {
    for (const target of [...this.parts, this.box]) {
      target.setScale(PROBLEM_POP_FROM);
      this.scene.tweens.add({
        targets: target,
        scale: 1,
        duration: PROBLEM_POP_MS,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Správně: znaménko v zeleném okénku; s `animate` naskočí. */
  fill(sign: CompareSign, animate: boolean): void {
    this.stopBox();
    this.paintBox(SIGN_BOX_STYLE.correctFill, SIGN_BOX_STYLE.correctFill);
    this.boxSign.setText(sign).setColor(SIGN_BOX_STYLE.correctSign).setScale(1);
    if (animate) {
      this.boxSign.setScale(SIGN_POP_FROM);
      this.scene.tweens.add({
        targets: this.boxSign,
        scale: 1,
        duration: SIGN_POP_MS,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Špatně: ťuknuté znaménko šedě, okénko se zatřese a pak vyprázdní. */
  reject(sign: CompareSign): void {
    this.stopBox();
    this.boxSign.setText(sign).setColor(SIGN_BOX_STYLE.wrongSign);
    const homeX = this.boxCenter.x;
    this.scene.tweens.add({
      targets: this.box,
      x: homeX + SHAKE_DISTANCE_CSS * this.unit,
      duration: SHAKE_STEP_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.box.setX(homeX);
        this.empty();
      },
    });
  }

  /** Ťuknutí na okénko: okénko se zhoupne do stran a vrátí se rovně. */
  sway(): void {
    this.stopBox();
    this.box.setAngle(0);
    this.scene.tweens.add({
      targets: this.box,
      angle: { from: -SWAY_DEGREES, to: SWAY_DEGREES },
      duration: SWAY_MS,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => this.box.setAngle(0),
    });
  }

  destroy(): void {
    this.stopBox();
    this.boxHit.destroy();
    for (const part of this.parts) {
      this.scene.tweens.killTweensOf(part);
      part.destroy();
    }
    this.box.destroy();
  }

  /** Zastaví zatřesení a vrátí okénko na místo. */
  private stopBox(): void {
    this.scene.tweens.killTweensOf(this.box);
    this.scene.tweens.killTweensOf(this.boxSign);
    this.box.setPosition(this.boxCenter.x, this.boxCenter.y).setScale(1).setAngle(0);
  }

  /** Prázdné bílé okénko s šedým okrajem. */
  private empty(): void {
    this.paintBox(SIGN_BOX_STYLE.fill, SIGN_BOX_STYLE.border);
    this.boxSign.setText('');
  }

  private paintBox(fill: string, border: string): void {
    const { width, height } = this.layout.box;
    const borderWidth = SIGN_BOX_STYLE.borderWidth * this.unit;
    const inset = borderWidth / 2;
    const radius = this.layout.boxCornerRadius;
    this.boxBackground
      .clear()
      .fillStyle(colorNumber(fill), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
      .lineStyle(borderWidth, colorNumber(border), 1)
      .strokeRoundedRect(
        -width / 2 + inset,
        -height / 2 + inset,
        width - borderWidth,
        height - borderWidth,
        radius - inset,
      );
  }
}

/** Velké tlačítko se znaménkem + nebo − pod příkladem (#187 AC2). */
export class SignButtonView {
  private readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    rect: Rect,
    layout: SignButtonsLayout,
    unit: number,
    sign: CompareSign,
    onTap: () => void,
  ) {
    const background = scene.add.graphics();
    const borderWidth = SIGN_BUTTON_STYLE.borderWidth * unit;
    const inset = borderWidth / 2;
    const { width, height } = rect;
    background
      .fillStyle(colorNumber(SIGN_BUTTON_STYLE.fill), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, layout.cornerRadius)
      .lineStyle(borderWidth, colorNumber(SIGN_BUTTON_STYLE.border), 1)
      .strokeRoundedRect(
        -width / 2 + inset,
        -height / 2 + inset,
        width - borderWidth,
        height - borderWidth,
        layout.cornerRadius - inset,
      );
    const label = scene.add
      .text(0, 0, sign, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(layout.symbolSize)}px`,
        fontStyle: SIGN_BUTTON_STYLE.fontWeight,
        color: SIGN_BUTTON_STYLE.symbolColor,
      })
      .setOrigin(0.5);
    this.container = scene.add
      .container(rect.left + width / 2, rect.top + height / 2, [background, label])
      .setSize(width, height)
      .setInteractive();
    this.container.on('pointerdown', () => {
      this.press();
      onTap();
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  /** Ťuknutí na okénko: tlačítko se dvakrát krátce zvětší, aby dítě vidělo, kam ťuknout. */
  highlight(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(1);
    this.scene.tweens.add({
      targets: this.container,
      scale: HIGHLIGHT_SCALE,
      duration: HIGHLIGHT_MS,
      yoyo: true,
      repeat: HIGHLIGHT_REPEATS,
      ease: 'Sine.easeInOut',
    });
  }

  /** Krátké zmáčknutí jako okamžitá odezva na ťuknutí. */
  private press(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(1);
    this.scene.tweens.add({
      targets: this.container,
      scale: PRESS_SCALE,
      duration: PRESS_MS,
      yoyo: true,
    });
  }
}
