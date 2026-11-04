import Phaser from 'phaser';

import { createBrowserVoiceContext, createVoicePlayer } from '../audio/voicePlayer';
import type { VoicePlayer } from '../audio/voicePlayer';
import { buttonCornerRadius } from '../logic/checkButton';
import { createGuideVoice, handleGuideVoice, speakerPulses } from '../logic/guideVoice';
import type { GuideVoiceEvent, GuideVoiceState, GuideVoiceTapTarget } from '../logic/guideVoice';
import type { GameSettings } from '../logic/settings';
import { layoutSettingsPanel } from '../logic/settingsLayout';
import {
  GUIDE_TEXTS,
  back,
  chooseOption,
  finishGuide,
  guideMessage,
  guideRowStyle,
  guideSelection,
  hasBackButton,
  layoutGuideStep,
  next,
  rightButton,
  startGuide,
  stepIndicatorText,
} from '../logic/setupGuide';
import type { GuideLayout, GuideSlot, GuideState } from '../logic/setupGuide';
import { FONT_FAMILY, GUIDE_STYLE, colorNumber } from '../logic/theme';
import type { GameSize } from '../logic/deviceLayout';
import { PANEL_HEIGHT, PANEL_WIDTH, fitPanel } from './panelFit';
import { PANEL_DEPTH, PANEL_FADE_MS, SETTINGS_BACKDROP_COLOR } from './SettingsPanel';
import { SettingsRows } from './SettingsRows';

const ROW_KINDS = ['maxNumber', 'operations', 'answerInput'] as const;

/** Jemné pulzování reproduktoru, dokud rodič poprvé neťukne (#51). */
const SPEAKER_PULSE = { scale: 1.08, durationMs: 600 } as const;

/** Vzhled tlačítka průvodce: jako číselník, nebo zelené „Začít hrát“ (#53). */
interface GuideButtonLook {
  readonly background: string;
  readonly borderColor: string;
  readonly textColor: string;
}

const PLAIN_BUTTON: GuideButtonLook = {
  background: GUIDE_STYLE.buttonBackground,
  borderColor: GUIDE_STYLE.buttonBorderColor,
  textColor: GUIDE_STYLE.buttonTextColor,
};

const START_PLAYING_BUTTON: GuideButtonLook = {
  background: GUIDE_STYLE.startPlayingBackground,
  borderColor: GUIDE_STYLE.startPlayingBackground,
  textColor: GUIDE_STYLE.startPlayingTextColor,
};

interface GuideButton {
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly slot: GuideSlot;
}

/**
 * Průvodce nastavením při prvním spuštění (#49): tři kroky po řadách
 * s radami a shrnutí s „Začít hrát“. O krocích a volbách rozhoduje
 * `src/logic/setupGuide.ts`, o hlasu (#51) `src/logic/guideVoice.ts`;
 * panel je jen kreslí a předává události.
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
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly rows: SettingsRows;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly message: Phaser.GameObjects.Text;
  private readonly indicator: Phaser.GameObjects.Text;
  private readonly backButton: GuideButton;
  private readonly rightButton: GuideButton;
  private readonly speakerButton: Phaser.GameObjects.Container;
  private speakerPulse: Phaser.Tweens.Tween | undefined;
  private voice: GuideVoiceState = createGuideVoice();
  private readonly voicePlayer: VoicePlayer;
  /** Ťuknutí už zpracovalo tlačítko nebo volba; jinak jde o ťuknutí „jinam“. */
  private tapHandled = false;
  private readonly onAnyPointerDown = (): void => this.onPointerDownAnywhere();
  /**
   * Safari bere jako gesto pro zvuk až zvednutí prstu. Věta spuštěná při
   * dotyku v pozastaveném zvuku pak zazní, jakmile se zvuk tady zapne.
   */
  private readonly onAnyPointerUp = (): void => {
    if (this.voice.unlocked) {
      this.voicePlayer.unlock();
    }
  };
  private readonly onVisibilityChange = (): void =>
    this.sendVoice({ kind: document.hidden ? 'hidden' : 'shown' });

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onFinish: (settings: GameSettings) => void,
  ) {
    // Průvodce má vlastní plochu 1024 × 768, na telefonu se celý zmenší (#54).
    const width = PANEL_WIDTH;
    const height = PANEL_HEIGHT;
    const firstLayout = layoutGuideStep(1, width, height);
    const stepWithBackLayout = layoutGuideStep(2, width, height);

    // Neprůhledné pozadí zachytí ťuknutí mimo ovládání průvodce.
    const backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, SETTINGS_BACKDROP_COLOR, 1)
      .setInteractive();
    this.backdrop = backdrop;
    this.container = scene.add.container(0, 0, [backdrop]).setDepth(PANEL_DEPTH);

    this.rows = new SettingsRows(
      scene,
      this.container,
      layoutSettingsPanel(width, height),
      () => guideSelection(this.state),
      (change) => {
        this.state = chooseOption(this.state, change);
        this.tapVoice('option');
      },
    );
    this.frame = scene.add.graphics();
    this.container.add(this.frame);

    this.message = this.addText(stepWithBackLayout.message, '');
    this.message.setLineSpacing(
      stepWithBackLayout.message.lineHeight - stepWithBackLayout.message.fontSize,
    );
    this.indicator = this.addText(stepWithBackLayout.indicator, '');
    // Zpět je jen na krocích 2–4, proto jeho místo bereme z kroku 2.
    const backSlot = stepWithBackLayout.back ?? stepWithBackLayout.right;
    this.backButton = this.addButton(backSlot, GUIDE_TEXTS.buttons.back, () => this.onBack());
    this.rightButton = this.addButton(firstLayout.right, '', () => this.onRight());
    this.speakerButton = this.addSpeakerButton(firstLayout.speaker);

    // Nahrávky se stahují až s otevřeným průvodcem, jen z vlastních souborů hry.
    this.voicePlayer = createVoicePlayer({
      fetch: (url) => window.fetch(url),
      createContext: createBrowserVoiceContext,
      events: {
        onLoaded: (id) => this.sendVoice({ kind: 'loaded', id }),
        onLoadFailed: (id) => this.sendVoice({ kind: 'loadFailed', id }),
      },
    });
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onAnyPointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onAnyPointerUp);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    // Kdyby scéna skončila jinak než „Začít hrát“, posluchači nezůstanou viset.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeListeners());

    this.render();
    this.fitTo({ width: scene.scale.width, height: scene.scale.height });
    this.sendVoice({ kind: 'opened' });
    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /** Po změně velikosti okna se průvodce znovu vejde na herní plochu. */
  fitTo(area: GameSize): void {
    fitPanel(this.container, this.backdrop, area);
  }

  private onBack(): void {
    this.state = back(this.state);
    this.render();
    this.tapVoice('back');
  }

  private onRight(): void {
    const now = this.scene.time.now;
    switch (rightButton(this.state)) {
      case 'next':
        this.state = next(this.state, now);
        this.render();
        this.tapVoice('next');
        return;
      case 'startPlaying': {
        this.tapVoice('startPlaying');
        const settings = finishGuide(this.state, now);
        if (settings) {
          this.close();
          this.onFinish(settings);
        }
        return;
      }
    }
  }

  /** Po „Začít hrát“: hlas skončí a průvodce zmizí. */
  private close(): void {
    this.sendVoice({ kind: 'closed' });
    this.voicePlayer.dispose();
    this.removeListeners();
    this.container.destroy();
  }

  private removeListeners(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onAnyPointerDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onAnyPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Ťuknutí na konkrétní ovládání průvodce. */
  private tapVoice(target: GuideVoiceTapTarget): void {
    this.tapHandled = true;
    this.sendVoice({ kind: 'tapped', target, step: this.state.step });
  }

  /**
   * Phaser ohlásí ťuknutí na scénu až po tlačítkách. Co žádné ovládání
   * nezpracovalo (prázdné místo, ztlumená řada), jen odemkne zvuk.
   */
  private onPointerDownAnywhere(): void {
    if (!this.tapHandled) {
      this.sendVoice({ kind: 'tapped', target: 'elsewhere', step: this.state.step });
    }
    this.tapHandled = false;
  }

  /** Předá událost hlasu a provede jeho příkazy. */
  private sendVoice(event: GuideVoiceEvent): void {
    const result = handleGuideVoice(this.voice, event);
    this.voice = result.state;
    for (const command of result.commands) {
      switch (command.kind) {
        case 'unlock':
          this.voicePlayer.unlock();
          break;
        case 'load':
          this.voicePlayer.load(command.id);
          break;
        case 'play':
          this.voicePlayer.play(command.id);
          break;
        case 'stop':
          this.voicePlayer.stop();
          break;
      }
    }
    this.updateSpeakerPulse();
  }

  private updateSpeakerPulse(): void {
    const pulses = speakerPulses(this.voice);
    if (pulses && this.speakerPulse === undefined) {
      this.speakerPulse = this.scene.tweens.add({
        targets: this.speakerButton,
        scale: SPEAKER_PULSE.scale,
        duration: SPEAKER_PULSE.durationMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!pulses && this.speakerPulse !== undefined) {
      this.speakerPulse.stop();
      this.speakerPulse = undefined;
      this.speakerButton.setScale(1);
    }
  }

  /** Překreslí krok podle stavu z logiky. */
  private render(): void {
    const step = this.state.step;
    const layout = layoutGuideStep(step, PANEL_WIDTH, PANEL_HEIGHT);

    for (const kind of ROW_KINDS) {
      const style = guideRowStyle(this.state, kind);
      this.rows.setRowStyle(kind, style.visible, style.opacity, style.tappable);
    }
    this.rows.repaint();
    this.drawFrame(layout);

    this.message.setText(guideMessage(this.state).join('\n'));
    this.indicator.setText(stepIndicatorText(this.state));

    this.backButton.container.setVisible(hasBackButton(this.state));
    this.paintButton(this.backButton, PLAIN_BUTTON);
    const right = rightButton(this.state);
    this.rightButton.label.setText(GUIDE_TEXTS.buttons[right]);
    this.paintButton(
      this.rightButton,
      right === 'startPlaying' ? START_PLAYING_BUTTON : PLAIN_BUTTON,
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
      .lineStyle(frame.lineWidth, colorNumber(frame.color), 1)
      .strokeRoundedRect(
        frame.x - frame.width / 2 + inset,
        frame.y - frame.height / 2 + inset,
        frame.width - frame.lineWidth,
        frame.height - frame.lineWidth,
        buttonCornerRadius(frame.lineWidth * 8),
      );
  }

  /** Text pro rodiče na středu slotu. */
  private addText(slot: GuideSlot, text: string): Phaser.GameObjects.Text {
    const object = this.scene.add
      .text(slot.x, slot.y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${slot.fontSize}px`,
        color: GUIDE_STYLE.textColor,
        align: 'center',
        wordWrap: { width: slot.width },
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
        fontFamily: FONT_FAMILY,
        fontSize: `${slot.fontSize}px`,
        color: GUIDE_STYLE.buttonTextColor,
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

  /** Reproduktor (#51): čtverec jako číselník s kreslenou ikonou, bez textu. */
  private addSpeakerButton(slot: GuideLayout['speaker']): Phaser.GameObjects.Container {
    const { width, height } = slot;
    const background = this.scene.add.graphics();
    this.drawButtonShape(background, width, height, PLAIN_BUTTON);
    const icon = this.createSpeakerIcon(height);
    const container = this.scene.add
      .container(slot.x, slot.y, [background, icon])
      .setSize(width, height)
      .setInteractive();
    container.on('pointerdown', () => {
      this.tapVoice('speaker');
      // Rychlé ťukání nevrší animace na sebe.
      this.scene.tweens.killTweensOf(container);
      container.setScale(1);
      this.scene.tweens.add({
        targets: container,
        scale: { from: 1, to: 1.08 },
        duration: 90,
        yoyo: true,
      });
    });
    this.container.add(container);
    return container;
  }

  /** Reproduktor s dvěma vlnkami, kreslený čarou, aby nezávisel na písmu. */
  private createSpeakerIcon(size: number): Phaser.GameObjects.Graphics {
    const unit = size / 12;
    const color = colorNumber(GUIDE_STYLE.speakerIconColor);
    const icon = this.scene.add.graphics();
    icon.fillStyle(color, 1);
    icon.fillRect(-4 * unit, -1.5 * unit, 2 * unit, 3 * unit);
    icon.fillTriangle(-2 * unit, -1.5 * unit, 1 * unit, -4 * unit, 1 * unit, 4 * unit);
    icon.fillTriangle(-2 * unit, -1.5 * unit, -2 * unit, 1.5 * unit, 1 * unit, 4 * unit);
    icon.lineStyle(unit * 0.8, color, 1);
    for (const radius of [2.5 * unit, 4.2 * unit]) {
      icon.beginPath();
      icon.arc(0.5 * unit, 0, radius, -Math.PI / 4, Math.PI / 4);
      icon.strokePath();
    }
    return icon;
  }

  private paintButton(button: GuideButton, look: GuideButtonLook): void {
    this.drawButtonShape(button.background, button.slot.width, button.slot.height, look);
    button.label.setColor(look.textColor);
  }

  /** Zaoblený obdélník s okrajem kresleným dovnitř, aby se velikost nezměnila. */
  private drawButtonShape(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    look: GuideButtonLook,
  ): void {
    const radius = buttonCornerRadius(height);
    const border = GUIDE_STYLE.buttonBorderWidth;
    graphics
      .clear()
      .fillStyle(colorNumber(look.background), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
      .lineStyle(border, colorNumber(look.borderColor), 1)
      .strokeRoundedRect(
        -width / 2 + border / 2,
        -height / 2 + border / 2,
        width - border,
        height - border,
        radius - border / 2,
      );
  }
}
