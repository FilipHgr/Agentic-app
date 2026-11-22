import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { EquationLayout, Rect, SignButtonsLayout } from '../logic/compareLayout';
import type { CompareSign } from '../logic/compareProblems';
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

/** Okénko a písmo řady příkladu, stejné u „a ☐ b = c“ i „a ☐ b“ (#190). */
export type ProblemRowLayout = Pick<
  EquationLayout,
  'box' | 'boxHit' | 'fontSize' | 'signSize' | 'boxCornerRadius'
>;

/** Číslo nebo „=“ v řadě příkladu a jeho místo. */
export interface ProblemRowText {
  readonly rect: Rect;
  readonly text: string;
}

/**
 * Příklad „a ☐ b = c“ (#187) nebo „a ☐ b“ (#190): velká čísla (a „=“)
 * a okénko na místě znaménka. Okénko se po správné odpovědi vyplní znaménkem a zezelená, po
 * chybě v něm chvíli šedě problikne ťuknuté znaménko, okénko se zatřese
 * a vyprázdní. Ťuknutí na okénko (aspoň 64 px kolem středu) ohlásí `onBoxTap`.
 *
 * Při psaní (#188, `onBoxTap` je `null`) okénko ťuknutí nezachytává. Když
 * je okénko samo plochou na psaní (`boxIsPad`), prázdné se tu nekreslí
 * a zelené okénko po správné odpovědi se nakreslí přes plochu. Se
 * samostatnou plochou pod příkladem ukazuje okénko modře rozpoznané
 * znaménko (`showWritten`).
 */
export class EquationView {
  private readonly parts: Phaser.GameObjects.Text[];
  private readonly box: Phaser.GameObjects.Container;
  private readonly boxBackground: Phaser.GameObjects.Graphics;
  private readonly boxSign: Phaser.GameObjects.Text;
  private readonly boxHit: Phaser.GameObjects.Zone | null;
  /** Okénko je zelené se správným znaménkem. */
  private filled = false;
  /** Okénko se po chybě třese se šedým znaménkem; napsané znaménko počká. */
  private rejecting = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: ProblemRowLayout,
    private readonly unit: number,
    texts: readonly ProblemRowText[],
    onBoxTap: (() => void) | null,
    private readonly boxIsPad = false,
  ) {
    const { fontSize } = layout;
    const color = EQUATION_STYLE.color;
    this.parts = texts.map((part) => centeredText(scene, part.rect, part.text, fontSize, color));
    this.boxBackground = scene.add.graphics();
    this.boxSign = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(layout.signSize)}px`,
        fontStyle: SIGN_BOX_STYLE.fontWeight,
      })
      .setOrigin(0.5);
    this.box = scene.add
      .container(this.boxCenter.x, this.boxCenter.y, [this.boxBackground, this.boxSign])
      // Zelené okénko po správné odpovědi leží i přes plochu na psaní.
      .setDepth(1);
    this.boxHit = null;
    if (onBoxTap !== null) {
      const hit = layout.boxHit;
      this.boxHit = scene.add
        .zone(hit.left, hit.top, hit.width, hit.height)
        .setOrigin(0)
        .setInteractive();
      this.boxHit.on('pointerdown', onBoxTap);
    }
    this.empty();
  }

  /** Střed okénka: odtud vyletí hvězdička. */
  get boxCenter(): { x: number; y: number } {
    const { box } = this.layout;
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  /** Schová příklad pod kartou s mapou (#193), `false` ho ukáže beze změny. */
  setHidden(hidden: boolean): void {
    for (const part of this.parts) {
      part.setVisible(!hidden);
    }
    this.box.setVisible(!hidden);
    this.boxHit?.setVisible(!hidden);
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
    this.filled = true;
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
    this.rejecting = true;
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
        this.rejecting = false;
        this.empty();
      },
    });
  }

  /**
   * Rozpoznané napsané znaménko (#188) modře v prázdném okénku, dokud ho
   * dítě nepotvrdí; `null` okénko vyprázdní. Vyplněné okénko se nemění.
   */
  showWritten(sign: CompareSign | null): void {
    if (this.filled || this.rejecting) {
      return;
    }
    this.boxSign
      .setText(sign ?? '')
      .setColor(SIGN_BOX_STYLE.writtenSign)
      .setScale(1);
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
    this.boxHit?.destroy();
    for (const part of this.parts) {
      this.scene.tweens.killTweensOf(part);
      part.destroy();
    }
    this.box.destroy();
  }

  /** Zastaví zatřesení a vrátí okénko na místo. */
  private stopBox(): void {
    this.rejecting = false;
    this.scene.tweens.killTweensOf(this.box);
    this.scene.tweens.killTweensOf(this.boxSign);
    this.box.setPosition(this.boxCenter.x, this.boxCenter.y).setScale(1).setAngle(0);
  }

  /** Prázdné bílé okénko s šedým okrajem; při psaní ho kreslí plocha na psaní. */
  private empty(): void {
    this.boxSign.setText('');
    if (this.boxIsPad) {
      this.boxBackground.clear();
      return;
    }
    this.paintBox(SIGN_BOX_STYLE.fill, SIGN_BOX_STYLE.border);
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

/** Velké tlačítko se znaménkem (+ −, u „a ☐ b“ < = >) pod příkladem (#187 AC2, #190 AC4). */
export class SignButtonView {
  private readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    rect: Rect,
    layout: Pick<SignButtonsLayout, 'symbolSize' | 'cornerRadius'>,
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

  /** Schová tlačítko pod kartou s mapou (#193), `false` ho ukáže. */
  setHidden(hidden: boolean): void {
    this.container.setVisible(!hidden);
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
