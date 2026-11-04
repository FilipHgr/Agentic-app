import Phaser from 'phaser';

import { CHECK_BUTTON_COLOR, checkButtonStyle } from '../logic/checkButton';
import { CONFIRM_BUTTON_STYLE, SETTINGS_PANEL_STYLE, colorNumber } from '../logic/theme';
import type { GameSize } from '../logic/deviceLayout';
import type { ButtonSlot } from '../logic/screenLayout';
import { layoutSettingsPanel } from '../logic/settingsLayout';
import { chooseOption, selectedOptions } from '../logic/settingsSession';
import type { SettingsSession } from '../logic/settingsSession';
import { PANEL_HEIGHT, PANEL_WIDTH, fitPanel } from './panelFit';
import { SettingsRows } from './SettingsRows';

/** Pozadí panelu je stejné jako hra (#53). */
export const SETTINGS_BACKDROP_COLOR = colorNumber(SETTINGS_PANEL_STYLE.background);

/** Jak dlouho panel naběhne; kolečko se ztlumí stejně rychle (#45). */
export const PANEL_FADE_MS = 150;

/** Panel je nad vším ostatním, aby ťuknutí nepropadla do hry pod ním. */
export const PANEL_DEPTH = 100;

/**
 * Obrazovka nastavení pro rodiče: řada rozsahů (5, 10, 20), řada druhů
 * příkladů (+, −, + −), způsob odpovědi (číselník, psaní) a potvrzovací „✓“.
 * Vybrané volby jsou plně modré. Rozměry jsou v `src/logic/settingsLayout.ts`.
 */
export class SettingsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private session: SettingsSession;

  /** Rozehrané volby; zůstanou i po otočení telefonu (#54). */
  get currentSession(): SettingsSession {
    return this.session;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    session: SettingsSession,
    private readonly onConfirm: (session: SettingsSession) => void,
  ) {
    this.session = session;
    // Panel má vlastní plochu 1024 × 768, na telefonu se celý zmenší (#54).
    const width = PANEL_WIDTH;
    const height = PANEL_HEIGHT;
    const layout = layoutSettingsPanel(width, height);

    // Neprůhledné pozadí stejné barvy jako stránka (#45) zachytí všechna
    // ťuknutí, takže hra pod panelem nic nedostane.
    const backdrop = scene.add
      .rectangle(
        width / 2,
        height / 2,
        width,
        height,
        SETTINGS_BACKDROP_COLOR,
        SETTINGS_PANEL_STYLE.backgroundAlpha,
      )
      .setInteractive();
    this.backdrop = backdrop;
    this.container = scene.add.container(0, 0, [backdrop]).setDepth(PANEL_DEPTH);

    new SettingsRows(
      scene,
      this.container,
      layout,
      () => selectedOptions(this.session),
      (change) => {
        this.session = chooseOption(this.session, change);
      },
    );
    this.addConfirmButton(layout.confirm);
    this.fitTo({ width: scene.scale.width, height: scene.scale.height });

    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /** Po změně velikosti okna se panel znovu vejde na herní plochu. */
  fitTo(area: GameSize): void {
    fitPanel(this.container, this.backdrop, area);
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
      .lineStyle(tickWidth, colorNumber(CONFIRM_BUTTON_STYLE.tickColor), 1)
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

  private confirm(): void {
    this.container.destroy();
    this.onConfirm(this.session);
  }
}
