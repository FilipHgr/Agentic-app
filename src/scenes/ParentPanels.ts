import type Phaser from 'phaser';

import type { GameSize, PlayState } from '../logic/deviceLayout';
import type { GameProgress } from '../logic/progress';
import type { GameSettings } from '../logic/settings';
import {
  CLOSED_SETTINGS,
  confirmSettings,
  createLaunchState,
  openSettings,
  pageAppearance,
} from '../logic/settingsSession';
import type { ConfirmedSettings, LaunchState } from '../logic/settingsSession';
import {
  canOpenSettingsByHold,
  guideAtStart,
  guidePageAppearance,
  launchAfterGuide,
} from '../logic/setupGuide';
import { applyPageAppearance } from '../ui/pageAppearance';
import { SettingsPanel } from './SettingsPanel';
import { SetupGuidePanel } from './SetupGuidePanel';

/** Co panely pro rodiče potřebují od scény. */
export interface ParentPanelsHost {
  /** Současné nastavení hry. */
  readonly settings: () => GameSettings;
  /** Současné hvězdičky a postavička. */
  readonly progress: () => GameProgress;
  /** Nastavení zvolené rodičem začne platit a uloží se. */
  readonly useSettings: (chosen: GameSettings) => void;
  /** Nastavení se právě otevírá podržením kolečka. */
  readonly onSettingsOpening: () => void;
  /** Průvodce se zavřel po „Začít hrát“. */
  readonly onGuideClosed: () => void;
  /** Nastavení se zavřelo po ✓. */
  readonly onSettingsClosed: (result: ConfirmedSettings) => void;
}

/**
 * Nastavení pro rodiče za kolečkem a průvodce nastavením při prvním
 * spuštění (#49). Když je jedno z nich otevřené, oslava se nedohrává.
 */
export class ParentPanels {
  /** Při prvním spuštění se místo příkladu otevře průvodce nastavením (#49). */
  private launch: LaunchState;
  private open = false;
  /** Otevřené nastavení pro rodiče, aby šlo po otočení telefonu zmenšit (#54). */
  private settingsPanel: SettingsPanel | undefined;
  /** Průvodce nastavením při prvním spuštění (#49), když je otevřený. */
  private setupGuide: SetupGuidePanel | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    firstLaunch: boolean,
    private readonly host: ParentPanelsHost,
  ) {
    this.launch = createLaunchState(firstLaunch);
  }

  /** Je otevřené nastavení nebo průvodce? */
  get isOpen(): boolean {
    return this.open;
  }

  /** Má se hned na začátku hry otevřít průvodce (první spuštění)? */
  get guideAtStart(): boolean {
    return guideAtStart(this.launch) !== null;
  }

  /** Stav otevřeného nastavení a průvodce pro přepočet po změně velikosti okna. */
  playStateParts(): Pick<PlayState, 'settingsSession' | 'guide'> {
    return {
      settingsSession: this.settingsPanel?.currentSession ?? CLOSED_SETTINGS,
      guide: this.setupGuide?.state ?? null,
    };
  }

  /** Otevřené panely se zmenší nebo zvětší na novou herní plochu (#54). */
  fitTo(size: GameSize): void {
    this.settingsPanel?.fitTo(size);
    this.setupGuide?.fitTo(size);
  }

  /**
   * Průvodce nastavením při prvním spuštění (#49). Během něj podržení kolečka
   * nic neudělá; po „Začít hrát“ se nastavení uloží a začne první příklad.
   */
  openSetupGuide(): void {
    this.open = true;
    const settingsButton = document.getElementById('settings-button');
    applyPageAppearance(guidePageAppearance(), settingsButton);
    this.setupGuide = new SetupGuidePanel(this.scene, (chosen) => {
      this.setupGuide = undefined;
      this.launch = launchAfterGuide(this.launch);
      this.host.useSettings(chosen);
      this.open = false;
      applyPageAppearance(pageAppearance(CLOSED_SETTINGS), settingsButton);
      this.host.onGuideClosed();
    });
  }

  /**
   * Nastavení pro rodiče; po potvrzení se uloží a přijde nový příklad.
   * Stránka zůstane světlá a kolečko se ztlumí (#45). Druhé podržení kolečka
   * při otevřeném nastavení nic neudělá.
   */
  openSettings(): void {
    if (this.open || !canOpenSettingsByHold(this.setupGuide?.state ?? null)) {
      return;
    }
    this.open = true;
    this.host.onSettingsOpening();
    const settingsButton = document.getElementById('settings-button');
    const session = openSettings(CLOSED_SETTINGS, this.host.settings());
    applyPageAppearance(pageAppearance(session), settingsButton);

    this.settingsPanel = new SettingsPanel(this.scene, session, (chosen) => {
      this.settingsPanel = undefined;
      const result = confirmSettings(chosen, this.host.settings(), this.host.progress());
      this.host.useSettings(result.settings);
      this.open = false;
      applyPageAppearance(pageAppearance(result.session), settingsButton);
      this.host.onSettingsClosed(result);
    });
  }
}
