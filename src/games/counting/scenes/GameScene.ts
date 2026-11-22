import Phaser from 'phaser';

import { sharedToneContext } from '../../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../../shared/audio/tonePlayer';
import { GAME_HOST_KEY, isGameHost } from '../../../shared/logic/gameHost';
import type { GameHost } from '../../../shared/logic/gameHost';
import { gameAreaFor } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { Confetti } from '../../../shared/ui/Confetti';
import type { RudyVariants } from '../../../shared/storage/rudyVariantsStorage';
import { RudyMoments } from '../../../shared/ui/rudyMoments';
import { followCanvasResolution } from '../../../shared/ui/sharpCanvas';
import type { Origin } from '../../../shared/ui/StarRow';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import type { TapOutcome } from '../logic/answerRound';
import { STAR_FLIGHT_MS, createCountingSession } from '../logic/countingSession';
import type {
  CountingSession,
  SessionChange,
  SessionPage,
  SessionRudy,
  SessionRudyEvents,
} from '../logic/countingSession';
import { isTwoBoxRound, playStateAfterResize } from '../logic/deviceLayout';
import type { PlayState } from '../logic/deviceLayout';
import type { GameProgress } from '../logic/progress';
import { countingRudyLines, countingRudyVoiceUrl } from '../logic/rudyLines';
import type { CountingRudyLine } from '../logic/rudyLines';
import { loadDigitRecognizer } from '../logic/recognizerLoading';
import type { RecognizerLoadStatus } from '../logic/recognizerLoading';
import { ABOVE_MAP_DEPTH } from '../../../shared/logic/mapDepths';
import type { GameSettings } from '../logic/settings';
import { switchToKeypad } from '../logic/twoBoxWriting';
import type { TwoBoxConfirmResult, TwoBoxRound } from '../logic/twoBoxWriting';
import { highlightCorrectButton } from './AnswerButton';
import type { AnswerButton } from './AnswerButton';
import { ParentPanels } from './ParentPanels';
import { MapCardScreen } from '../../../shared/ui/MapCardScreen';
import { RoundView } from './RoundView';
import { SceneLayouts, gameAreaFromRegistry } from './SceneLayouts';
import { MapStarRow } from '../../../shared/ui/MapStarRow';

/** Bez stránky (hra spuštěná jinak než z menu) kolečko nic neotevře. */
const NO_PAGE: SessionPage = { attachSettingsGear: () => () => undefined };

/**
 * Scéna jen kreslí a animuje; co se ve hře děje (příklad, odpovědi,
 * hvězdičky, oslava, nastavení, průvodce, stahování rozpoznávání psaní
 * a odchod do menu) řídí sezení hry `countingSession.ts` (#68).
 * Rozložení se bere podle herní plochy (iPad, telefon na šířku #54, nebo
 * na výšku #56) a při otočení telefonu se překreslí bez nového příkladu.
 * Části obrazovky kreslí samostatné soubory vedle (#57): `RoundView`
 * (příklad, číselník, okénka, nápověda), `MapStarRow` (sdílená řada
 * hvězdiček s letem do mapy), sdílené `Confetti`,
 * sdílené `MapCardScreen` (karta se společnou mapou postupu po oslavě,
 * #87, #145, #193) a `ParentPanels`
 * (nastavení a průvodce). Panda Rudy (oslava po 10. hvězdičce přímo na
 * obrazovce, #170, #186) je sdílené `RudyMoments`; kdy se ukáže, řídí
 * sezení.
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
  /** Ukázala se nápověda (tečky jsou nakreslené, nebo naskočí po zhoupnutí tlačítka, #84)? */
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
  }));
  private readonly view = new RoundView(this, this.layouts, {
    onAnswerTapped: (button) => this.onAnswerTapped(button),
    onNumberWritten: (number) => this.showWrittenNumber(number),
    onWritingConfirmed: (result) => this.onWritingConfirmed(result),
    onDotTapped: (index, circle) => this.onDotTapped(index, circle),
    onHintButtonTapped: () => this.onHintButtonTapped(),
  });
  private readonly starRow = new MapStarRow(
    this,
    () => ({
      stars: this.layouts.scenery().stars,
      starSize: this.layouts.scenery().starSize,
      detailScale: this.layouts.keypad().detailScale,
    }),
    () => this.currentProgress(),
    STAR_FLIGHT_MS,
  );
  private readonly confetti = new Confetti(this, ABOVE_MAP_DEPTH);
  /** Karta s mapou postupu po oslavě, společná všem hrám s hvězdičkami (#145, #193). */
  private readonly progressMap = new MapCardScreen(this, {
    gameArea: () => this.gameArea,
    fit: 'fixed',
    host: () => this.readHost(),
    source: () => ({
      shownMove: () => this.session.shownMap(),
      goalKeyReward: () => this.session.goalKeyReward(),
      mapProgress: () => this.session.mapProgress(),
      tap: () => this.session.tapMap(),
    }),
  });
  // Společný zvukový kontext stránky, odemčený už ťuknutím v menu (#67 AC6).
  private readonly sounds = createTonePlayer(sharedToneContext);
  /** Panda Rudy (#170, #186); vznikne v `create`, kód a obrázky stáhne až při oslavě. */
  private rudy!: RudyMoments;

  constructor() {
    super('game');
  }

  /** Symboly cíle map jsou malé, načtou se hned se scénou (#134 AC2). */
  preload(): void {
    this.progressMap.preload();
  }

  create(): void {
    // Ostré plátno na iPadu a ve zmenšeném zobrazení (#77); kreslí se dál v herních jednotkách.
    followCanvasResolution(this);
    this.gameArea = this.readGameArea();
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      // Hra skončila jinak než domečkem: sezení se zastaví stejně.
      this.session.leave();
    });
    const host = this.readHost();
    this.rudy = new RudyMoments(this);
    const session = createCountingSession({
      // Úložiště aktivního profilu od stránky (#71); bez stránky jen paměť.
      storage: host?.storage,
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
      // Klíče aktivního profilu od stránky (#139); bez stránky mapa klíč nedává.
      keyRewards: host?.keyRewards,
      // Mapa postupu aktivního profilu, společná všem hrám (#193); bez stránky jen paměť.
      mapProgress: host?.mapProgress,
      rudy: this.sessionRudy(countingRudyLines(host?.storage)),
      onChange: (change) => this.onSessionChange(change),
    });
    this.session = session;
    host?.onLeave(() => session.leave());

    this.progressMap.prepare();
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

  /** Rudy pro sezení; kdy se ukáže a stáhne dopředu, řídí sezení (#170, #186). */
  private sessionRudy(lines: RudyVariants<CountingRudyLine>): SessionRudy {
    const rudy = this.rudy;
    return {
      // Replika zazní v jazyce zvoleném v menu ve chvíli, kdy hra o Rudyho požádá (#171).
      // Varianty se v profilu střídají; zapamatuje se až ta, se kterou se Rudy ukázal (#176).
      celebrate: (events: SessionRudyEvents) => {
        const line = lines.upcoming();
        rudy.celebrate({
          onOpened: () => {
            lines.said(line);
            events.onOpened();
          },
          onClosed: () => events.onClosed(),
          voiceUrl: countingRudyVoiceUrl(line),
        });
      },
      prepare: () => rudy.prepare(countingRudyVoiceUrl(lines.upcoming())),
      stop: () => rudy.stop(),
    };
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
        this.progressMap.prepare();
        break;
      case 'celebrationStarted':
        this.confetti.throw(this.gameArea, this.layouts.keypad().detailScale);
        break;
      case 'celebrationEnded':
        // Hvězdičky doletěly do mapy; konfety padají dál přes okno (#154).
        this.starRow.stopMapFlight();
        this.starRow.paint();
        break;
      case 'celebrationStopped':
        this.confetti.clear();
        break;
      case 'starsChanged':
        this.confetti.clear();
        this.starRow.stopMapFlight();
        this.starRow.paint();
        break;
      case 'mapShown':
        this.progressMap.show(this.starRow);
        break;
      case 'mapHidden':
        // Okno se zavřelo: zbylé konfety dopadnou samy (#154 AC1).
        this.confetti.forget();
        this.progressMap.hide();
        break;
      case 'mapStopped':
        // Nastavení přerušilo okno i let hvězdiček: nic se nedohraje (#154 AC6).
        this.confetti.clear();
        this.starRow.stopMapFlight();
        this.progressMap.hide();
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
      this.relayoutRound();
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
    this.relayoutRound();
    this.progressMap.relayout();
    this.panels.fitTo(this.gameArea);
    this.rudy.relayout();
  }

  /**
   * Rozehrané kolo podle nového rozložení, bez nového příkladu
   * a bez započtení odpovědi. Rozepsané tahy se smažou a nápověda je
   * vidět hned, bez naskakování.
   */
  private relayoutRound(): void {
    if (!this.roundDrawn) {
      return;
    }
    const writing = this.view.writingPad?.state ?? null;
    const after = playStateAfterResize(this.playState(writing), this.writingBoxSize());
    this.view.clear();
    this.drawRound(
      after.writing !== null && isTwoBoxRound(after.writing) ? after.writing : undefined,
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
    this.view.update(this.time.now);
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
      hintButtonVisible: session.hintButtonVisible(),
      hintButtonGlowing: session.hintButtonGlowing(),
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
      onWrong: () => {
        this.showWrittenNumber(null);
        this.view.showWrongAnswer(null, this.session.hintButtonGlowing());
      },
    });
  }

  private onAnswerTapped(button: AnswerButton): void {
    const outcome = this.session.tapAnswer(button.value);
    this.showOutcome(outcome, button.container, {
      onCorrect: () => highlightCorrectButton(this, button),
      onWrong: () => this.view.showWrongAnswer(button, this.session.hintButtonGlowing()),
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
      this.view.hideHintButton();
      this.view.problem.reveal(this.session.round(), this.layouts.scenery());
      this.starRow.flyToRow(origin, () => undefined);
    } else if (outcome === 'wrong') {
      visuals.onWrong();
      this.showHintWhenNeeded();
    }
  }

  /**
   * Nápověda po 2. chybě nahradí tlačítko nápovědy. Rozložení se nemění:
   * na telefonu na šířku má nápověda místo od začátku příkladu (#84).
   */
  private showHintWhenNeeded(): void {
    const session = this.session;
    if (this.hintIsShown || !session.hintVisible()) {
      return;
    }
    this.hintIsShown = true;
    this.view.hideHintButton();
    this.view.drawHint(session.round(), session.dotCounting(), true);
  }

  /** Tlačítko nápovědy (#84): tón zahraje sezení, tlačítko se zhoupne a tečky naskočí. */
  private onHintButtonTapped(): void {
    const session = this.session;
    if (this.hintIsShown || !session.tapHintButton()) {
      return;
    }
    this.hintIsShown = true;
    this.view.swingAwayHintButton(() =>
      this.view.drawHint(session.round(), session.dotCounting(), true),
    );
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
