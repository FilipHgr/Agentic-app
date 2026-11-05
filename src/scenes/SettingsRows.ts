import Phaser from 'phaser';

import { PENCIL_ICON } from '../logic/settingsLayout';
import type {
  SettingsLayout,
  SettingsOptionLookSizes,
  SettingsOptionSlot,
  SettingsRowKind,
  SettingsRowLabel,
} from '../logic/settingsLayout';
import type { SelectedOptions } from '../logic/settingsSession';
import type { AnswerInput, GameSettings, MaxNumber, OperationMode } from '../logic/settings';
import {
  FONT_FAMILY,
  SETTINGS_LABEL_COLOR,
  SETTINGS_OPTION_STYLE,
  colorNumber,
  settingsOptionLook,
} from '../logic/theme';

// Barvy voleb jsou ve světlém vzhledu (#53) v `src/logic/theme.ts`, velikosti v rozložení.

/** Popisky voleb: jen čísla a znaménka, žádný text ke čtení. Psaní je kreslená tužka. */
const MAX_NUMBER_LABELS: Record<MaxNumber, string> = { 5: '5', 10: '10', 20: '20' };
const OPERATION_LABELS: Record<OperationMode, string> = {
  plus: '+',
  minus: '−',
  mixed: '+ −',
};
const ANSWER_INPUT_LABELS: Record<AnswerInput, string | null> = { keypad: '123', writing: null };

/** Obsah volby: text, nebo tužka kreslená ve dvou barvách (vybraná a nevybraná). */
type OptionContent =
  | { readonly kind: 'text'; readonly text: Phaser.GameObjects.Text }
  | {
      readonly kind: 'pencil';
      readonly unselected: Phaser.GameObjects.Graphics;
      readonly selected: Phaser.GameObjects.Graphics;
    };

interface OptionButton {
  readonly slot: SettingsOptionSlot;
  readonly button: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly content: OptionContent;
  readonly change: Partial<GameSettings>;
}

interface RowView {
  readonly label: Phaser.GameObjects.Text;
  readonly options: OptionButton[];
  tappable: boolean;
}

/**
 * Tři řady voleb nastavení s popisky (#45, #47), světlý vzhled (#53). Sdílí je nastavení
 * otevřené kolečkem i průvodce při prvním spuštění (#49); o tom, co je
 * vybrané a co se stane po ťuknutí, rozhoduje volající.
 */
export class SettingsRows {
  private readonly rows = new Map<SettingsRowKind, RowView>();
  private readonly look: SettingsOptionLookSizes;

  constructor(
    private readonly scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    layout: SettingsLayout,
    private readonly selection: () => SelectedOptions | null,
    private readonly onChoose: (change: Partial<GameSettings>) => void,
  ) {
    this.look = layout.optionLook;
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

  /** Vybrané volby plně modře s bílým obsahem, ostatní světle modře (#53). */
  repaint(): void {
    for (const row of this.rows.values()) {
      for (const option of row.options) {
        this.paintOption(option, this.isSelected(option.change));
      }
    }
  }

  private paintOption(option: OptionButton, selected: boolean): void {
    const look = settingsOptionLook(selected);
    const { width, height } = option.slot;
    const radius = this.look.cornerRadius;
    const borderWidth = look.borderWidth * this.look.borderScale;
    // Okraj se kreslí dovnitř, aby se velikost volby nezměnila.
    const inset = borderWidth / 2;
    option.background
      .clear()
      .fillStyle(colorNumber(look.background), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
      .lineStyle(borderWidth, colorNumber(look.borderColor), 1)
      .strokeRoundedRect(
        -width / 2 + inset,
        -height / 2 + inset,
        width - borderWidth,
        height - borderWidth,
        radius - inset,
      );
    const content = option.content;
    if (content.kind === 'text') {
      content.text.setColor(look.textColor);
    } else {
      content.selected.setVisible(selected);
      content.unselected.setVisible(!selected);
    }
  }

  /**
   * Popisek řady pro rodiče (#47): jen text, na ťuknutí nereaguje. Na středu
   * pruhu, nebo zarovnaný k pravému okraji pruhu vedle řady (#59).
   */
  private createRowLabel(label: SettingsRowLabel): Phaser.GameObjects.Text {
    const alignRight = label.align === 'right';
    const x = alignRight ? label.x + label.width / 2 : label.x;
    return this.scene.add
      .text(x, label.y, label.text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${label.fontSize}px`,
        color: SETTINGS_LABEL_COLOR,
      })
      .setOrigin(alignRight ? 1 : 0.5, 0.5);
  }

  /** Volba s popiskem; bez popisku (psaní) se nakreslí tužka. */
  private createOption(slot: SettingsOptionSlot, change: Partial<GameSettings>): OptionButton {
    const background = this.scene.add.graphics();
    const text = optionLabel(slot);
    const content: OptionContent =
      text === null
        ? {
            kind: 'pencil',
            unselected: this.createPencil(SETTINGS_OPTION_STYLE.unselected.iconColor),
            selected: this.createPencil(SETTINGS_OPTION_STYLE.selected.iconColor),
          }
        : { kind: 'text', text: this.createOptionText(text, slot.fontSize) };
    const parts = content.kind === 'text' ? [content.text] : [content.unselected, content.selected];
    const button = this.scene.add
      .container(slot.x, slot.y, [background, ...parts])
      .setSize(slot.width, slot.height)
      .setInteractive();
    const option: OptionButton = { slot, button, background, content, change };

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

  private createOptionText(text: string, fontSize: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${fontSize}px`,
        color: SETTINGS_OPTION_STYLE.unselected.textColor,
      })
      .setOrigin(0.5);
  }

  /**
   * Tužka šikmo hrotem vlevo dole, kreslená čarou, aby nezávisela na písmu.
   * Zvětší se na velikost tužky z rozložení (na iPadu jako dnes).
   */
  private createPencil(colorHex: string): Phaser.GameObjects.Graphics {
    const color = colorNumber(colorHex);
    const zoom = this.look.pencilSize / PENCIL_ICON.width;
    const tip = { x: PENCIL_ICON.tip.x * zoom, y: PENCIL_ICON.tip.y * zoom };
    const tail = { x: PENCIL_ICON.tail.x * zoom, y: PENCIL_ICON.tail.y * zoom };
    const strokeWidth = PENCIL_ICON.strokeWidth * zoom;
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
    pencil.lineStyle(strokeWidth, color, 1);
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
    pencil.fillStyle(color, 1);
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
