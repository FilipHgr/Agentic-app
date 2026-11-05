import type Phaser from 'phaser';

import type { GameArea } from '../../../shared/logic/viewportLayout';
import type { PlayState } from '../logic/deviceLayout';
import type { GameSettings } from '../logic/settings';
import { CLOSED_SETTINGS, openSettings, pageAppearance } from '../logic/settingsSession';
import { guidePageAppearance } from '../logic/setupGuide';
import { applyPageAppearance } from '../ui/pageAppearance';
import { SettingsPanel } from './SettingsPanel';
import { SetupGuidePanel } from './SetupGuidePanel';

/** Co panely pro rodiče potřebují od scény. */
export interface ParentPanelsHost {
  /** Současné nastavení hry. */
  readonly settings: () => GameSettings;
  /** Současná herní plocha (iPad, telefon na šířku nebo na výšku, zmenšené). */
  readonly gameArea: () => GameArea;
  /** Rodič v nastavení ťukl na ✓ s volbami `chosen`. */
  readonly onSettingsConfirmed: (chosen: GameSettings) => void;
  /** Rodič v průvodci ťukl na „Začít hrát“ s volbami `chosen`. */
  readonly onGuideFinished: (chosen: GameSettings) => void;
}

/**
 * Nastavení pro rodiče za kolečkem a průvodce nastavením při prvním
 * spuštění (#49). Kdy se otevřou a co volby znamenají, rozhoduje sezení
 * hry (`countingSession.ts`); tady se panely jen kreslí a zavírají.
 */
export class ParentPanels {
  /** Otevřené nastavení pro rodiče, aby šlo po otočení telefonu zmenšit (#54). */
  private settingsPanel: SettingsPanel | undefined;
  /** Průvodce nastavením při prvním spuštění (#49), když je otevřený. */
  private setupGuide: SetupGuidePanel | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: ParentPanelsHost,
  ) {}

  /** Stav otevřeného nastavení a průvodce pro přepočet po změně velikosti okna. */
  playStateParts(): Pick<PlayState, 'settingsSession' | 'guide'> {
    return {
      settingsSession: this.settingsPanel?.currentSession ?? CLOSED_SETTINGS,
      guide: this.setupGuide?.state ?? null,
    };
  }

  /**
   * Otevřené panely se přizpůsobí nové herní ploše: nastavení (#59)
   * i průvodce (#60) dostanou rozložení plochy.
   */
  fitTo(area: GameArea): void {
    this.settingsPanel?.fitTo(area);
    this.setupGuide?.fitTo(area);
  }

  /** Ztiší větu průvodce, pokud nějaká hraje (odchod z hry, #68). */
  stopVoice(): void {
    this.setupGuide?.stopVoice();
  }

  /** Průvodce nastavením při prvním spuštění (#49); stránka vypadá jako při nastavení. */
  openSetupGuide(): void {
    const settingsButton = document.getElementById('settings-button');
    applyPageAppearance(guidePageAppearance(), settingsButton);
    this.setupGuide = new SetupGuidePanel(this.scene, this.host.gameArea(), (chosen) => {
      this.setupGuide = undefined;
      applyPageAppearance(pageAppearance(CLOSED_SETTINGS), settingsButton);
      this.host.onGuideFinished(chosen);
    });
  }

  /**
   * Nastavení pro rodiče s uloženými volbami. Stránka zůstane světlá
   * a kolečko se ztlumí (#45); po ✓ se zase rozsvítí.
   */
  openSettings(): void {
    if (this.settingsPanel || this.setupGuide) {
      return;
    }
    const settingsButton = document.getElementById('settings-button');
    const session = openSettings(CLOSED_SETTINGS, this.host.settings());
    applyPageAppearance(pageAppearance(session), settingsButton);

    this.settingsPanel = new SettingsPanel(this.scene, session, this.host.gameArea(), (chosen) => {
      this.settingsPanel = undefined;
      applyPageAppearance(pageAppearance(CLOSED_SETTINGS), settingsButton);
      this.host.onSettingsConfirmed(chosen.open ? chosen.choice : this.host.settings());
    });
  }
}
