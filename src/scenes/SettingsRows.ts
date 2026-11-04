import Phaser from 'phaser';

import { PENCIL_ICON, SETTINGS_LABEL_COLOR } from '../logic/settingsLayout';
import type {
  SettingsLayout,
  SettingsOptionSlot,
  SettingsRowKind,
  SettingsRowLabel,
} from '../logic/settingsLayout';
import type { SelectedOptions } from '../logic/settingsSession';
import type { AnswerInput, GameSettings, MaxNumber, OperationMode } from '../logic/settings';

const OPTION_COLOR = 0xffffff;
const OPTION_SELECTED_COLOR = 0xffd54f;
const OPTION_TEXT_COLOR = '#1f6f43';
const OPTION_ICON_COLOR = 0x1f6f43;
const OPTION_RADIUS = 28;

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
  readonly button: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly change: Partial<GameSettings>;
}

interface RowView {
  readonly label: Phaser.GameObjects.Text;
  readonly options: OptionButton[];
  tappable: boolean;
}

/**
 * Tři řady voleb nastavení s popisky (#45, #47). Sdílí je nastavení
 * otevřené kolečkem i průvodce při prvním spuštění (#49); o tom, co je
 * vybrané a co se stane po ťuknutí, rozhoduje volající.
 */
export class SettingsRows {
  private readonly rows = new Map<SettingsRowKind, RowView>();

  constructor(
    private readonly scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    layout: SettingsLayout,
    private readonly selection: () => SelectedOptions | null,
    private readonly onChoose: (change: Partial<GameSettings>) => void,
  ) {
    for (const row of layout.rows) {
      const label = this.createRowLabel(row.label);
      container.add(label);
      const options = row.options.map((slot) => {
        const option = this.createOption(slot, changeFor(row.kind, slot));
        container.add(option.button);
        return option;
      });
      this.rows.set(row.kind, { label, options, tappable: true });
    }
    this.repaint();
  }

  /** Vzhled řady v průvodci: viditelnost, průhlednost a jestli reaguje na ťuknutí. */
  setRowStyle(kind: SettingsRowKind, visible: boolean, opacity: number, tappable: boolean): void {
    const row = this.rows.get(kind);
    if (!row) {
      return;
    }
    row.tappable = tappable;
    for (const object of [row.label, ...row.options.map((option) => option.button)]) {
      object.setVisible(visible).setAlpha(opacity);
    }
  }

  /** Vybrané volby žlutě, ostatní bíle. */
  repaint(): void {
    for (const row of this.rows.values()) {
      for (const option of row.options) {
        const { width, height } = option.slot;
        const color = this.isSelected(option.change) ? OPTION_SELECTED_COLOR : OPTION_COLOR;
        option.background
          .clear()
          .fillStyle(color, 1)
          .fillRoundedRect(-width / 2, -height / 2, width, height, OPTION_RADIUS);
      }
    }
  }

  /** Popisek řady pro rodiče (#47): jen text, na ťuknutí nereaguje. */
  private createRowLabel(label: SettingsRowLabel): Phaser.GameObjects.Text {
    return this.scene.add
      .text(label.x, label.y, label.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${label.fontSize}px`,
        color: SETTINGS_LABEL_COLOR,
      })
      .setOrigin(0.5);
  }

  /** Volba s popiskem; bez popisku (psaní) se nakreslí tužka. */
  private createOption(slot: SettingsOptionSlot, change: Partial<GameSettings>): OptionButton {
    const background = this.scene.add.graphics();
    const text = optionLabel(slot);
    const content = text === null ? this.createPencil() : this.createOptionText(text);
    const button = this.scene.add
      .container(slot.x, slot.y, [background, content])
      .setSize(slot.width, slot.height)
      .setInteractive();
    const option: OptionButton = { slot, button, background, change };

    button.on('pointerdown', () => {
      if (!this.isTappable(option)) {
        return;
      }
      this.onChoose(change);
      this.repaint();
      this.scene.tweens.add({
        targets: button,
        scale: { from: 1, to: 1.08 },
        duration: 90,
        yoyo: true,
      });
    });
    return option;
  }

  private isTappable(option: OptionButton): boolean {
    for (const row of this.rows.values()) {
      if (row.options.includes(option)) {
        return row.tappable;
      }
    }
    return false;
  }

  private createOptionText(text: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, text, {
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
    const selected = this.selection();
    if (!selected) {
      return false;
    }
    return (
      (change.maxNumber === undefined || change.maxNumber === selected.maxNumber) &&
      (change.operations === undefined || change.operations === selected.operations) &&
      (change.answerInput === undefined || change.answerInput === selected.answerInput)
    );
  }
}

/** Co se změní ťuknutím na volbu v dané řadě. */
function changeFor(kind: SettingsRowKind, slot: SettingsOptionSlot): Partial<GameSettings> {
  switch (kind) {
    case 'maxNumber':
      return { maxNumber: slot.value as MaxNumber };
    case 'operations':
      return { operations: slot.value as OperationMode };
    case 'answerInput':
      return { answerInput: slot.value as AnswerInput };
  }
}

/** Popisek volby; `null` znamená kreslenou tužku. */
function optionLabel(slot: SettingsOptionSlot): string | null {
  const value = slot.value;
  if (value === 5 || value === 10 || value === 20) {
    return MAX_NUMBER_LABELS[value];
  }
  if (value === 'plus' || value === 'minus' || value === 'mixed') {
    return OPERATION_LABELS[value];
  }
  return ANSWER_INPUT_LABELS[value];
}
