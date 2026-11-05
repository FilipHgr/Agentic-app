import Phaser from 'phaser';

import { createSharedVoiceContext, createVoicePlayer } from '../audio/voicePlayer';
import { isSharedAudioUnlocked } from '../../../shared/audio/sharedAudio';
import type { VoicePlayer } from '../audio/voicePlayer';
import { buttonCornerRadius } from '../logic/checkButton';
import { createGuideVoice, handleGuideVoice, speakerPulses } from '../logic/guideVoice';
import type { GuideVoiceEvent, GuideVoiceState, GuideVoiceTapTarget } from '../logic/guideVoice';
import type { GameSettings } from '../logic/settings';
import {
  GUIDE_TEXTS,
  back,
  chooseOption,
  finishGuide,
  guideRowStyle,
  guideSelection,
  hasBackButton,
  next,
  rightButton,
  startGuide,
  stepIndicatorText,
} from '../logic/setupGuide';
import type { GuideSlot, GuideState } from '../logic/setupGuide';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { GUIDE_STYLE } from '../logic/theme';
import { layoutDeviceGuideStep } from '../logic/deviceLayout';
import type { DeviceGuideLayout, DeviceGuideMessage } from '../logic/deviceLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { PANEL_HEIGHT, PANEL_WIDTH, placePanel } from './panelFit';
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

/** Všechno, co se po otočení telefonu nakreslí znovu podle nového rozložení (#60). */
interface GuideView {
  readonly rows: SettingsRows;
  readonly frame: Phaser.GameObjects.Graphics;
  readonly message: Phaser.GameObjects.Text;
  readonly indicator: Phaser.GameObjects.Text;
  readonly backButton: GuideButton;
  readonly rightButton: GuideButton;
  readonly speakerButton: Phaser.GameObjects.Container;
}

/**
 * Průvodce nastavením při prvním spuštění (#49): tři kroky po řadách
 * s radami a shrnutí s „Začít hrát“. O krocích a volbách rozhoduje
 * `src/games/counting/logic/setupGuide.ts`, o hlasu (#51) `src/games/counting/logic/guideVoice.ts`
 * a o rozložení (na telefonu vlastní, #60) `layoutDeviceGuideStep`;
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
  /** Řady, rada a tlačítka; po otočení telefonu se nakreslí znovu. */
  private readonly content: Phaser.GameObjects.Container;
  private area: GameArea;
  private view: GuideView;
  /** Násobek tloušťky okraje tlačítek proti iPadu (na telefonu 2 jednotky na CSS px). */
  private borderScale = 1;
  private speakerPulse: Phaser.Tweens.Tween | undefined;
  /** Zvuk odemklo už ťuknutí v menu: věta 1. kroku zazní sama (#67 AC6). */
  private voice: GuideVoiceState = createGuideVoice({ audioUnlocked: isSharedAudioUnlocked() });
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
    area: GameArea,
    private readonly onFinish: (settings: GameSettings) => void,
  ) {
    // Pozadí má plochu 1024 × 768 a roztáhne se přes celou herní plochu.
    const width = PANEL_WIDTH;
    const height = PANEL_HEIGHT;

    // Neprůhledné pozadí zachytí ťuknutí mimo ovládání průvodce.
    const backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, SETTINGS_BACKDROP_COLOR, 1)
      .setInteractive();
    this.backdrop = backdrop;
    this.content = scene.add.container(0, 0);
    this.container = scene.add.container(0, 0, [backdrop, this.content]).setDepth(PANEL_DEPTH);
    this.area = area;
    this.view = this.buildView(area);

    // Nahrávky se stahují až s otevřeným průvodcem, jen z vlastních souborů hry.
    this.voicePlayer = createVoicePlayer({
      fetch: (url) => window.fetch(url),
      createContext: createSharedVoiceContext,
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
    // Odchod z hry (#68) scénu rovnou zničí; ani pak nesmí zůstat posluchač na stránce.
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.removeListeners());

    this.render();
    this.sendVoice({ kind: 'opened' });
    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /**
   * Po otočení telefonu nebo změně lišty se průvodce nakreslí znovu podle
   * rozložení nové plochy (#60 AC7). Krok, volby i hlas zůstanou: hraná
   * věta nepřestane a reproduktor pulzuje dál, pokud pulzoval.
   */
  fitTo(area: GameArea): void {
    this.area = area;
    this.stopSpeakerPulse();
    this.scene.tweens.killTweensOf(this.content.list);
    this.content.removeAll(true);
    this.view = this.buildView(area);
    this.render();
    this.updateSpeakerPulse();
  }

  /** Nakreslí řady, rámeček, radu a tlačítka podle rozložení plochy `area`. */
  private buildView(area: GameArea): GuideView {
    // Místa tlačítek jsou na všech krocích stejná; Zpět je jen na krocích 2–4.
    const firstLayout = layoutDeviceGuideStep(area, 1);
    const stepWithBackLayout = layoutDeviceGuideStep(area, 2);
    this.borderScale = firstLayout.optionLook.borderScale;

    const rows = new SettingsRows(
      this.scene,
      this.content,
      firstLayout,
      () => guideSelection(this.state),
      (change) => {
        this.state = chooseOption(this.state, change);
        this.tapVoice('option');
      },
    );
    const frame = this.scene.add.graphics();
    this.content.add(frame);

    const message = this.addMessage(firstLayout.message);
    const indicator = this.addText(firstLayout.indicator, '');
    const backSlot = stepWithBackLayout.back ?? stepWithBackLayout.right;
    const view: GuideView = {
      rows,
      frame,
      message,
      indicator,
      backButton: this.addButton(backSlot, GUIDE_TEXTS.buttons.back, () => this.onBack()),
      rightButton: this.addButton(firstLayout.right, '', () => this.onRight()),
      speakerButton: this.addSpeakerButton(firstLayout.speaker),
    };
    placePanel(this.container, this.backdrop, area, firstLayout.placement);
    return view;
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

  /** Ztiší rozmluvenou větu (odchod z hry, #68). */
  stopVoice(): void {
    this.voicePlayer.stop();
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
        targets: this.view.speakerButton,
        scale: SPEAKER_PULSE.scale,
        duration: SPEAKER_PULSE.durationMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!pulses && this.speakerPulse !== undefined) {
      this.stopSpeakerPulse();
    }
  }

  private stopSpeakerPulse(): void {
    this.speakerPulse?.stop();
    this.speakerPulse = undefined;
    this.view.speakerButton.setScale(1);
  }

  /** Překreslí krok podle stavu z logiky. */
  private render(): void {
    const view = this.view;
    const layout = layoutDeviceGuideStep(this.area, this.state.step);

    for (const kind of ROW_KINDS) {
      const style = guideRowStyle(this.state, kind);
      view.rows.setRowStyle(kind, style.visible, style.opacity, style.tappable);
    }
    view.rows.repaint();
    this.drawFrame(layout);

    view.message.setText(layout.message.lines.join('\n'));
    view.indicator.setText(stepIndicatorText(this.state));

    view.backButton.container.setVisible(hasBackButton(this.state));
    this.paintButton(view.backButton, PLAIN_BUTTON);
    const right = rightButton(this.state);
    view.rightButton.label.setText(GUIDE_TEXTS.buttons[right]);
    this.paintButton(
      view.rightButton,
      right === 'startPlaying' ? START_PLAYING_BUTTON : PLAIN_BUTTON,
    );
  }

  private drawFrame(layout: DeviceGuideLayout): void {
    const graphics = this.view.frame;
    graphics.clear();
    const frame = layout.frame;
    if (!frame) {
      return;
    }
    // Souřadnice rámečku jsou vnější hrana, čára se kreslí dovnitř.
    const inset = frame.lineWidth / 2;
    graphics
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
    this.content.add(object);
    return object;
  }

  /**
   * Rada kroku: řádky jsou už zalomené v rozložení. Na středu pruhu, nebo
   * (telefon na šířku) zarovnaná vlevo a nahoru.
   */
  private addMessage(slot: DeviceGuideMessage): Phaser.GameObjects.Text {
    const alignLeft = slot.align === 'left';
    const alignTop = slot.verticalAlign === 'top';
    const object = this.scene.add
      .text(
        alignLeft ? slot.x - slot.width / 2 : slot.x,
        alignTop ? slot.y - slot.height / 2 : slot.y,
        '',
        {
          fontFamily: FONT_FAMILY,
          fontSize: `${slot.fontSize}px`,
          color: slot.color,
          align: slot.align,
          wordWrap: { width: slot.width },
        },
      )
      .setOrigin(alignLeft ? 0 : 0.5, alignTop ? 0 : 0.5);
    // Phaser dává řádky po výšce písma z prohlížeče a mezeře navíc.
    const lineSpacing = slot.exactLineHeight
      ? slot.lineHeight - object.getTextMetrics().fontSize
      : slot.lineHeight - slot.fontSize;
    object.setLineSpacing(lineSpacing);
    this.content.add(object);
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
    this.content.add(container);
    return { container, background, label, slot };
  }

  /** Reproduktor (#51): čtverec jako číselník s kreslenou ikonou, bez textu. */
  private addSpeakerButton(slot: DeviceGuideLayout['speaker']): Phaser.GameObjects.Container {
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
    this.content.add(container);
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
    const border = GUIDE_STYLE.buttonBorderWidth * this.borderScale;
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
