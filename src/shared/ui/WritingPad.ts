import Phaser from 'phaser';

import { buttonCornerRadius, checkButtonStyle } from '../logic/padButtons';
import { FONT_FAMILY, colorNumber } from '../logic/theme';
import type { Stroke, StrokePoint } from '../logic/strokes';
import {
  REJECTED_FADE_MS,
  isNewRejection,
  WRITING_AREA_CORNER_RADIUS,
  WRITTEN_LABEL_HEIGHT_SHARE,
} from '../logic/writingBox';

/**
 * Plocha na psaní prstem (#41, #42, od #188 sdílená): okénka, tahy pod
 * prstem, smazání a ✓. Kreslí a předává tahy logice hry (`WritingPadModel`);
 * o rozpoznání a správnosti nerozhoduje. Počítání má dvě okénka na číslice,
 * Porovnávání jedno na znaménko.
 */

/** Okénko; `x` a `y` je jeho střed. */
export interface WritingPadArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Čtvercové tlačítko; `x` a `y` je jeho střed. */
export interface WritingPadButton {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface WritingPadLayout {
  readonly writingAreas: readonly WritingPadArea[];
  readonly clearButton: WritingPadButton;
  readonly confirmButton: WritingPadButton;
  /** Tloušťka čar a okrajů proti iPadu (herní jednotky na 1 CSS px). */
  readonly detailScale: number;
}

/** Barvy plochy a tlačítek (každá hra má vlastní vzhled, Počítání #52). */
export interface WritingPadLook {
  readonly areaBackground: string;
  readonly areaBorder: string;
  readonly areaBorderWidth: number;
  readonly ink: string;
  readonly clearBackground: string;
  readonly clearBorder: string;
  readonly clearBorderWidth: number;
  readonly clearIcon: string;
  readonly confirmBackground: string;
  readonly tick: string;
  /** ✓, které ještě nejde potvrdit, je pobledlé. */
  readonly disabledAlpha: number;
  /** Barva rozpoznané hodnoty ukázané v okénku (jen hry, které ji v okénku ukazují). */
  readonly label: string;
  /** Po správné odpovědi (`lock`) je pobledlé i smazání, nejen ✓. */
  readonly dimClearWhenLocked: boolean;
}

/** Výsledek ťuknutí na ✓: nový stav, jestli se okénka zatřesou, a co se ohlásí hře. */
export interface WritingPadConfirm<State, Result> {
  readonly state: State;
  readonly shake: boolean;
  readonly result: Result;
}

/**
 * Logika okének, kterou plocha volá. `area` je pořadí okénka v rozložení.
 * Všechny funkce vrací nový stav, nic nemění.
 */
export interface WritingPadModel<State, Result> {
  startStroke(state: State, area: number, nowMs: number): State;
  finishStroke(state: State, stroke: Stroke, nowMs: number): State;
  update(state: State, nowMs: number): State;
  clear(state: State): State;
  canConfirm(state: State): boolean;
  /** Vyhodnotí odpověď; volá se jen, když jde potvrdit. */
  confirm(state: State): WritingPadConfirm<State, Result>;
  /** Tahy zápisu v okénku. */
  strokes(state: State, area: number): readonly Stroke[];
  /** Nerozpoznaný zápis, který v okénku právě bledne. */
  fading(state: State, area: number): readonly Stroke[];
  /**
   * Rozpoznaná hodnota ukázaná v okénku místo tahů (Porovnávání ukáže
   * znaménko); `null` nechá vidět tahy. Bez funkce se ukazují vždy tahy.
   */
  label?(state: State, area: number): string | null;
}

export interface WritingPadEvents<State, Result> {
  /** Stav se posunul (každý snímek a po každém tahu). */
  readonly onChanged: (state: State) => void;
  /** Dítě ťuklo na ✓ a odpověď se vyhodnotila. */
  readonly onConfirmed: (result: Result) => void;
  /** Zápis v okénku se nerozpoznal a začal blednout. */
  readonly onRejected?: (area: number) => void;
}

const INK_WIDTH = 16;

/** O kolik se okénka zatřesou po špatné odpovědi. */
const SHAKE_DISTANCE = 14;

/** Body tahu blíž než tohle se nepřidávají (prst se chvěje). */
const MIN_POINT_DISTANCE = 3;

/** Zhoupnutí okének, když vyzývají psát znovu (stupně, ms jednoho kmitu). */
const SWAY_DEGREES = 6;
const SWAY_MS = 110;

/** Jedno okénko na obrazovce: pozadí, napsané tahy, blednoucí zápis a hodnota. */
interface BoxView {
  readonly index: number;
  readonly slot: WritingPadArea;
  readonly container: Phaser.GameObjects.Container;
  /** Napsané tahy: kreslí se jednou do textury, ne znovu každý snímek. */
  readonly ink: Phaser.GameObjects.RenderTexture;
  readonly fadingInk: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  lastFading: readonly Stroke[];
  lastLabel: string | null;
}

export class WritingPad<State, Result> {
  private state: State;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly views: BoxView[];
  /** Štětec, kterým se nové úseky tahu kreslí do textur; sám není vidět. */
  private readonly brush: Phaser.GameObjects.Graphics;
  private readonly confirmButton: Phaser.GameObjects.Container;
  private readonly clearButton: Phaser.GameObjects.Container;
  private currentStroke: StrokePoint[] | undefined;
  private activeView: BoxView | undefined;
  private activePointerId: number | undefined;
  private couldConfirm = false;
  private locked = false;
  /** Během zatřesení po chybě zůstane v okénku ukázaná hodnota. */
  private shaking = false;
  private readonly detailScale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    layout: WritingPadLayout,
    private readonly model: WritingPadModel<State, Result>,
    initialState: State,
    private readonly look: WritingPadLook,
    private readonly events: WritingPadEvents<State, Result>,
  ) {
    this.state = initialState;
    this.detailScale = layout.detailScale;
    this.brush = scene.make.graphics({}, false);
    this.views = layout.writingAreas.map((slot, index) => this.createBoxView(index, slot));
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);

    this.confirmButton = this.createConfirmButton(layout.confirmButton);
    this.clearButton = this.createClearButton(layout.clearButton);
    this.objects.push(
      ...this.views.map((view) => view.container),
      this.confirmButton,
      this.clearButton,
    );
    this.paintConfirmButton();
    this.paintLabels();
    // Zápis, který bledl už před otočením, dobledne, ale znovu se neohlásí.
    for (const view of this.views) {
      if (view.lastFading.length > 0) {
        this.startFading(view, view.lastFading);
      }
    }
  }

  /** Volá scéna každý snímek: posune logiku v čase a překreslí, co se změnilo. */
  update(nowMs: number): void {
    this.state = this.model.update(this.state, nowMs);
    this.syncWithState();
  }

  /** Změní stav mimo tahy (např. staženým rozpoznáváním); překreslí se při dalším snímku. */
  replaceState(change: (state: State) => State): void {
    this.state = change(this.state);
  }

  /** Po správné odpovědi se už nepíše, jen se čeká na nový příklad. */
  lock(): void {
    this.locked = true;
    this.paintConfirmButton();
    if (this.look.dimClearWhenLocked) {
      this.clearButton.setAlpha(this.look.disabledAlpha);
    }
  }

  /** Překreslí zápis všech okének (např. rozepsaný zápis po otočení zařízení). */
  redrawInk(): void {
    this.redrawAll();
  }

  /** Současný stav okének, aby přežil změnu velikosti okna (#54). */
  get current(): State {
    return this.state;
  }

  /** Místo, odkud vyletí hvězdička za správnou odpověď. */
  get confirmPosition(): { x: number; y: number } {
    return { x: this.confirmButton.x, y: this.confirmButton.y };
  }

  /** Okénka se zhoupnou do stran: vyzývají psát znovu, nic netrestají (#188). */
  sway(): void {
    const containers = this.views.map((view) => view.container);
    this.scene.tweens.killTweensOf(containers);
    containers.forEach((container) => container.setAngle(0));
    this.scene.tweens.add({
      targets: containers,
      angle: { from: -SWAY_DEGREES, to: SWAY_DEGREES },
      duration: SWAY_MS,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => containers.forEach((container) => container.setAngle(0)),
    });
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

  private createBoxView(index: number, slot: WritingPadArea): BoxView {
    const radius = WRITING_AREA_CORNER_RADIUS * this.detailScale;
    const background = this.scene.add.graphics();
    background
      .fillStyle(colorNumber(this.look.areaBackground), 1)
      .fillRoundedRect(-slot.width / 2, -slot.height / 2, slot.width, slot.height, radius)
      .lineStyle(this.look.areaBorderWidth * this.detailScale, colorNumber(this.look.areaBorder), 1)
      .strokeRoundedRect(-slot.width / 2, -slot.height / 2, slot.width, slot.height, radius);
    const fadingInk = this.scene.add.graphics();
    const ink = this.scene.add
      .renderTexture(-slot.width / 2, -slot.height / 2, slot.width, slot.height)
      .setOrigin(0, 0);
    const label = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(slot.height * WRITTEN_LABEL_HEIGHT_SHARE)}px`,
        fontStyle: 'bold',
        color: this.look.label,
      })
      .setOrigin(0.5)
      .setVisible(false);
    const container = this.scene.add.container(slot.x, slot.y, [background, fadingInk, ink, label]);
    const view: BoxView = {
      index,
      slot,
      container,
      ink,
      fadingInk,
      label,
      lastFading: this.model.fading(this.state, index),
      lastLabel: null,
    };
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
    this.state = this.model.startStroke(this.state, view.index, this.scene.time.now);
    this.currentStroke = [this.toBoxPoint(view, pointer)];
    this.syncWithState();
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
    this.state = this.model.finishStroke(this.state, this.currentStroke, this.scene.time.now);
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

  /** Překreslí ✓, ukázané hodnoty a nerozpoznané zápisy podle stavu logiky. */
  private syncWithState(): void {
    this.paintConfirmButton();
    // ✓ poskočí, jakmile jde potvrdit.
    const canConfirm = !this.locked && this.model.canConfirm(this.state);
    if (canConfirm && !this.couldConfirm) {
      this.scene.tweens.add({
        targets: this.confirmButton,
        scale: 1.12,
        duration: 140,
        yoyo: true,
      });
    }
    this.couldConfirm = canConfirm;
    this.events.onChanged(this.state);

    for (const view of this.views) {
      const fading = this.model.fading(this.state, view.index);
      if (fading !== view.lastFading) {
        const rejected = isNewRejection(view.lastFading, fading);
        view.lastFading = fading;
        if (rejected) {
          this.startFading(view, fading);
          this.events.onRejected?.(view.index);
        }
        this.drawInk(view);
      }
    }
    if (!this.shaking) {
      this.paintLabels();
    }
  }

  /**
   * Ukázaná hodnota v okénku místo tahů. Tahy zůstanou v textuře, takže
   * se po dalším dotyku vrátí a dítě může zápis dopsat (− na +).
   */
  private paintLabels(): void {
    for (const view of this.views) {
      const label = this.model.label?.(this.state, view.index) ?? null;
      if (label === view.lastLabel) {
        continue;
      }
      view.lastLabel = label;
      view.label.setText(label ?? '').setVisible(label !== null);
      view.ink.setVisible(label === null);
      if (label !== null) {
        // Rozpoznaná hodnota naskočí, aby dítě vidělo, že ji hra přečetla.
        this.scene.tweens.killTweensOf(view.label);
        view.label.setScale(0.6);
        this.scene.tweens.add({
          targets: view.label,
          scale: 1,
          duration: 180,
          ease: 'Back.easeOut',
        });
      }
    }
  }

  /** Nerozpoznaný zápis v okénku vybledne a zmizí (jinak než zatřesení po chybě). */
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
    const written = this.model.strokes(this.state, view.index);
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
    const ink = colorNumber(this.look.ink);
    graphics.lineStyle(inkWidth, ink, 1).fillStyle(ink, 1);

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

  private createConfirmButton(slot: WritingPadButton): Phaser.GameObjects.Container {
    const half = slot.size / 2;
    const checkStyle = checkButtonStyle(slot.size);
    const background = this.scene.add.graphics();
    background
      .fillStyle(colorNumber(this.look.confirmBackground), 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, checkStyle.cornerRadius);
    const tick = this.scene.add.graphics();
    tick
      .lineStyle(checkStyle.tickWidth, colorNumber(this.look.tick), 1)
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

  private createClearButton(slot: WritingPadButton): Phaser.GameObjects.Container {
    const half = slot.size / 2;
    const background = this.scene.add.graphics();
    const radius = buttonCornerRadius(slot.size);
    const border = this.look.clearBorderWidth * this.detailScale;
    background
      .fillStyle(colorNumber(this.look.clearBackground), 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, radius)
      .lineStyle(border, colorNumber(this.look.clearBorder), 1)
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
      .lineStyle(8 * unit, colorNumber(this.look.clearIcon), 1)
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
    this.state = this.model.clear(this.state);
    this.currentStroke = undefined;
    this.activePointerId = undefined;
    this.activeView = undefined;
    this.syncWithState();
    this.redrawAll();
  }

  private onConfirmTapped(): void {
    if (this.locked || !this.model.canConfirm(this.state)) {
      // Nedá se potvrdit: ✓ jen kývne, aby dítě vidělo, že ťuknutí dorazilo.
      this.scene.tweens.add({ targets: this.confirmButton, angle: 8, duration: 60, yoyo: true });
      return;
    }

    const confirmed = this.model.confirm(this.state);
    this.state = confirmed.state;
    if (confirmed.shake) {
      // Logika okénka už vyprázdnila; na obrazovce se ještě zatřesou a pak zmizí.
      this.shakeBoxes(() => this.redrawAll());
    }
    this.events.onConfirmed(confirmed.result);
  }

  private redrawAll(): void {
    for (const view of this.views) {
      this.drawInk(view);
    }
    this.paintLabels();
  }

  private shakeBoxes(onDone: () => void): void {
    const containers = this.views.map((view) => view.container);
    this.scene.tweens.killTweensOf(containers);
    this.views.forEach((view) => view.container.setPosition(view.slot.x, view.slot.y).setAngle(0));
    this.shaking = true;
    this.scene.tweens.add({
      targets: containers,
      x: `+=${SHAKE_DISTANCE * this.detailScale}`,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.views.forEach((view) => (view.container.x = view.slot.x));
        this.shaking = false;
        onDone();
      },
    });
  }

  private paintConfirmButton(): void {
    const enabled = !this.locked && this.model.canConfirm(this.state);
    this.confirmButton.setAlpha(enabled ? 1 : this.look.disabledAlpha);
  }
}
