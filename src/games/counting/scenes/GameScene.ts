import Phaser from 'phaser';

import { sharedToneContext } from '../../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../../shared/audio/tonePlayer';
import { GAME_HOST_KEY, isGameHost } from '../../../shared/logic/gameHost';
import type { GameHost } from '../../../shared/logic/gameHost';
import { gameAreaFor } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { browserStorage } from '../../../shared/storage/keyValueStorage';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import type { TapOutcome } from '../logic/answerRound';
import { createCountingSession } from '../logic/countingSession';
import type { CountingSession, SessionChange, SessionPage } from '../logic/countingSession';
import { hintMovesLayout, isTwoBoxRound, playStateAfterResize } from '../logic/deviceLayout';
import type { PlayState } from '../logic/deviceLayout';
import type { GameProgress } from '../logic/progress';
import { loadDigitRecognizer } from '../logic/recognizerLoading';
import type { RecognizerLoadStatus } from '../logic/recognizerLoading';
import type { GameSettings } from '../logic/settings';
import { switchToKeypad } from '../logic/twoBoxWriting';
import type { TwoBoxConfirmResult, TwoBoxRound } from '../logic/twoBoxWriting';
import { highlightCorrectButton, shakeWrongButton } from './AnswerButton';
import type { AnswerButton } from './AnswerButton';
import { Confetti } from './Confetti';
import { ParentPanels } from './ParentPanels';
import { RoundView } from './RoundView';
import { SceneLayouts, gameAreaFromRegistry } from './SceneLayouts';
import { StarRow } from './StarRow';
import type { Origin } from './StarRow';

/** Bez stránky (hra spuštěná jinak než z menu) kolečko nic neotevře. */
const NO_PAGE: SessionPage = { attachSettingsGear: () => () => undefined };

/**
 * Scéna jen kreslí a animuje; co se ve hře děje (příklad, odpovědi,
 * hvězdičky, oslava, nastavení, průvodce, stahování rozpoznávání psaní
 * a odchod do menu) řídí sezení hry `countingSession.ts` (#68).
 * Rozložení se bere podle herní plochy (iPad, telefon na šířku #54, nebo
 * na výšku #56) a při otočení telefonu se překreslí bez nového příkladu.
 * Části obrazovky kreslí samostatné soubory vedle (#57): `RoundView`
 * (příklad, číselník, okénka, nápověda), `StarRow`, `Confetti`
 * a `ParentPanels` (nastavení a průvodce).
 */
export class GameScene extends Phaser.Scene {
  /**
   * Sezení tohoto vstupu do hry. Vznikne v `create` (potřebuje registr
   * a čas scény), dřív se scéna na nic neptá.
   */
  private session!: CountingSession;
  /** Herní plocha podle okna; nastavuje ji src/shared/ui/gameRunner.ts do registru. */
  private gameArea: GameArea = gameAreaFor(undefined);
  /** Je nakreslený příklad (při průvodci na začátku ještě ne)? */
  private roundDrawn = false;
  /** Jsou nakreslené tečky nápovědy? */
  private hintIsShown = false;
  private readonly panels = new ParentPanels(this, {
    settings: () => this.session.settings(),
    gameArea: () => this.gameArea,
    onSettingsConfirmed: (chosen) => this.session.confirmSettings(chosen),
    onGuideFinished: (chosen) => this.session.finishGuide(chosen),
  });
  /** Spočítaná rozložení podle plochy, rozsahu a nápovědy. */
  private readonly layouts = new SceneLayouts(() => ({
    gameArea: this.gameArea,
    settings: this.shownSettings(),
    round: this.roundDrawn ? this.session.round() : undefined,
    hintIsShown: this.hintIsShown,
  }));
  private readonly view = new RoundView(this, this.layouts, {
    onAnswerTapped: (button) => this.onAnswerTapped(button),
    onNumberWritten: (number) => this.showWrittenNumber(number),
    onWritingConfirmed: (result) => this.onWritingConfirmed(result),
    onDotTapped: (index, circle) => this.onDotTapped(index, circle),
  });
  private readonly starRow = new StarRow(this, this.layouts, () => this.currentProgress());
  private readonly confetti = new Confetti(this);
  // Společný zvukový kontext stránky, odemčený už ťuknutím v menu (#67 AC6).
  private readonly sounds = createTonePlayer(sharedToneContext);

  constructor() {
    super('game');
  }

  create(): void {
    this.gameArea = this.readGameArea();
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      // Hra skončila jinak než domečkem: sezení se zastaví stejně.
      this.session.leave();
    });
    const host = this.readHost();
    const session = createCountingSession({
      storage: browserStorage(),
      random: Math.random,
      sounds: this.sounds,
      voice: { stop: () => this.panels.stopVoice() },
      timers: {
        after: (ms, callback) => {
          const timer = this.time.delayedCall(ms, callback);
          return () => timer.remove(false);
        },
      },
      page: host ?? NO_PAGE,
      loadRecognizer: loadDigitRecognizer,
      onChange: (change) => this.onSessionChange(change),
    });
    this.session = session;
    host?.onLeave(() => session.leave());

    this.starRow.create();
    this.starRow.paint();
    this.view.listenForKeypadRelease();
    // První spuštění: místo prvního příkladu průvodce nastavením pro rodiče (#49).
    if (session.guideOpen()) {
      this.panels.openSetupGuide();
    } else {
      this.drawNewRound();
    }
    this.updateHome();
  }

  /** Stránka s kolečkem a domečkem z registru; bez ní hra běží jen bez nich. */
  private readHost(): GameHost | undefined {
    const stored: unknown = this.registry.get(GAME_HOST_KEY);
    return isGameHost(stored) ? stored : undefined;
  }

  /** Domeček je vidět jen tehdy, když jde použít (ne v nastavení a průvodci, #68 AC4). */
  private updateHome(): void {
    this.readHost()?.setHomeAvailable(this.session.homeAvailable());
  }

  /** Sezení ohlásilo změnu; scéna ji nakreslí. */
  private onSessionChange(change: SessionChange): void {
    switch (change.kind) {
      case 'roundStarted':
        this.drawNewRound();
        break;
      case 'celebrationStarted':
        this.confetti.throw(this.gameArea, this.layouts.keypad().detailScale);
        break;
      case 'celebrationEnded':
        this.confetti.forget();
        this.starRow.paint();
        break;
      case 'celebrationStopped':
        this.confetti.clear();
        break;
      case 'starsChanged':
        this.confetti.clear();
        this.starRow.paint();
        break;
      case 'settingsOpened':
        this.panels.openSettings();
        break;
      case 'settingsClosed':
      case 'guideClosed':
        break;
      case 'recognizer':
        this.onRecognizerStatus(change.status);
        break;
    }
    this.updateHome();
  }

  /** Nastavení, jak se má rozehraný příklad ukázat: s číselníkem, nebo s okénky. */
  private shownSettings(): GameSettings {
    return { ...this.session.settings(), answerInput: this.session.answerInput() };
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
    const recognizer = this.session.recognizer();
    if (status === 'ready' && recognizer !== null) {
      pad.useRecognizer(recognizer);
    } else if (status === 'failed' && !pad.state.answer.solved) {
      this.session.switchToKeypad(switchToKeypad(pad.state));
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
    if (!this.roundDrawn) {
      return;
    }
    const writing = this.view.writingPad?.state ?? null;
    const after = playStateAfterResize(this.playState(writing), this.writingBoxSize());
    this.view.clear();
    this.drawRound(
      after.writing !== null && isTwoBoxRound(after.writing) ? after.writing : undefined,
      animateHint,
    );
  }

  /** Rozehraný stav pro přepočet po změně velikosti okna. */
  private playState(writing: TwoBoxRound | null): PlayState {
    const session = this.session;
    return {
      round: session.round(),
      settings: this.shownSettings(),
      progress: this.currentProgress(),
      counting: session.dotCounting(),
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
    return { earned: this.session.starCount() };
  }

  /** Nový příklad od sezení: smaže staré kolo a nakreslí nové. */
  private drawNewRound(): void {
    this.view.clear();
    this.roundDrawn = true;
    this.hintIsShown = false;
    this.drawRound();
    // Stahování rozpoznávání nesmí zdržet první obrázek: začne po vykreslení (#58 AC2).
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => this.session.problemDrawn());
  }

  /** Nakreslí rozehrané kolo (viz `RoundView.draw`). */
  private drawRound(writingState?: TwoBoxRound, animateHint = false): void {
    const session = this.session;
    const drawing = {
      round: session.round(),
      settings: this.shownSettings(),
      recognizer: session.recognizer(),
      hintIsShown: this.hintIsShown,
      counting: session.dotCounting(),
    };
    this.view.draw(drawing, writingState, animateHint);
  }

  /** Rozpoznané číslo se ukáže modře místo „?“, dokud ho dítě nepotvrdí. */
  private showWrittenNumber(number: number | null): void {
    const round = this.session.round();
    if (round.solved || !this.view.problem.hasAnswer) {
      return;
    }
    this.view.problem.showWritten(round, number, this.layouts.scenery());
  }

  private onWritingConfirmed(result: TwoBoxConfirmResult): void {
    const pad = this.view.writingPad;
    if (!pad) {
      return;
    }
    const outcome = this.session.answerWritten(result.round.answer, result.outcome);
    this.showOutcome(outcome, pad.confirmPosition, {
      onCorrect: () => pad.lock(),
      onWrong: () => this.showWrittenNumber(null),
    });
  }

  private onAnswerTapped(button: AnswerButton): void {
    const outcome = this.session.tapAnswer(button.value);
    this.showOutcome(outcome, button.container, {
      onCorrect: () => highlightCorrectButton(this, button),
      onWrong: () => shakeWrongButton(this, button),
    });
  }

  /**
   * Společná odezva číselníku i psaní: výsledek v příkladu, let hvězdičky
   * a nápověda po 2. chybě. Zvuk, hvězdičku a další příklad řeší sezení.
   */
  private showOutcome(
    outcome: TapOutcome,
    origin: Origin,
    visuals: { onCorrect: () => void; onWrong: () => void },
  ): void {
    if (outcome === 'correct') {
      visuals.onCorrect();
      this.view.problem.reveal(this.session.round(), this.layouts.scenery());
      this.starRow.flyToRow(origin, () => undefined);
    } else if (outcome === 'wrong') {
      visuals.onWrong();
      this.showHintWhenNeeded();
    }
  }

  private showHintWhenNeeded(): void {
    const session = this.session;
    if (this.hintIsShown || !session.hintVisible()) {
      return;
    }
    this.hintIsShown = true;
    if (hintMovesLayout(this.layouts.answer())) {
      // Na telefonu na šířku nápověda potřebuje místo: rozložení se přepočítá (V2, #54).
      // Na výšku má místo vyhrazené (#56) a nic se neposune.
      this.relayoutRound(true);
      return;
    }
    this.view.drawHint(session.round(), session.dotCounting(), true);
  }

  /** Ťuknutá tečka se rozsvítí, ukáže pořadové číslo a zazní o tón výš (tón hraje sezení). */
  private onDotTapped(index: number, circle: Phaser.GameObjects.Arc): void {
    const session = this.session;
    const countedNumber = session.tapDot(index);
    if (countedNumber === null) {
      return;
    }
    this.view.showDotCounted(session.round(), session.dotCounting(), circle, countedNumber);
  }
}
