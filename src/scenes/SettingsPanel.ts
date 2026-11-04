import Phaser from 'phaser';

import { CHECK_BUTTON_COLOR, checkButtonStyle } from '../logic/checkButton';
import type { ButtonSlot } from '../logic/screenLayout';
import { PENCIL_ICON, SETTINGS_LABEL_COLOR, layoutSettingsPanel } from '../logic/settingsLayout';
import type { SettingsOptionSlot, SettingsRowLabel } from '../logic/settingsLayout';
import {
  CLOSED_SETTINGS,
  chooseOption,
  openSettings,
  selectedOptions,
} from '../logic/settingsSession';
import type { SettingsSession } from '../logic/settingsSession';
import type { AnswerInput, GameSettings, MaxNumber, OperationMode } from '../logic/settings';

const BACKDROP_COLOR = 0x0f3d24;
const OPTION_COLOR = 0xffffff;
const OPTION_SELECTED_COLOR = 0xffd54f;
const OPTION_TEXT_COLOR = '#1f6f43';
const OPTION_ICON_COLOR = 0x1f6f43;
const OPTION_RADIUS = 28;

/** Jak dlouho panel naběhne; stránka kolem ztmavne stejně rychle (#45). */
const PANEL_FADE_MS = 150;

/** Panel je nad vším ostatním, aby ťuknutí nepropadla do hry pod ním. */
const PANEL_DEPTH = 100;

/** Popisky voleb: jen čísla a znaménka, žádný text ke čtení. Psaní je kreslená tužka. */
const MAX_NUMBER_LABELS: Record<MaxNumber, string> = { 5: '5', 10: '10', 20: '20' };
const OPERATION_LABELS: Record<OperationMode, string> = {
  plus: '+',
  minus: '−',
  mixed: '+ −',
};
const ANSWER_INPUT_LABELS: Record<AnswerInput, string | null> = { keypad: '123', writing: null };

interface OptionButton {
  readonly slot: SettingsOptionSlot;
  readonly background: Phaser.GameObjects.Graphics;
  readonly isSelected: () => boolean;
}

/**
 * Obrazovka nastavení pro rodiče: řada rozsahů (5, 10, 20), řada druhů
 * příkladů (+, −, + −), způsob odpovědi (číselník, psaní) a potvrzovací „✓“.
 * Vybrané volby jsou žluté. Rozměry jsou v `src/logic/settingsLayout.ts`.
 */
export class SettingsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly options: OptionButton[] = [];
  private session: SettingsSession;

  constructor(
    private readonly scene: Phaser.Scene,
    current: GameSettings,
    private readonly onConfirm: (session: SettingsSession) => void,
  ) {
    this.session = openSettings(CLOSED_SETTINGS, current);
    const { width, height } = scene.scale;
    const layout = layoutSettingsPanel(width, height);

    // Neprůhledné pozadí stejné barvy jako stránka (#45) zachytí všechna
    // ťuknutí, takže hra pod panelem nic nedostane.
    const backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, BACKDROP_COLOR, 1)
      .setInteractive();
    this.container = scene.add.container(0, 0, [backdrop]).setDepth(PANEL_DEPTH);

    const [maxNumberRow, operationsRow, answerInputRow] = layout.rows;
    for (const row of layout.rows) {
      this.addLabel(row.label);
    }
    for (const slot of maxNumberRow.options) {
      const maxNumber = slot.value as MaxNumber;
      this.addOption(slot, MAX_NUMBER_LABELS[maxNumber], { maxNumber });
    }
    for (const slot of operationsRow.options) {
      const operations = slot.value as OperationMode;
      this.addOption(slot, OPERATION_LABELS[operations], { operations });
    }
    for (const slot of answerInputRow.options) {
      const answerInput = slot.value as AnswerInput;
      this.addOption(slot, ANSWER_INPUT_LABELS[answerInput], { answerInput });
    }
    this.addConfirmButton(layout.confirm);
    this.repaint();

    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /** Popisek řady pro rodiče (#47): jen text, na ťuknutí nereaguje. */
  private addLabel(label: SettingsRowLabel): void {
    const text = this.scene.add
      .text(label.x, label.y, label.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${label.fontSize}px`,
        color: SETTINGS_LABEL_COLOR,
      })
      .setOrigin(0.5);
    this.container.add(text);
  }

  /** Volba s popiskem; bez popisku (psaní) se nakreslí tužka. */
  private addOption(
    slot: SettingsOptionSlot,
    label: string | null,
    change: Partial<GameSettings>,
  ): void {
    const background = this.scene.add.graphics();
    const content = label === null ? this.createPencil() : this.createLabel(label);
    const button = this.scene.add
      .container(slot.x, slot.y, [background, content])
      .setSize(slot.width, slot.height)
      .setInteractive();

    button.on('pointerdown', () => {
      this.session = chooseOption(this.session, change);
      this.repaint();
      this.scene.tweens.add({ targets: button, scale: 1.08, duration: 90, yoyo: true });
    });

    this.options.push({ slot, background, isSelected: () => this.isSelected(change) });
    this.container.add(button);
  }

  private createLabel(label: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '84px',
        color: OPTION_TEXT_COLOR,
      })
      .setOrigin(0.5);
  }

  /** Tužka šikmo hrotem vlevo dole, kreslená čarou, aby nezávisela na písmu. */
  private createPencil(): Phaser.GameObjects.Graphics {
    const { tip, tail, strokeWidth } = PENCIL_ICON;
    const length = Math.hypot(tail.x - tip.x, tail.y - tip.y);
    const along = { x: (tail.x - tip.x) / length, y: (tail.y - tip.y) / length };
    const across = { x: -along.y, y: along.x };
    const half = strokeWidth * 1.1;
    const tipLength = strokeWidth * 2;
    const at = (distance: number, side: number) => ({
      x: tip.x + along.x * distance + across.x * side,
      y: tip.y + along.y * distance + across.y * side,
    });

    const pencil = this.scene.add.graphics();
    pencil.lineStyle(strokeWidth, OPTION_ICON_COLOR, 1);
    // Tělo tužky: obdélník od hrotu k zadnímu konci, hrot je plný trojúhelník.
    const bodyLeft = at(tipLength, half);
    const bodyRight = at(tipLength, -half);
    const endRight = at(length, -half);
    const endLeft = at(length, half);
    pencil.strokePoints(
      [bodyLeft, endLeft, endRight, bodyRight].map(
        (point) => new Phaser.Math.Vector2(point.x, point.y),
      ),
      true,
    );
    pencil.fillStyle(OPTION_ICON_COLOR, 1);
    pencil.fillTriangle(bodyLeft.x, bodyLeft.y, bodyRight.x, bodyRight.y, tip.x, tip.y);
    return pencil;
  }

  private isSelected(change: Partial<GameSettings>): boolean {
    const selected = selectedOptions(this.session);
    if (!selected) {
      return false;
    }
    return Object.entries(change).every(
      ([key, value]) => selected[key as keyof typeof selected] === value,
    );
  }

  private addConfirmButton(slot: ButtonSlot): void {
    const { cornerRadius, tickWidth } = checkButtonStyle(slot.size);
    const half = slot.size / 2;
    const background = this.scene.add.graphics();
    background
      .fillStyle(CHECK_BUTTON_COLOR, 1)
      .fillRoundedRect(-half, -half, slot.size, slot.size, cornerRadius);
    const tick = this.scene.add.graphics();
    tick
      .lineStyle(tickWidth, 0xffffff, 1)
      .beginPath()
      .moveTo(-slot.size * 0.27, 0)
      .lineTo(-slot.size * 0.07, slot.size * 0.2)
      .lineTo(slot.size * 0.28, -slot.size * 0.18)
      .strokePath();

    const button = this.scene.add
      .container(slot.x, slot.y, [background, tick])
      .setSize(slot.size, slot.size)
      .setInteractive();
    button.on('pointerdown', () => this.confirm());
    this.container.add(button);
  }

  /** Vybrané volby žlutě, ostatní bíle. */
  private repaint(): void {
    for (const option of this.options) {
      const { width, height } = option.slot;
      const color = option.isSelected() ? OPTION_SELECTED_COLOR : OPTION_COLOR;
      option.background
        .clear()
        .fillStyle(color, 1)
        .fillRoundedRect(-width / 2, -height / 2, width, height, OPTION_RADIUS);
    }
  }

  private confirm(): void {
    this.container.destroy();
    this.onConfirm(this.session);
  }
}
