import Phaser from 'phaser';

import type { AnswerRound } from '../logic/answerRound';
import { CHECK_BUTTON_COLOR, buttonCornerRadius, checkButtonStyle } from '../logic/checkButton';
import {
  CLEAR_ICON_COLOR,
  KEYPAD_BUTTON_STYLE,
  CONFIRM_BUTTON_STYLE,
  WRITING_PAD_STYLE,
} from '../logic/theme';
import { colorNumber } from '../../../shared/logic/theme';
import type { Stroke, StrokePoint } from '../logic/digitRecognition';
import type { DeviceWritingLayout } from '../logic/deviceLayout';
import type { ButtonSlot, WritingAreaSlot } from '../logic/screenLayout';
import {
  boxesWithRecognizer,
  boxFadingStrokes,
  boxStrokes,
  canConfirmBoxes,
  clearBoxes,
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  updateBoxes,
} from '../logic/twoBoxWriting';
import type { TwoBoxConfirmResult, TwoBoxRound, WritingBox } from '../logic/twoBoxWriting';
import { REJECTED_FADE_MS } from '../logic/writingRound';
import type { DigitRecognizer } from '../logic/writingRound';

/** Barvy jsou ve světlém vzhledu (#52) v `src/games/counting/logic/theme.ts`. */
const AREA_COLOR = colorNumber(WRITING_PAD_STYLE.background);
const AREA_BORDER_COLOR = colorNumber(WRITING_PAD_STYLE.borderColor);
const AREA_CORNER_RADIUS = 28;
const INK_COLOR = colorNumber(WRITING_PAD_STYLE.inkColor);
const INK_WIDTH = 16;

/** Smazat vypadá jako tlačítko číselníku, aby se nepletlo s bílým okénkem. */
const CLEAR_BACKGROUND = colorNumber(KEYPAD_BUTTON_STYLE.background);
const CLEAR_BORDER = colorNumber(KEYPAD_BUTTON_STYLE.borderColor);
const CLEAR_ICON = colorNumber(CLEAR_ICON_COLOR);
const TICK_COLOR = colorNumber(CONFIRM_BUTTON_STYLE.tickColor);

/** ✓ bez rozpoznané číslice je pobledlé, aby bylo vidět, že ještě nejde. */
const DISABLED_ALPHA = CONFIRM_BUTTON_STYLE.disabledAlpha;

/** O kolik se okénka zatřesou po špatné odpovědi. */
const SHAKE_DISTANCE = 14;

/** Body tahu blíž než tohle se nepřidávají (prst se chvěje). */
const MIN_POINT_DISTANCE = 3;

export interface WritingPadEvents {
  /** Změnilo se rozpoznané číslo (`null` = žádné). */
  readonly onNumberChanged: (number: number | null) => void;
  /** Dítě ťuklo na ✓ a odpověď se vyhodnotila. */
  readonly onConfirmed: (result: TwoBoxConfirmResult) => void;
}

/** Jedno okénko na obrazovce: pozadí, napsané tahy a blednoucí odmítnutý zápis. */
interface BoxView {
  readonly box: WritingBox;
  readonly slot: WritingAreaSlot;
  readonly container: Phaser.GameObjects.Container;
  /** Napsané tahy: kreslí se jednou do textury, ne znovu každý snímek. */
  readonly ink: Phaser.GameObjects.RenderTexture;
  readonly fadingInk: Phaser.GameObjects.Graphics;
  lastFading: readonly Stroke[];
}

/**
 * Okénka na psaní (jedno při rozsahu 5, desítky a jednotky při 10 a 20)
 * s tlačítky smazání a ✓. Kreslí tahy pod prstem a předává je logice
 * v `twoBoxWriting.ts`; o rozpoznání a správnosti nerozhoduje.
 */
export class WritingPad {
  private round: TwoBoxRound;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly views: BoxView[];
  /** Štětec, kterým se nové úseky tahu kreslí do textur; sám není vidět. */
  private readonly brush: Phaser.GameObjects.Graphics;
  private readonly confirmButton: Phaser.GameObjects.Container;
  private currentStroke: StrokePoint[] | undefined;
  private activeView: BoxView | undefined;
  private activePointerId: number | undefined;
  private lastNumber: number | null = null;
  private couldConfirm = false;
  private locked = false;
  /** Tloušťka čar a okrajů proti iPadu (na telefonu jiné jednotky, #54). */
  private readonly detailScale: number;

  /**
   * @param recognize Stažené rozpoznávání; `null`, dokud se stahuje (#58), zápis pak počká.
   * @param initialRound Stav okének po změně velikosti okna (#54); jinak prázdná okénka.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    layout: DeviceWritingLayout,
    answer: AnswerRound,
    recognize: DigitRecognizer | null,
    private readonly events: WritingPadEvents,
    initialRound?: TwoBoxRound,
  ) {
    const [first] = layout.writingAreas;
    const size = { width: first?.width ?? 0, height: first?.height ?? 0 };
    const round = initialRound ?? createTwoBoxRound(answer, size, recognize);
    this.round = recognize === null ? round : boxesWithRecognizer(round, recognize);
    this.detailScale = layout.detailScale;
    this.brush = scene.make.graphics({}, false);

    // Jediné okénko jsou jednotky, dvě okénka jsou desítky a jednotky.
    const boxes: WritingBox[] = layout.writingAreas.length === 2 ? ['tens', 'ones'] : ['ones'];
    this.views = layout.writingAreas.map((slot, index) =>
      this.createBoxView(boxes[index] ?? 'ones', slot),
    );
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);

    this.confirmButton = this.createConfirmButton(layout.confirmButton);
    const clearButton = this.createClearButton(layout.clearButton);
    this.objects.push(...this.views.map((view) => view.container), this.confirmButton, clearButton);
    this.paintConfirmButton();
  }

  /** Volá scéna každý snímek: rozpozná okénka po 1 s a nechá zmizet odmítnutý zápis. */
  update(nowMs: number): void {
    this.round = updateBoxes(this.round, nowMs);
    this.syncWithRound();
  }

  /** Rozpoznávání se stáhlo (#58): rozepsaný zápis se rozpozná při dalším snímku. */
  useRecognizer(recognize: DigitRecognizer): void {
    this.round = boxesWithRecognizer(this.round, recognize);
  }

  /** Po správné odpovědi se už nepíše, jen se čeká na nový příklad. */
  lock(): void {
    this.locked = true;
    this.paintConfirmButton();
  }

  /** Současný stav okének, aby přežil změnu velikosti okna (#54). */
  get state(): TwoBoxRound {
    return this.round;
  }

  /** Místo, odkud vyletí hvězdička za správnou odpověď. */
  get confirmPosition(): { x: number; y: number } {
    return { x: this.confirmButton.x, y: this.confirmButton.y };
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    for (const view of this.views) {
      this.scene.tweens.killTweensOf(view.fadingInk);
    }
    this.brush.destroy();
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
  }

  private createBoxView(box: WritingBox, slot: WritingAreaSlot): BoxView {
    const radius = AREA_CORNER_RADIUS * this.detailScale;
    const background = this.scene.add.graphics();
    background
      .fillStyle(AREA_COLOR, 1)
      .fillRoundedRect(-slot.width / 2, -slot.height / 2, slot.width, slot.height, radius)
      .lineStyle(WRITING_PAD_STYLE.borderWidth * this.detailScale, AREA_BORDER_COLOR, 1)
      .strokeRoundedRect(-slot.width / 2, -slot.height / 2, slot.width, slot.height, radius);
    const fadingInk = this.scene.add.graphics();
    const ink = this.scene.add
      .renderTexture(-slot.width / 2, -slot.height / 2, slot.width, slot.height)
      .setOrigin(0, 0);
    const container = this.scene.add.container(slot.x, slot.y, [background, fadingInk, ink]);
    const view: BoxView = { box, slot, container, ink, fadingInk, lastFading: [] };
    container.setSize(slot.width, slot.height).setInteractive();
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
      this.onPointerDown(view, pointer),
    );
    return view;
  }

  private onPointerDown(view: BoxView, pointer: Phaser.Input.Pointer): void {
    if (this.locked || this.activePointerId !== undefined) {
      return;
    }
    this.activePointerId = pointer.id;
    this.activeView = view;
    this.round = startBoxStroke(this.round, view.box, this.scene.time.now);
    this.currentStroke = [this.toBoxPoint(view, pointer)];
    this.syncWithRound();
    this.drawInk(view);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const view = this.activeView;
    if (pointer.id !== this.activePointerId || !this.currentStroke || !view) {
      return;
    }
    const point = this.toBoxPoint(view, pointer);
    const last = this.currentStroke[this.currentStroke.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_POINT_DISTANCE) {
      return;
    }
    this.currentStroke.push(point);
    // Jen nový úsek, celý zápis se nepřekresluje.
    if (last) {
      this.paintStrokes(view, [[last, point]]);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const view = this.activeView;
    if (pointer.id !== this.activePointerId || !this.currentStroke || !view) {
      return;
    }
    this.round = finishBoxStroke(this.round, this.currentStroke, this.scene.time.now);
    this.currentStroke = undefined;
    this.activePointerId = undefined;
    this.activeView = undefined;
    this.drawInk(view);
  }

  /**
   * Bod prstu v souřadnicích okénka: levý horní roh je 0, 0. Tah patří
   * okénku, ve kterém začal; prst mimo něj se přitáhne k jeho okraji.
   */
  private toBoxPoint(view: BoxView, pointer: Phaser.Input.Pointer): StrokePoint {
    const slot = view.slot;
    const x = pointer.worldX - (slot.x - slot.width / 2);
    const y = pointer.worldY - (slot.y - slot.height / 2);
    return {
      x: Phaser.Math.Clamp(x, 0, slot.width),
      y: Phaser.Math.Clamp(y, 0, slot.height),
    };
  }

  /** Překreslí ukázané číslo, ✓ a odmítnuté zápisy podle stavu logiky. */
  private syncWithRound(): void {
    this.paintConfirmButton();
    // ✓ poskočí, jakmile jde potvrdit (žluté číslo se může ukázat dřív).
    const canConfirm = !this.locked && canConfirmBoxes(this.round);
    if (canConfirm && !this.couldConfirm) {
      this.scene.tweens.add({
        targets: this.confirmButton,
        scale: 1.12,
        duration: 140,
        yoyo: true,
      });
    }
    this.couldConfirm = canConfirm;
    const number = shownNumber(this.round);
    if (number !== this.lastNumber) {
      this.lastNumber = number;
      this.events.onNumberChanged(number);
    }

    for (const view of this.views) {
      const fading = boxFadingStrokes(this.round, view.box);
      if (fading !== view.lastFading) {
        view.lastFading = fading;
        if (fading.length > 0) {
          this.startFading(view, fading);
        }
        this.drawInk(view);
      }
    }
  }

  /** Odmítnutý zápis v okénku vybledne a zmizí (jinak než zatřesení po chybě). */
  private startFading(view: BoxView, strokes: readonly Stroke[]): void {
    this.scene.tweens.killTweensOf(view.fadingInk);
    view.fadingInk.clear().setAlpha(1);
    this.drawStrokes(view.fadingInk, strokes, -view.slot.width / 2, -view.slot.height / 2);
    this.scene.tweens.add({
      targets: view.fadingInk,
      alpha: 0,
      duration: REJECTED_FADE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => view.fadingInk.clear(),
    });
  }

  /** Překreslí celý zápis okénka (po smazání, odmítnutí nebo konci tahu). */
  private drawInk(view: BoxView): void {
    view.ink.clear();
    const written = boxStrokes(this.round, view.box);
    const strokes =
      this.currentStroke && this.activeView === view ? [...written, this.currentStroke] : written;
    this.paintStrokes(view, strokes);
  }

  /** Domaluje tahy do textury okénka. */
  private paintStrokes(view: BoxView, strokes: readonly Stroke[]): void {
    this.brush.clear();
    this.drawStrokes(this.brush, strokes, 0, 0);
    view.ink.draw(this.brush);
  }

  /** Tahy v souřadnicích okénka, posunuté o `left`, `top`. */
  private drawStrokes(
    graphics: Phaser.GameObjects.Graphics,
    strokes: readonly Stroke[],
    left: number,
    top: number,
  ): void {
    const inkWidth = INK_WIDTH * this.detailScale;
    graphics.lineStyle(inkWidth, INK_COLOR, 1).fillStyle(INK_COLOR, 1);

    for (const stroke of strokes) {
      const [first, ...rest] = stroke;
      if (!first) {
        continue;
      }
      // Kulatá tečka na každém bodě dá hladký tah bez zubatých spojů.
      graphics.fillCircle(left + first.x, top + first.y, inkWidth / 2);
      graphics.beginPath().moveTo(left + first.x, top + first.y);
      for (const point of rest) {
        graphics.lineTo(left + point.x, top + point.y);
      }
      graphics.strokePath();
      for (const point of rest) {
        graphics.fillCircle(left + point.x, top + point.y, inkWidth / 2);
      }
    }
  }

  private createConfirmButton(slot: ButtonSlot): Phaser.GameObjects.Container {
    const half = slot.size / 2;
    const checkStyle = checkButtonStyle(slot.size);
    const background = this.scene.add.graphics();
    background
      .fillStyle(CHECK_BUTTON_COLOR, 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, checkStyle.cornerRadius);
    const tick = this.scene.add.graphics();
    tick
      .lineStyle(checkStyle.tickWidth, TICK_COLOR, 1)
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
    const radius = buttonCornerRadius(slot.size);
    const border = KEYPAD_BUTTON_STYLE.borderWidth * this.detailScale;
    background
      .fillStyle(CLEAR_BACKGROUND, 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, radius)
      .lineStyle(border, CLEAR_BORDER, 1)
      .strokeRoundedRect(
        -half + border / 2,
        -half + border / 2,
        slot.size - border,
        slot.size - border,
        radius - border / 2,
      );

    // Mazací klávesa: pětiúhelník se šipkou doleva a křížkem uvnitř.
    const unit = slot.size / 120;
    const icon = this.scene.add.graphics();
    icon
      .lineStyle(8 * unit, CLEAR_ICON, 1)
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
    this.round = clearBoxes(this.round);
    this.currentStroke = undefined;
    this.activePointerId = undefined;
    this.activeView = undefined;
    this.syncWithRound();
    this.redrawAll();
  }

  private onConfirmTapped(): void {
    if (this.locked || !canConfirmBoxes(this.round)) {
      // Nedá se potvrdit: ✓ jen kývne, aby dítě vidělo, že ťuknutí dorazilo.
      this.scene.tweens.add({ targets: this.confirmButton, angle: 8, duration: 60, yoyo: true });
      return;
    }

    const result = confirmBoxes(this.round);
    this.round = result.round;
    if (result.outcome === 'wrong') {
      // Logika okénka už vyprázdnila; na obrazovce se ještě zatřesou a pak zmizí.
      this.shakeBoxes(() => this.redrawAll());
    }
    this.events.onConfirmed(result);
  }

  private redrawAll(): void {
    for (const view of this.views) {
      this.drawInk(view);
    }
  }

  private shakeBoxes(onDone: () => void): void {
    const containers = this.views.map((view) => view.container);
    this.scene.tweens.killTweensOf(containers);
    this.views.forEach((view) => (view.container.x = view.slot.x));
    this.scene.tweens.add({
      targets: containers,
      x: `+=${SHAKE_DISTANCE * this.detailScale}`,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.views.forEach((view) => (view.container.x = view.slot.x));
        onDone();
      },
    });
  }

  private paintConfirmButton(): void {
    const enabled = !this.locked && canConfirmBoxes(this.round);
    this.confirmButton.setAlpha(enabled ? 1 : DISABLED_ALPHA);
  }
}
