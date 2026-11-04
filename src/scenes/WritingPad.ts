import Phaser from 'phaser';

import type { AnswerRound } from '../logic/answerRound';
import type { Stroke, StrokePoint } from '../logic/digitRecognition';
import type { ButtonSlot, WritingLayout } from '../logic/screenLayout';
import {
  REJECTED_FADE_MS,
  canConfirm,
  clearWriting,
  confirmWriting,
  createWritingRound,
  fadingStrokes,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  writtenStrokes,
} from '../logic/writingRound';
import type { ConfirmResult, WritingRound } from '../logic/writingRound';

const AREA_COLOR = 0x175a36;
const AREA_BORDER_COLOR = 0xffffff;
const AREA_CORNER_RADIUS = 28;
const INK_COLOR = 0xffffff;
const INK_WIDTH = 16;

const CONFIRM_COLOR = 0x8be04e;
const CLEAR_COLOR = 0xffffff;
const CLEAR_ICON_COLOR = 0x1f6f43;
const BUTTON_CORNER_RADIUS = 28;

/** ✓ bez rozpoznané číslice je pobledlé, aby bylo vidět, že ještě nejde. */
const DISABLED_ALPHA = 0.35;

/** Body tahu blíž než tohle se nepřidávají (prst se chvěje). */
const MIN_POINT_DISTANCE = 3;

export interface WritingPadEvents {
  /** Změnila se rozpoznaná číslice (`null` = žádná). */
  readonly onDigitChanged: (digit: number | null) => void;
  /** Dítě ťuklo na ✓ a odpověď se vyhodnotila. */
  readonly onConfirmed: (result: ConfirmResult) => void;
}

/**
 * Plocha na psaní s tlačítky smazání a ✓. Kreslí tahy pod prstem a předává
 * je logice ve `writingRound.ts`; o rozpoznání a správnosti nerozhoduje.
 */
export class WritingPad {
  private round: WritingRound;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly area: Phaser.GameObjects.Container;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly fadingInk: Phaser.GameObjects.Graphics;
  private readonly confirmButton: Phaser.GameObjects.Container;
  private currentStroke: StrokePoint[] | undefined;
  private activePointerId: number | undefined;
  private lastDigit: number | null = null;
  private lastFading: readonly Stroke[] = [];
  private locked = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: WritingLayout,
    answer: AnswerRound,
    private readonly events: WritingPadEvents,
  ) {
    const slot = layout.writingArea;
    this.round = createWritingRound(answer, { width: slot.width, height: slot.height });

    const background = scene.add.graphics();
    background
      .fillStyle(AREA_COLOR, 1)
      .fillRoundedRect(
        -slot.width / 2,
        -slot.height / 2,
        slot.width,
        slot.height,
        AREA_CORNER_RADIUS,
      )
      .lineStyle(4, AREA_BORDER_COLOR, 0.6)
      .strokeRoundedRect(
        -slot.width / 2,
        -slot.height / 2,
        slot.width,
        slot.height,
        AREA_CORNER_RADIUS,
      );
    this.fadingInk = scene.add.graphics();
    this.ink = scene.add.graphics();
    this.area = scene.add.container(slot.x, slot.y, [background, this.fadingInk, this.ink]);
    this.area.setSize(slot.width, slot.height).setInteractive();
    this.area.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);

    this.confirmButton = this.createConfirmButton(layout.confirmButton);
    const clearButton = this.createClearButton(layout.clearButton);
    this.objects.push(this.area, this.confirmButton, clearButton);
    this.paintConfirmButton();
  }

  /** Volá scéna každý snímek: rozpozná zápis po 1 s a nechá zmizet odmítnutý. */
  update(nowMs: number): void {
    this.round = updateWriting(this.round, nowMs);
    this.syncWithRound();
  }

  /** Po správné odpovědi se už nepíše, jen se čeká na nový příklad. */
  lock(): void {
    this.locked = true;
    this.paintConfirmButton();
  }

  /** Místo, odkud vyletí hvězdička za správnou odpověď. */
  get confirmPosition(): { x: number; y: number } {
    return { x: this.confirmButton.x, y: this.confirmButton.y };
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.locked || this.activePointerId !== undefined) {
      return;
    }
    this.activePointerId = pointer.id;
    this.round = startStroke(this.round, this.scene.time.now);
    this.currentStroke = [this.toAreaPoint(pointer)];
    this.syncWithRound();
    this.drawInk();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId || !this.currentStroke) {
      return;
    }
    const point = this.toAreaPoint(pointer);
    const last = this.currentStroke[this.currentStroke.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_POINT_DISTANCE) {
      return;
    }
    this.currentStroke.push(point);
    this.drawInk();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId || !this.currentStroke) {
      return;
    }
    this.round = finishStroke(this.round, this.currentStroke, this.scene.time.now);
    this.currentStroke = undefined;
    this.activePointerId = undefined;
    this.drawInk();
  }

  /** Bod prstu v souřadnicích plochy: levý horní roh je 0, 0. */
  private toAreaPoint(pointer: Phaser.Input.Pointer): StrokePoint {
    const slot = this.layout.writingArea;
    return {
      x: pointer.worldX - (slot.x - slot.width / 2),
      y: pointer.worldY - (slot.y - slot.height / 2),
    };
  }

  /** Překreslí ukázanou číslici, ✓ a odmítnutý zápis podle stavu logiky. */
  private syncWithRound(): void {
    const digit = shownDigit(this.round);
    if (digit !== this.lastDigit) {
      this.lastDigit = digit;
      this.paintConfirmButton();
      this.events.onDigitChanged(digit);
      if (digit !== null) {
        this.scene.tweens.add({
          targets: this.confirmButton,
          scale: 1.12,
          duration: 140,
          yoyo: true,
        });
      }
    }

    const fading = fadingStrokes(this.round);
    if (fading !== this.lastFading) {
      this.lastFading = fading;
      if (fading.length > 0) {
        this.startFading(fading);
      }
      this.drawInk();
    }
  }

  /** Odmítnutý zápis vybledne a zmizí (jinak než zatřesení po chybě). */
  private startFading(strokes: readonly Stroke[]): void {
    this.scene.tweens.killTweensOf(this.fadingInk);
    this.fadingInk.clear().setAlpha(1);
    this.drawStrokes(this.fadingInk, strokes);
    this.scene.tweens.add({
      targets: this.fadingInk,
      alpha: 0,
      duration: REJECTED_FADE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.fadingInk.clear(),
    });
  }

  private drawInk(): void {
    this.ink.clear();
    const strokes = this.currentStroke
      ? [...writtenStrokes(this.round), this.currentStroke]
      : writtenStrokes(this.round);
    this.drawStrokes(this.ink, strokes);
  }

  private drawStrokes(graphics: Phaser.GameObjects.Graphics, strokes: readonly Stroke[]): void {
    const slot = this.layout.writingArea;
    const left = -slot.width / 2;
    const top = -slot.height / 2;
    graphics.lineStyle(INK_WIDTH, INK_COLOR, 1).fillStyle(INK_COLOR, 1);

    for (const stroke of strokes) {
      const [first, ...rest] = stroke;
      if (!first) {
        continue;
      }
      // Kulatá tečka na každém bodě dá hladký tah bez zubatých spojů.
      graphics.fillCircle(left + first.x, top + first.y, INK_WIDTH / 2);
      graphics.beginPath().moveTo(left + first.x, top + first.y);
      for (const point of rest) {
        graphics.lineTo(left + point.x, top + point.y);
      }
      graphics.strokePath();
      for (const point of rest) {
        graphics.fillCircle(left + point.x, top + point.y, INK_WIDTH / 2);
      }
    }
  }

  private createConfirmButton(slot: ButtonSlot): Phaser.GameObjects.Container {
    const half = slot.size / 2;
    const background = this.scene.add.graphics();
    background
      .fillStyle(CONFIRM_COLOR, 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, BUTTON_CORNER_RADIUS);
    const tick = this.scene.add.graphics();
    tick
      .lineStyle(slot.size * 0.13, 0xffffff, 1)
      .beginPath()
      .moveTo(-slot.size * 0.27, 0)
      .lineTo(-slot.size * 0.07, slot.size * 0.2)
      .lineTo(slot.size * 0.28, -slot.size * 0.18)
      .strokePath();

    const button = this.scene.add.container(slot.x, slot.y, [background, tick]);
    button.setSize(slot.size, slot.size).setInteractive();
    button.on('pointerdown', () => this.onConfirmTapped());
    return button;
  }

  private createClearButton(slot: ButtonSlot): Phaser.GameObjects.Container {
    const half = slot.size / 2;
    const background = this.scene.add.graphics();
    background
      .fillStyle(CLEAR_COLOR, 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, BUTTON_CORNER_RADIUS);

    // Mazací klávesa: pětiúhelník se šipkou doleva a křížkem uvnitř.
    const unit = slot.size / 120;
    const icon = this.scene.add.graphics();
    icon
      .lineStyle(8 * unit, CLEAR_ICON_COLOR, 1)
      .strokePoints(
        [
          new Phaser.Math.Vector2(-40 * unit, 0),
          new Phaser.Math.Vector2(-18 * unit, -26 * unit),
          new Phaser.Math.Vector2(38 * unit, -26 * unit),
          new Phaser.Math.Vector2(38 * unit, 26 * unit),
          new Phaser.Math.Vector2(-18 * unit, 26 * unit),
        ],
        true,
      )
      .lineBetween(-2 * unit, -12 * unit, 22 * unit, 12 * unit)
      .lineBetween(-2 * unit, 12 * unit, 22 * unit, -12 * unit);

    const button = this.scene.add.container(slot.x, slot.y, [background, icon]);
    button.setSize(slot.size, slot.size).setInteractive();
    button.on('pointerdown', () => this.onClearTapped(button));
    return button;
  }

  private onClearTapped(button: Phaser.GameObjects.Container): void {
    this.scene.tweens.add({ targets: button, scale: 1.1, duration: 90, yoyo: true });
    if (this.locked) {
      return;
    }
    this.round = clearWriting(this.round);
    this.currentStroke = undefined;
    this.activePointerId = undefined;
    this.syncWithRound();
    this.drawInk();
  }

  private onConfirmTapped(): void {
    if (this.locked || !canConfirm(this.round)) {
      // Nedá se potvrdit: ✓ jen kývne, aby dítě vidělo, že ťuknutí dorazilo.
      this.scene.tweens.add({ targets: this.confirmButton, angle: 8, duration: 60, yoyo: true });
      return;
    }

    const result = confirmWriting(this.round);
    this.round = result.round;
    if (result.outcome === 'wrong') {
      // Logika zápis už smazala; na obrazovce se ještě zatřese a pak zmizí.
      this.shakeArea(() => this.drawInk());
    }
    this.events.onConfirmed(result);
  }

  private shakeArea(onDone: () => void): void {
    const homeX = this.layout.writingArea.x;
    this.scene.tweens.killTweensOf(this.area);
    this.area.x = homeX;
    this.scene.tweens.add({
      targets: this.area,
      x: homeX + 14,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.area.x = homeX;
        onDone();
      },
    });
  }

  private paintConfirmButton(): void {
    const enabled = !this.locked && canConfirm(this.round);
    this.confirmButton.setAlpha(enabled ? 1 : DISABLED_ALPHA);
  }
}
