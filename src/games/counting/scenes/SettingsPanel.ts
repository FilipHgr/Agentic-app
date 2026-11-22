import Phaser from 'phaser';

import { CHECK_BUTTON_COLOR, checkButtonStyle } from '../logic/checkButton';
import { CONFIRM_BUTTON_STYLE, SETTINGS_PANEL_STYLE } from '../logic/theme';
import { colorNumber } from '../../../shared/logic/theme';
import {
  layoutDeviceMistakes,
  layoutDeviceOverview,
  layoutDeviceSettingsPanel,
} from '../logic/deviceLayout';
import { mistakeLines } from '../logic/mistakesLayout';
import type { MistakeOverview } from '../logic/mistakeActivity';
import { currentLanguage } from '../../../shared/texts/languages';
import {
  backToOverview,
  backToSettings,
  canConfirmSettings,
  openParentPanel,
  showMistakes,
  showOverview,
} from '../logic/overviewPanel';
import type { ParentPanelState } from '../logic/overviewPanel';
import type { WeekOverview } from '../logic/weekActivity';
import { countingTexts } from '../texts/countingTexts';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import type { ButtonSlot } from '../logic/screenLayout';
import { chooseOption, selectedOptions } from '../logic/settingsSession';
import type { SettingsSession } from '../logic/settingsSession';
import { PANEL_HEIGHT, PANEL_WIDTH, placePanel } from './panelFit';
import { MistakesView } from './MistakesView';
import { OverviewView, addTextButton } from './OverviewView';
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
 * Vybrané volby jsou plně modré. Rozměry jsou v `src/games/counting/logic/settingsLayout.ts`
 * a na telefonu v `src/games/counting/logic/phoneSettingsLayout.ts` (#59).
 * Tlačítko Přehled ukáže místo voleb přehled vyřešených příkladů a Zpět
 * vrátí volby, jak je rodič rozehrál (#183 AC3). Z přehledu tlačítko Chyby
 * ukáže, kde se dítě plete, a Zpět vrátí přehled (#184).
 */
export class SettingsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  /** Řady a ✓; po otočení telefonu se nakreslí znovu podle nového rozložení. */
  private readonly content: Phaser.GameObjects.Container;
  private panel: ParentPanelState;
  private area: GameArea;

  /** Rozehrané volby; zůstanou i po otočení telefonu (#54) a po návratu z přehledu (#183). */
  get currentSession(): SettingsSession {
    return this.panel.session;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    session: SettingsSession,
    area: GameArea,
    private readonly weekOverview: () => WeekOverview,
    private readonly mistakeOverview: () => MistakeOverview,
    private readonly onConfirm: (session: SettingsSession) => void,
  ) {
    this.panel = openParentPanel(session);
    this.area = area;
    // Pozadí má plochu 1024 × 768 a roztáhne se přes celou herní plochu.
    const width = PANEL_WIDTH;
    const height = PANEL_HEIGHT;

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
    this.content = scene.add.container(0, 0);
    this.container = scene.add.container(0, 0, [backdrop, this.content]).setDepth(PANEL_DEPTH);
    this.fitTo(area);

    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: PANEL_FADE_MS });
  }

  /**
   * Po otočení telefonu nebo změně lišty se řady a ✓ nakreslí znovu podle
   * rozložení nové plochy (#59 AC7). Vybrané volby zůstanou, nic se neuloží.
   */
  fitTo(area: GameArea): void {
    this.area = area;
    this.scene.tweens.killTweensOf(this.content.list);
    this.content.removeAll(true);
    if (this.panel.view === 'overview') {
      this.drawOverview(area);
    } else if (this.panel.view === 'mistakes') {
      this.drawMistakes(area);
    } else {
      this.drawSettings(area);
    }
  }

  private drawSettings(area: GameArea): void {
    const layout = layoutDeviceSettingsPanel(area);
    new SettingsRows(
      this.scene,
      this.content,
      layout,
      () => selectedOptions(this.panel.session),
      (change) => {
        this.panel = { ...this.panel, session: chooseOption(this.panel.session, change) };
      },
    );
    this.addConfirmButton(layout.confirm);
    addTextButton(
      this.scene,
      this.content,
      layout.overviewButton,
      countingTexts().overview.button,
      layout.optionLook.borderScale,
      () => this.switchTo(showOverview(this.panel)),
    );
    placePanel(this.container, this.backdrop, area, layout.placement);
  }

  /** Přehled se počítá při každém otevření, aby ukázal i dnešní příklady. */
  private drawOverview(area: GameArea): void {
    const layout = layoutDeviceOverview(area);
    new OverviewView(
      this.scene,
      this.content,
      layout,
      this.weekOverview(),
      countingTexts().overview,
      countingTexts().mistakes.button,
      () => this.switchTo(backToSettings(this.panel)),
      () => this.switchTo(showMistakes(this.panel)),
    );
    placePanel(this.container, this.backdrop, area, layout.placement);
  }

  /** Chyby se počítají při každém otevření stránky (#184). */
  private drawMistakes(area: GameArea): void {
    const layout = layoutDeviceMistakes(area);
    const texts = countingTexts();
    new MistakesView(
      this.scene,
      this.content,
      layout,
      mistakeLines(this.mistakeOverview(), texts.mistakes, texts.overview, currentLanguage()),
      () => this.switchTo(backToOverview(this.panel)),
    );
    placePanel(this.container, this.backdrop, area, layout.placement);
  }

  /**
   * Přepnutí mezi nastavením a přehledem; rozehrané volby zůstanou. Volá se
   * až po zhoupnutí tlačítka, mimo zpracování ťuknutí. Panel zavřený ✓
   * mezitím se už nepřekreslí.
   */
  private switchTo(panel: ParentPanelState): void {
    if (!this.container.active) {
      return;
    }
    this.panel = panel;
    this.fitTo(this.area);
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
    this.content.add(button);
  }

  private confirm(): void {
    if (!canConfirmSettings(this.panel)) {
      return;
    }
    this.container.destroy();
    this.onConfirm(this.panel.session);
  }
}
