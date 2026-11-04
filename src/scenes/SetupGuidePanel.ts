import Phaser from 'phaser';

import { buttonCornerRadius } from '../logic/checkButton';
import type { GameSettings } from '../logic/settings';
import { layoutSettingsPanel } from '../logic/settingsLayout';
import {
  GUIDE_COLORS,
  GUIDE_TEXTS,
  back,
  chooseGrade,
  chooseOption,
  finishGuide,
  guideMessage,
  guideRowStyle,
  guideSelection,
  hasBackButton,
  layoutGuideStep,
  next,
  rightButton,
  selectedGrade,
  skip,
  startGuide,
  stepIndicatorText,
  tickGuide,
} from '../logic/setupGuide';
import type { Grade, GuideLayout, GuideSlot, GuideState } from '../logic/setupGuide';
import { PANEL_DEPTH, PANEL_FADE_MS, SETTINGS_BACKDROP_COLOR } from './SettingsPanel';
import { SettingsRows } from './SettingsRows';

const ROW_KINDS = ['maxNumber', 'operations', 'answerInput'] as const;

/** Barvy jako čísla pro Phaser Graphics. */
const toColor = (hex: string): number => Number.parseInt(hex.slice(1), 16);

interface GuideButton {
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly slot: GuideSlot;
}

/**
 * Průvodce nastavením při prvním spuštění (#49): otázka na třídu, tři kroky
 * po řadách s radami a shrnutí s „Začít hrát“. O krocích a volbách rozhoduje
 * `src/logic/setupGuide.ts`, panel je jen kreslí.
 */
export class SetupGuidePanel {
  private guideState: GuideState = startGuide();

  /** Aktuální stav průvodce pro scénu (blokuje podržení kolečka, #49). */
  get state(): GuideState {
    return this.guideState;
  }

  private set state(value: GuideState) {
    this.guideState = value;
  }
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: SettingsRows;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly subheading: Phaser.GameObjects.Text;
  private readonly answers: { grade: Grade; button: GuideButton }[] = [];
  private readonly message: Phaser.GameObjects.Text;
  private readonly indicator: Phaser.GameObjects.Text;
  private readonly backButton: GuideButton;
  private readonly rightButton: GuideButton;
  private renderedState: GuideState | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onFinish: (settings: GameSettings) => void,
  ) {
    const { width, height } = scene.scale;
    const questionLayout = layoutGuideStep(1, width, height);
    const rowsLayout = layoutGuideStep(2, width, height);

    // Neprůhledné pozadí zachytí ťuknutí mimo ovládání průvodce.
    const backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, SETTINGS_BACKDROP_COLOR, 1)
      .setInteractive();
    this.container = scene.add.container(0, 0, [backdrop]).setDepth(PANEL_DEPTH);

    this.rows = new SettingsRows(
      scene,
      this.container,
      layoutSettingsPanel(width, height),
      () => guideSelection(this.state),
      (change) => {
        this.state = chooseOption(this.state, change);
      },
    );
    this.frame = scene.add.graphics();
    this.container.add(this.frame);

    this.heading = this.addText(questionLayout.heading, GUIDE_TEXTS.question);
    this.subheading = this.addText(questionLayout.subheading, GUIDE_TEXTS.questionNote);
    questionLayout.answers.forEach((slot) => {
      const button = this.addButton(slot, GUIDE_TEXTS.grades[slot.grade], () =>
        this.onGradeTapped(slot.grade),
      );
      this.answers.push({ grade: slot.grade, button });
    });

    this.message = this.addText(rowsLayout.message, '');
    this.message.setLineSpacing(
      (rowsLayout.message?.lineHeight ?? 0) - (rowsLayout.message?.fontSize ?? 0),
    );
    this.indicator = this.addText(rowsLayout.indicator, '');
    const backSlot = rowsLayout.back ?? rowsLayout.right;
    this.backButton = this.addButton(backSlot, GUIDE_TEXTS.buttons.back, () => this.onBack());
    this.rightButton = this.addButton(rowsLayout.right, '', () => this.onRight());

    this.render();
    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /** Volá scéna každý snímek: po zvýraznění odpovědi průvodce sám přejde dál. */
  update(nowMs: number): void {
    this.state = tickGuide(this.state, nowMs);
    if (this.state !== this.renderedState) {
      this.render();
    }
  }

  private onGradeTapped(grade: Grade): void {
    this.state = chooseGrade(this.state, grade, this.scene.time.now);
    this.render();
  }

  private onBack(): void {
    this.state = back(this.state);
    this.render();
  }

  private onRight(): void {
    const now = this.scene.time.now;
    switch (rightButton(this.state)) {
      case 'skip':
        this.state = skip(this.state, now);
        break;
      case 'next':
        this.state = next(this.state, now);
        break;
      case 'startPlaying': {
        const settings = finishGuide(this.state, now);
        if (settings) {
          this.container.destroy();
          this.onFinish(settings);
          return;
        }
        break;
      }
    }
    this.render();
  }

  /** Překreslí krok podle stavu z logiky. */
  private render(): void {
    this.renderedState = this.state;
    const { width, height } = this.scene.scale;
    const step = this.state.step;
    const layout = layoutGuideStep(step, width, height);
    const isQuestion = step === 1;

    this.heading.setVisible(isQuestion);
    this.subheading.setVisible(isQuestion);
    const chosen = selectedGrade(this.state);
    for (const { grade, button } of this.answers) {
      button.container.setVisible(isQuestion);
      this.paintButton(
        button,
        grade === chosen ? GUIDE_COLORS.selectedAnswerBackground : GUIDE_COLORS.buttonBackground,
      );
    }

    for (const kind of ROW_KINDS) {
      const style = guideRowStyle(this.state, kind);
      this.rows.setRowStyle(kind, style.visible, style.opacity, style.tappable);
    }
    this.rows.repaint();
    this.drawFrame(layout);

    const message = guideMessage(this.state);
    this.message.setVisible(message !== null).setText(message ? message.join('\n') : '');
    this.indicator.setText(stepIndicatorText(this.state));

    this.backButton.container.setVisible(hasBackButton(this.state));
    this.paintButton(this.backButton, GUIDE_COLORS.buttonBackground);
    const right = rightButton(this.state);
    this.rightButton.label.setText(GUIDE_TEXTS.buttons[right]);
    this.paintButton(
      this.rightButton,
      right === 'startPlaying'
        ? GUIDE_COLORS.startPlayingBackground
        : GUIDE_COLORS.buttonBackground,
    );
  }

  private drawFrame(layout: GuideLayout): void {
    this.frame.clear();
    const frame = layout.frame;
    if (!frame) {
      return;
    }
    // Souřadnice rámečku jsou vnější hrana, čára se kreslí dovnitř.
    const inset = frame.lineWidth / 2;
    this.frame
      .lineStyle(frame.lineWidth, toColor(frame.color), 1)
      .strokeRoundedRect(
        frame.x - frame.width / 2 + inset,
        frame.y - frame.height / 2 + inset,
        frame.width - frame.lineWidth,
        frame.height - frame.lineWidth,
        buttonCornerRadius(frame.lineWidth * 8),
      );
  }

  /** Text pro rodiče na středu slotu; bez slotu se nevykreslí nic. */
  private addText(slot: GuideSlot | null, text: string): Phaser.GameObjects.Text {
    const object = this.scene.add
      .text(slot?.x ?? 0, slot?.y ?? 0, text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${slot?.fontSize ?? 28}px`,
        color: GUIDE_COLORS.text,
        align: 'center',
        wordWrap: { width: slot?.width ?? 0 },
      })
      .setOrigin(0.5);
    this.container.add(object);
    return object;
  }

  /** Tlačítko průvodce: zaoblený obdélník s textem, při ťuknutí krátce poskočí. */
  private addButton(slot: GuideSlot, text: string, onTap: () => void): GuideButton {
    const background = this.scene.add.graphics();
    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${slot.fontSize}px`,
        color: GUIDE_COLORS.buttonText,
      })
      .setOrigin(0.5);
    const container = this.scene.add
      .container(slot.x, slot.y, [background, label])
      .setSize(slot.width, slot.height)
      .setInteractive();
    container.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: container,
        scale: { from: 1, to: 1.06 },
        duration: 90,
        yoyo: true,
      });
      onTap();
    });
    this.container.add(container);
    return { container, background, label, slot };
  }

  private paintButton(button: GuideButton, color: string): void {
    const { width, height } = button.slot;
    button.background
      .clear()
      .fillStyle(toColor(color), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, buttonCornerRadius(height));
  }
}
