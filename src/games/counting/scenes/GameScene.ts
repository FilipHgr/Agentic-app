import Phaser from 'phaser';

import { createBrowserAudioContext, createTonePlayer } from '../../../shared/audio/tonePlayer';
import { createAnswerRound, isHintVisible, tapAnswer } from '../logic/answerRound';
import type { AnswerRound, TapOutcome } from '../logic/answerRound';
import { SOUNDS, soundForOutcome } from '../logic/answerSounds';
import { countDot, countingTone, startDotCounting } from '../logic/dotCounting';
import type { DotCounting } from '../logic/dotCounting';
import { hintMovesLayout, isTwoBoxRound, playStateAfterResize } from '../logic/deviceLayout';
import { gameAreaFor } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import type { PlayState } from '../logic/deviceLayout';
import { STARS_PER_SET, startNewStarSet, starsAfterTap } from '../logic/stars';
import type { StarProgress } from '../logic/stars';
import { createRecognizerLoading, loadDigitRecognizer } from '../logic/recognizerLoading';
import type { RecognizerLoadStatus } from '../logic/recognizerLoading';
import { isWritingActive } from '../logic/settings';
import type { AnswerInput, GameSettings } from '../logic/settings';
import type { ConfirmedSettings } from '../logic/settingsSession';
import type { GameProgress } from '../logic/progress';
import { switchToKeypad } from '../logic/twoBoxWriting';
import type { TwoBoxConfirmResult, TwoBoxRound } from '../logic/twoBoxWriting';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { browserStorage } from '../../../shared/storage/keyValueStorage';
import { loadSettingsState, saveSettings } from '../storage/settingsStorage';
import { attachSettingsButton } from '../../../shared/ui/settingsButton';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import { highlightCorrectButton, shakeWrongButton } from './AnswerButton';
import type { AnswerButton } from './AnswerButton';
import { Confetti } from './Confetti';
import { ParentPanels } from './ParentPanels';
import { RoundView } from './RoundView';
import { SceneLayouts, gameAreaFromRegistry } from './SceneLayouts';
import { StarRow } from './StarRow';
import type { Origin } from './StarRow';

/** Jak dlouho se po správné odpovědi čeká na nový příklad. */
const NEXT_PROBLEM_DELAY_MS = 800;

/** Jak dlouho trvá oslava po zaplnění řady, než přijde nový příklad. */
const CELEBRATION_MS = 2600;

/**
 * Scéna jen kreslí kolo a animuje; o správnosti rozhoduje logika v src/logic.
 * Rozložení se bere podle herní plochy (iPad, telefon na šířku #54, nebo
 * na výšku #56) a při otočení telefonu se překreslí bez nového příkladu.
 * Části obrazovky kreslí samostatné soubory vedle (#57): `RoundView`
 * (příklad, číselník, okénka, nápověda), `StarRow`, `Confetti`
 * a `ParentPanels` (nastavení a průvodce).
 * Rozpoznávání psaní se stahuje na pozadí až po prvním příkladu (#58).
 */
export class GameScene extends Phaser.Scene {
  private round: AnswerRound | undefined;
  /** Herní plocha podle okna; nastavuje ji src/main.ts do registru. */
  private gameArea: GameArea = gameAreaFor(undefined);
  private hintIsShown = false;
  /** Které tečky nápovědy už dítě spočítalo ťuknutím (#43). */
  private dotCounting: DotCounting = { numbers: [] };
  // Hvězdičky přežijí zavření hry (načtou se ze zařízení).
  private starProgress: StarProgress = loadProgress(browserStorage());
  private readonly settingsState = loadSettingsState(browserStorage());
  private settings: GameSettings = this.settingsState.settings;
  /** Stahování rozpoznávání psaní na pozadí (#58). */
  private readonly recognizerLoading = createRecognizerLoading(loadDigitRecognizer);
  /**
   * Čím dítě odpovídá v rozehraném příkladu. Rozhodne se u nového příkladu
   * (psaní jen se staženým nebo stahovaným rozpoznáváním) a uprostřed
   * příkladu se změní jen na číselník, když stahování selže.
   */
  private roundInput: AnswerInput | undefined;
  private readonly panels = new ParentPanels(this, this.settingsState.firstLaunch, {
    settings: () => this.settings,
    progress: () => this.currentProgress(),
    gameArea: () => this.gameArea,
    useSettings: (chosen) => {
      this.settings = chosen;
      saveSettings(browserStorage(), chosen);
      if (isWritingActive(chosen)) {
        this.recognizerLoading.writingEnabled();
      }
    },
    // Oslava se pod panelem nedohrává, dokončí ji až potvrzení (#45 AC8).
    onSettingsOpening: () => this.stopCelebration(),
    onGuideClosed: () => this.startRound(),
    onSettingsClosed: (result) => this.onSettingsClosed(result),
  });
  /** Spočítaná rozložení podle plochy, rozsahu a nápovědy. */
  private readonly layouts = new SceneLayouts(() => ({
    gameArea: this.gameArea,
    settings: this.shownSettings(),
    round: this.round,
    hintIsShown: this.hintIsShown,
  }));
  private readonly view = new RoundView(this, this.layouts, {
    onAnswerTapped: (button) => this.onAnswerTapped(button),
    onNumberWritten: (number) => this.showWrittenNumber(number),
    onWritingConfirmed: (result) => this.onWritingConfirmed(result),
    onDotTapped: (index, circle) => this.onDotTapped(index, circle),
  });
  private readonly starRow = new StarRow(this, this.layouts, () => this.starProgress);
  /** Naplánované dokončení oslavy; nastavení ho může přerušit (#45). */
  private celebrationTimer: Phaser.Time.TimerEvent | undefined;
  private readonly confetti = new Confetti(this);
  private readonly sounds = createTonePlayer(createBrowserAudioContext);

  constructor() {
    super('game');
  }

  create(): void {
    this.gameArea = this.readGameArea();
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    const stopWatchingRecognizer = this.recognizerLoading.onChange((status) =>
      this.onRecognizerStatus(status),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      stopWatchingRecognizer();
    });
    this.starRow.create();
    this.starRow.paint();
    // Kolečko je tlačítko stránky v rohu obrazovky, mimo herní plochu.
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      attachSettingsButton(settingsButton, () => this.panels.openSettings());
    }
    this.view.listenForKeypadRelease();
    // První spuštění: místo prvního příkladu průvodce nastavením pro rodiče (#49).
    if (this.panels.guideAtStart) {
      this.panels.openSetupGuide();
    } else {
      this.startRound();
    }
  }

  /** Nastavení, jak se má rozehraný příklad ukázat: s číselníkem, nebo s okénky. */
  private shownSettings(): GameSettings {
    if (this.roundInput === undefined) {
      return this.settings;
    }
    return { ...this.settings, answerInput: this.roundInput };
  }

  /**
   * Rozpoznávání se stáhlo: okénka ho dostanou a rozepsaný zápis se rozpozná.
   * Stahování selhalo: okénka se v tomto příkladu vymění za číselník
   * a dosavadní chyby zůstanou (#58 AC5). Uložené nastavení se nemění.
   */
  private onRecognizerStatus(status: RecognizerLoadStatus): void {
    const pad = this.view.writingPad;
    if (!pad) {
      return;
    }
    const recognizer = this.recognizerLoading.recognizer();
    if (status === 'ready' && recognizer !== null) {
      pad.useRecognizer(recognizer);
    } else if (status === 'failed' && !pad.state.answer.solved) {
      this.round = switchToKeypad(pad.state);
      this.roundInput = 'keypad';
      // Příklad se nakreslí znovu s „?“ a s číselníkem místo okének.
      this.view.clear();
      this.relayoutRound(false);
    }
  }

  /** Herní plocha z registru; dokud tam není, dnešní 1024 × 768. */
  private readGameArea(): GameArea {
    return gameAreaFromRegistry(this.registry.get(GAME_AREA_KEY));
  }

  /**
   * Otočení telefonu nebo změna lišty (AC7): všechno se překreslí podle
   * nové plochy. Příklad, chyby, nápověda, hvězdičky i otevřené
   * nastavení nebo průvodce zůstanou; rozepsané tahy v okénkách se smažou.
   */
  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    // Rozložení pro starou plochu už nebudou potřeba.
    this.layouts.clear();
    this.starRow.redraw();
    this.relayoutRound(false);
    this.panels.fitTo(this.gameArea);
  }

  /**
   * Rozehrané kolo podle nového rozložení, bez nového příkladu
   * a bez započtení odpovědi. Rozepsané tahy se smažou.
   *
   * @param animateHint Tečky nápovědy naskočí (nápověda se právě ukázala).
   */
  private relayoutRound(animateHint: boolean): void {
    if (!this.round) {
      return;
    }
    const writing = this.view.writingPad?.state ?? null;
    const after = playStateAfterResize(this.playState(this.round, writing), this.writingBoxSize());
    this.view.clear();
    this.drawRound(
      after.writing !== null && isTwoBoxRound(after.writing) ? after.writing : undefined,
      animateHint,
    );
  }

  /** Rozehraný stav pro přepočet po změně velikosti okna. */
  private playState(round: AnswerRound, writing: TwoBoxRound | null): PlayState {
    return {
      round,
      settings: this.shownSettings(),
      progress: this.currentProgress(),
      counting: this.dotCounting,
      writing,
      ...this.panels.playStateParts(),
    };
  }

  /** Velikost jednoho okénka na psaní v současném rozložení. */
  private writingBoxSize(): { width: number; height: number } {
    const [first] = this.layouts.writing().writingAreas;
    return { width: first?.width ?? 0, height: first?.height ?? 0 };
  }

  override update(time: number): void {
    this.view.writingPad?.update(time);
  }

  private currentProgress(): GameProgress {
    return { earned: this.starProgress.earned };
  }

  /** Uloží hvězdičky do zařízení; když to nejde, hra jede dál. */
  private saveProgress(): void {
    saveProgress(browserStorage(), this.currentProgress());
  }

  /** Po ✓ v nastavení: případně dokončená oslava a nový příklad. */
  private onSettingsClosed(result: ConfirmedSettings): void {
    this.applyProgressAfterSettings(result.progress);
    if (result.startNewProblem) {
      this.startRound();
    }
  }

  /** Když nastavení přerušilo oslavu, dokončí se jako po oslavě (nová prázdná řada). */
  private applyProgressAfterSettings(progress: GameProgress): void {
    if (progress.earned === this.starProgress.earned) {
      return;
    }
    this.stopCelebration();
    this.starProgress = { earned: progress.earned };
    this.saveProgress();
    this.starRow.paint();
  }

  /** Zastaví naplánované dokončení oslavy a uklidí konfety. */
  private stopCelebration(): void {
    this.celebrationTimer?.remove();
    this.celebrationTimer = undefined;
    this.confetti.clear();
  }

  private startRound(): void {
    this.view.clear();
    // Nový příklad nesmí být stejný jako ten z minulého kola (při startu žádný není).
    this.round = createAnswerRound(this.settings, Math.random, this.round?.problem);
    this.hintIsShown = false;
    this.dotCounting = startDotCounting(this.round.problem);
    this.roundInput = this.recognizerLoading.answerInput(this.settings);
    this.drawRound();
    // Stahování rozpoznávání nesmí zdržet první obrázek: začne po vykreslení (#58 AC2).
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
      this.recognizerLoading.problemDrawn(),
    );
  }

  /** Nakreslí rozehrané kolo (viz `RoundView.draw`). */
  private drawRound(writingState?: TwoBoxRound, animateHint = false): void {
    if (!this.round) {
      return;
    }
    const drawing = {
      round: this.round,
      settings: this.shownSettings(),
      recognizer: this.recognizerLoading.recognizer(),
      hintIsShown: this.hintIsShown,
      counting: this.dotCounting,
    };
    this.view.draw(drawing, writingState, animateHint);
  }

  /** Rozpoznané číslo se ukáže modře místo „?“, dokud ho dítě nepotvrdí. */
  private showWrittenNumber(number: number | null): void {
    if (!this.round || this.round.solved || !this.view.problem.hasAnswer) {
      return;
    }
    this.view.problem.showWritten(this.round, number, this.layouts.scenery());
  }

  private onWritingConfirmed(result: TwoBoxConfirmResult): void {
    const pad = this.view.writingPad;
    if (!pad) {
      return;
    }
    this.round = result.round.answer;
    this.applyOutcome(result.outcome, pad.confirmPosition, {
      onCorrect: () => pad.lock(),
      onWrong: () => this.showWrittenNumber(null),
    });
  }

  private onAnswerTapped(button: AnswerButton): void {
    if (!this.round) {
      return;
    }
    const result = tapAnswer(this.round, button.value);
    this.round = result.round;
    this.applyOutcome(result.outcome, button.container, {
      onCorrect: () => highlightCorrectButton(this, button),
      onWrong: () => shakeWrongButton(this, button),
    });
  }

  /**
   * Společné vyhodnocení pro číselník i psaní: zvuk, hvězdička,
   * výsledek v příkladu a nápověda po 2. chybě.
   */
  private applyOutcome(
    outcome: TapOutcome,
    origin: Origin,
    visuals: { onCorrect: () => void; onWrong: () => void },
  ): void {
    const sound = soundForOutcome(outcome);
    if (sound) {
      this.sounds.play(SOUNDS[sound]);
    }

    const stars = starsAfterTap(this.starProgress, outcome);
    this.starProgress = stars.progress;
    if (stars.starEarned) {
      this.saveProgress();
    }

    if (outcome === 'correct') {
      visuals.onCorrect();
      this.celebrateCorrectAnswer(origin, stars.setCompleted);
    } else if (outcome === 'wrong') {
      visuals.onWrong();
      this.showHintWhenNeeded();
    }
  }

  private showHintWhenNeeded(): void {
    if (!this.round || this.hintIsShown || !isHintVisible(this.round)) {
      return;
    }
    this.hintIsShown = true;
    if (hintMovesLayout(this.layouts.answer())) {
      // Na telefonu na šířku nápověda potřebuje místo: rozložení se přepočítá (V2, #54).
      // Na výšku má místo vyhrazené (#56) a nic se neposune.
      this.relayoutRound(true);
      return;
    }
    this.view.drawHint(this.round, this.dotCounting, true);
  }

  /** Ťuknutá tečka se rozsvítí, ukáže pořadové číslo a zazní o tón výš. */
  private onDotTapped(index: number, circle: Phaser.GameObjects.Arc): void {
    if (!this.round) {
      return;
    }
    const result = countDot(this.round, this.dotCounting, index);
    this.dotCounting = result.counting;
    if (result.countedNumber === null) {
      return;
    }
    this.sounds.play([countingTone(result.countedNumber)]);
    this.view.showDotCounted(this.round, this.dotCounting, circle, result.countedNumber);
  }

  private celebrateCorrectAnswer(origin: Origin, setCompleted: boolean): void {
    if (this.round) {
      this.view.problem.reveal(this.round, this.layouts.scenery());
    }
    this.starRow.flyToRow(origin, () => {
      if (setCompleted) {
        this.celebrateFullSet();
      }
    });

    if (!setCompleted) {
      this.time.delayedCall(NEXT_PROBLEM_DELAY_MS, () => this.startRound());
    }
  }

  /** Oslava po zaplnění řady: konfety a melodie, pak nová prázdná řada. */
  private celebrateFullSet(): void {
    // Nastavení mezitím mohlo oslavu přerušit a řadu vyprázdnit (#45).
    if (this.starProgress.earned < STARS_PER_SET || this.panels.isOpen) {
      return;
    }
    this.sounds.play(SOUNDS.celebration);
    this.confetti.throw(this.gameArea, this.layouts.keypad().detailScale);

    this.celebrationTimer = this.time.delayedCall(CELEBRATION_MS, () => {
      this.celebrationTimer = undefined;
      this.confetti.forget();
      this.starProgress = startNewStarSet();
      this.saveProgress();
      this.starRow.paint();
      this.startRound();
    });
  }
}
