import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { drawPencilIcon } from '../../../shared/ui/pencilIcon';
import { isAnswerInput, isMaxNumber } from '../logic/compareSettings';
import type { AnswerInput } from '../logic/compareSettings';
import type { CompareSettings } from '../logic/compareSettings';
import { layoutCompareSettings } from '../logic/compareSettingsLayout';
import type {
  CompareSettingsLayout,
  SettingsOptionSlot,
  SettingsRowKind,
  SettingsRowLabel,
} from '../logic/compareSettingsLayout';
import {
  CONFIRM_BUTTON_STYLE,
  SETTINGS_LABEL_COLOR,
  SETTINGS_OPTION_STYLE,
  SETTINGS_PANEL_BACKGROUND,
} from '../logic/theme';

/** Panel je nad vším ostatním, aby ťuknutí nepropadla do hry pod ním. */
const PANEL_DEPTH = 100;
const PANEL_FADE_MS = 150;
/** Zhoupnutí volby po ťuknutí. */
const OPTION_BOUNCE_SCALE = 1.08;
const OPTION_BOUNCE_MS = 90;

/**
 * Volby řady „Odpověď“ (#188 AC1) se stejnými symboly jako v Počítání:
 * ťuknutí „123“, psaní kreslená tužka (`null`). Žádný text ke čtení.
 */
const ANSWER_INPUT_LABELS: Readonly<Record<AnswerInput, string | null>> = {
  tap: '123',
  writing: null,
};

/** Co panel potřebuje od sezení hry. */
export interface SettingsPanelHost {
  /** Volby v otevřeném nastavení. */
  readonly choice: () => CompareSettings | null;
  readonly choose: (change: Partial<CompareSettings>) => void;
  readonly confirm: () => void;
}

interface OptionView {
  readonly change: Partial<CompareSettings>;
  readonly slot: SettingsOptionSlot;
  readonly background: Phaser.GameObjects.Graphics;
  /** Obsah volby, který se přebarví podle výběru (číslo nebo tužka). */
  readonly paint: (selected: boolean) => void;
}

/**
 * Nastavení Porovnávání pro rodiče (#179, #187, #188): řada „Do kolika“
 * (10, 20), řada „Odpověď“ (ťuknutí „123“, psaní tužka) a zelené ✓.
 * Vybrané volby jsou plně modré jako v Počítání. Rozměry jsou
 * v `compareSettingsLayout.ts`, co je vybrané a co ✓ udělá, řídí sezení hry.
 */
export class SettingsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private options: OptionView[] = [];
  private optionLook: CompareSettingsLayout['optionLook'] = { cornerRadius: 0, borderWidth: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    area: GameArea,
    private readonly host: SettingsPanelHost,
  ) {
    this.container = scene.add.container(0, 0).setDepth(PANEL_DEPTH);
    this.fitTo(area);
    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /** Po otočení nebo změně lišty se panel nakreslí podle nové plochy; volby zůstanou. */
  fitTo(area: GameArea): void {
    this.scene.tweens.killTweensOf(this.container.list);
    this.container.removeAll(true);
    // Neprůhledné pozadí stejné barvy jako stránka zachytí všechna ťuknutí.
    const backdrop = this.scene.add
      .rectangle(0, 0, area.width, area.height, colorNumber(SETTINGS_PANEL_BACKGROUND), 1)
      .setOrigin(0)
      .setInteractive();
    this.container.add(backdrop);
    const layout = layoutCompareSettings(area);
    this.optionLook = layout.optionLook;
    this.options = [];
    for (const row of layout.rows) {
      this.container.add(this.createLabel(row.label));
      for (const slot of row.options) {
        const option = this.createOption(row.kind, slot);
        if (option) {
          this.options.push(option);
        }
      }
    }
    this.container.add(this.createConfirm(layout.confirm));
    this.repaint();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  private createLabel(label: SettingsRowLabel): Phaser.GameObjects.Text {
    const alignRight = label.align === 'right';
    return this.scene.add
      .text(alignRight ? label.x + label.width / 2 : label.x, label.y, label.text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${label.fontSize}px`,
        color: SETTINGS_LABEL_COLOR,
      })
      .setOrigin(alignRight ? 1 : 0.5, 0.5);
  }

  /** Volba řady; hodnota, která do řady nepatří, se nenakreslí. */
  private createOption(kind: SettingsRowKind, slot: SettingsOptionSlot): OptionView | null {
    const change = changeOf(kind, slot.value);
    if (change === null) {
      return null;
    }
    const background = this.scene.add.graphics();
    const button = this.scene.add.container(slot.x, slot.y, [background]);
    const paint = this.addContent(button, slot);
    button.setSize(slot.width, slot.height).setInteractive();
    const option: OptionView = { change, slot, background, paint };
    button.on('pointerdown', () => {
      this.host.choose(change);
      this.repaint();
      this.scene.tweens.add({
        targets: button,
        scale: { from: 1, to: OPTION_BOUNCE_SCALE },
        duration: OPTION_BOUNCE_MS,
        yoyo: true,
      });
    });
    this.container.add(button);
    return option;
  }

  /** Číslo, „123“, nebo tužka uprostřed volby; vrátí přebarvení podle výběru. */
  private addContent(
    button: Phaser.GameObjects.Container,
    slot: SettingsOptionSlot,
  ): (selected: boolean) => void {
    const text = isAnswerInput(slot.value) ? ANSWER_INPUT_LABELS[slot.value] : String(slot.value);
    if (text === null) {
      // Tužka ve dvou barvách jako v Počítání: ukáže se ta podle výběru.
      const unselected = drawPencilIcon(
        this.scene,
        SETTINGS_OPTION_STYLE.unselected.content,
        slot.pencilSize,
      );
      const selected = drawPencilIcon(
        this.scene,
        SETTINGS_OPTION_STYLE.selected.content,
        slot.pencilSize,
      );
      button.add([unselected, selected]);
      return (isSelected) => {
        selected.setVisible(isSelected);
        unselected.setVisible(!isSelected);
      };
    }
    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(slot.fontSize)}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    button.add(label);
    return (isSelected) =>
      label.setColor(
        isSelected
          ? SETTINGS_OPTION_STYLE.selected.content
          : SETTINGS_OPTION_STYLE.unselected.content,
      );
  }

  private createConfirm(slot: CompareSettingsLayout['confirm']): Phaser.GameObjects.Container {
    const { size } = slot;
    const half = size / 2;
    const background = this.scene.add
      .graphics()
      .fillStyle(colorNumber(CONFIRM_BUTTON_STYLE.fill), 1)
      .fillRoundedRect(-half, -half, size, size, size * CONFIRM_BUTTON_STYLE.cornerShare);
    const tick = this.scene.add
      .graphics()
      .lineStyle(size * CONFIRM_BUTTON_STYLE.tickShare, colorNumber(CONFIRM_BUTTON_STYLE.tick), 1)
      .beginPath()
      .moveTo(-size * 0.27, 0)
      .lineTo(-size * 0.07, size * 0.2)
      .lineTo(size * 0.28, -size * 0.18)
      .strokePath();
    const button = this.scene.add
      .container(slot.x, slot.y, [background, tick])
      .setSize(size, size)
      .setInteractive();
    // Krátké zhoupnutí jako u voleb, panel se zavře až po něm (jen jednou).
    let confirming = false;
    button.on('pointerdown', () => {
      if (confirming) {
        return;
      }
      confirming = true;
      this.scene.tweens.add({
        targets: button,
        scale: { from: 1, to: OPTION_BOUNCE_SCALE },
        duration: OPTION_BOUNCE_MS,
        yoyo: true,
        onComplete: () => this.host.confirm(),
      });
    });
    return button;
  }

  /** Vybrané volby plně modře s bílým obsahem, ostatní světle modře. */
  private repaint(): void {
    const choice = this.host.choice();
    const { cornerRadius, borderWidth } = this.optionLook;
    for (const option of this.options) {
      const selected =
        choice !== null &&
        (option.change.maxNumber === undefined || option.change.maxNumber === choice.maxNumber) &&
        (option.change.answerInput === undefined ||
          option.change.answerInput === choice.answerInput);
      const look = selected ? SETTINGS_OPTION_STYLE.selected : SETTINGS_OPTION_STYLE.unselected;
      const { width, height } = option.slot;
      // Okraj se kreslí dovnitř, aby se velikost volby nezměnila.
      const inset = borderWidth / 2;
      option.background
        .clear()
        .fillStyle(colorNumber(look.fill), 1)
        .fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius)
        .lineStyle(borderWidth, colorNumber(look.border), 1)
        .strokeRoundedRect(
          -width / 2 + inset,
          -height / 2 + inset,
          width - borderWidth,
          height - borderWidth,
          cornerRadius - inset,
        );
      option.paint(selected);
    }
  }
}

/** Co ťuknutí na volbu změní; hodnota mimo nabídku řady dá `null`. */
function changeOf(kind: SettingsRowKind, value: unknown): Partial<CompareSettings> | null {
  switch (kind) {
    case 'maxNumber':
      return isMaxNumber(value) ? { maxNumber: value } : null;
    case 'answerInput':
      return isAnswerInput(value) ? { answerInput: value } : null;
  }
}
