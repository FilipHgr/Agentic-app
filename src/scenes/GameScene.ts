import Phaser from 'phaser';

import { createBrowserAudioContext, createTonePlayer } from '../audio/tonePlayer';
import {
  answerChoices,
  createAnswerRound,
  problemText,
  hintCrossedOutDots,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../logic/answerRound';
import type { AnswerRound, TapOutcome } from '../logic/answerRound';
import { SOUNDS, soundForOutcome } from '../logic/answerSounds';
import { buttonCornerRadius } from '../logic/checkButton';
import {
  CONFETTI_COLORS,
  FONT_FAMILY,
  HINT_DOT_STYLE,
  KEYPAD_BUTTON_STYLE,
  PROBLEM_STYLE,
  STAR_STYLE,
  answerButtonLook,
  colorNumber,
  starLooks,
} from '../logic/theme';
import type { AnswerButtonState } from '../logic/theme';
import { countDot, countingTone, startDotCounting } from '../logic/dotCounting';
import type { DotCounting } from '../logic/dotCounting';
import {
  isTwoBoxRound,
  gameAreaFor,
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
  playStateAfterResize,
} from '../logic/deviceLayout';
import type {
  DeviceScreenLayout,
  DeviceSizes,
  DeviceWritingLayout,
  GameArea,
  PlayState,
} from '../logic/deviceLayout';
import { mascotReactionToTap } from '../logic/mascot';
import type { ButtonSlot, HintDot } from '../logic/screenLayout';
import { STARS_PER_SET, startNewStarSet, starsAfterTap } from '../logic/stars';
import type { StarProgress } from '../logic/stars';
import { nextCharacter } from '../logic/characters';
import type { CharacterId } from '../logic/characters';
import { isWritingActive } from '../logic/settings';
import type { GameSettings } from '../logic/settings';
import {
  CLOSED_SETTINGS,
  confirmSettings,
  createLaunchState,
  openSettings,
  pageAppearance,
} from '../logic/settingsSession';
import {
  canOpenSettingsByHold,
  guideAtStart,
  guidePageAppearance,
  launchAfterGuide,
} from '../logic/setupGuide';
import type { LaunchState } from '../logic/settingsSession';
import type { GameProgress } from '../logic/progress';
import type { TwoBoxConfirmResult, TwoBoxRound } from '../logic/twoBoxWriting';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { browserStorage, loadSettingsState, saveSettings } from '../storage/settingsStorage';
import { Mascot } from './Mascot';
import type { MascotLook } from './Mascot';
import { applyPageAppearance } from '../ui/pageAppearance';
import { attachSettingsButton } from '../ui/settingsButton';
import { GAME_AREA_KEY } from '../ui/viewport';
import { SettingsPanel } from './SettingsPanel';
import { SetupGuidePanel } from './SetupGuidePanel';
import { WritingPad } from './WritingPad';

/** Každé sčítané číslo má tečky jiné barvy (#30); barvy jsou v `theme.ts` (#52). */
const HINT_GROUP_COLORS = HINT_DOT_STYLE.groupColors.map(colorNumber);

/** Odečítané tečky u odčítání jsou šedé a přeškrtnuté. */
const HINT_CROSSED_OUT_COLOR = colorNumber(HINT_DOT_STYLE.crossedOutColor);
const HINT_CROSS_COLOR = colorNumber(HINT_DOT_STYLE.crossColor);

/** Číslo na tlačítku zabírá asi dvě třetiny jeho výšky. */
const BUTTON_LABEL_RATIO = 0.64;

/** Spočítaná tečka dostane tmavý okraj a tmavé číslo, které je vidět na žluté i modré. */
const DOT_COUNTED_RING_COLOR = colorNumber(HINT_DOT_STYLE.countedRingColor);
const DOT_COUNTED_RING_WIDTH = 6;
const DOT_NUMBER_COLOR = HINT_DOT_STYLE.countedNumberColor;

/** Tečky naskakují jedna po druhé, aby je dítě mohlo počítat s nimi. */
const HINT_DOT_DELAY_MS = 120;

/** Výsledek v příkladu po správné odpovědi: zelený jako správné tlačítko. */
const ANSWER_REVEALED_COLOR = PROBLEM_STYLE.revealedAnswerColor;
const PROBLEM_TEXT_COLOR = PROBLEM_STYLE.color;
const QUESTION_MARK_COLOR = PROBLEM_STYLE.questionMarkColor;

/** Rozpoznaná, ještě nepotvrzená číslice v příkladu: modrá jako číslice číselníku. */
const ANSWER_WRITTEN_COLOR = PROBLEM_STYLE.writtenDigitColor;

/** Mezera mezi rovnítkem a odpovědí jako část velikosti písma (přibližná šířka mezery). */
const ANSWER_GAP_RATIO = 0.28;

/** Jak dlouho se po správné odpovědi čeká na nový příklad. */
const NEXT_PROBLEM_DELAY_MS = 800;

const STAR_EMPTY_COLOR = colorNumber(STAR_STYLE.emptyColor);
const STAR_FILLED_COLOR = colorNumber(STAR_STYLE.earnedColor);

/** Jak dlouho letí hvězdička od tlačítka do řady nahoře. */
const STAR_FLIGHT_MS = 450;

/** Jak dlouho trvá oslava po zaplnění řady, než přijde nový příklad. */
const CELEBRATION_MS = 2600;

const CONFETTI_COUNT = 80;
/** Velikost konfet, odkud padají a jak daleko uletí do strany (na iPadu). */
const CONFETTI_WIDTH = 14;
const CONFETTI_HEIGHT = 22;
const CONFETTI_START_Y = -20;
const CONFETTI_DRIFT = 120;
const CONFETTI_END_MARGIN = 30;

/** O kolik se tlačítko zatřese po špatné odpovědi (na iPadu). */
const BUTTON_SHAKE_DISTANCE = 14;
/** Konfety v barvách, které jsou na světlém pozadí vidět (#53). */
const CONFETTI_COLOR_NUMBERS = CONFETTI_COLORS.map(colorNumber);

/** Místo, odkud vyletí hvězdička za správnou odpověď. */
interface Origin {
  readonly x: number;
  readonly y: number;
}

interface AnswerButton {
  readonly value: number;
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly size: number;
  /** Vodorovná poloha, kam se tlačítko vrací po zatřesení. */
  readonly homeX: number;
  /** Tloušťka okraje a zatřesení proti iPadu (#54). */
  readonly detailScale: number;
}

/** Velikost postavičky a jejích pohybů z rozložení. */
function mascotLookOf(sizes: DeviceSizes): MascotLook {
  return {
    size: sizes.mascotSize,
    jumpHeight: sizes.mascotJumpHeight,
    danceSway: sizes.mascotDanceSway,
  };
}

/**
 * Scéna jen kreslí kolo a animuje; o správnosti rozhoduje logika v src/logic.
 * Rozložení se bere podle herní plochy (iPad, nebo telefon na šířku, #54)
 * a při otočení telefonu se překreslí bez nového příkladu.
 */
export class GameScene extends Phaser.Scene {
  private round: AnswerRound | undefined;
  /** Herní plocha podle okna; nastavuje ji src/main.ts do registru. */
  private gameArea: GameArea = gameAreaFor(undefined);
  private roundObjects: Phaser.GameObjects.GameObject[] = [];
  private problemEquation: Phaser.GameObjects.Text | undefined;
  private problemAnswer: Phaser.GameObjects.Text | undefined;
  private hintIsShown = false;
  /** Prst, který právě drží tlačítko číselníku; další prsty se nepočítají. */
  private keypadPointerId: number | undefined;
  /** Které tečky nápovědy už dítě spočítalo ťuknutím (#43). */
  private dotCounting: DotCounting = { numbers: [] };
  /** Plocha na psaní, když dítě odpovídá psaním (#41); jinak číselník. */
  private writingPad: WritingPad | undefined;
  // Hvězdičky a postavička přežijí zavření hry (načtou se ze zařízení).
  private readonly savedProgress = loadProgress(browserStorage());
  private starProgress: StarProgress = { earned: this.savedProgress.earned };
  private starIcons: Phaser.GameObjects.Star[] = [];
  private mascot: Mascot | undefined;
  private character: CharacterId = this.savedProgress.character;
  private readonly settingsState = loadSettingsState(browserStorage());
  private settings: GameSettings = this.settingsState.settings;
  /** Při prvním spuštění se místo příkladu otevře průvodce nastavením (#49). */
  private launch: LaunchState = createLaunchState(this.settingsState.firstLaunch);
  private settingsOpen = false;
  /** Otevřené nastavení pro rodiče, aby šlo po otočení telefonu zmenšit (#54). */
  private settingsPanel: SettingsPanel | undefined;
  /** Spočítaná rozložení podle plochy, rozsahu a nápovědy (viz `layoutKey`). */
  private readonly keypadLayouts = new Map<string, DeviceScreenLayout>();
  private readonly writingLayouts = new Map<string, DeviceWritingLayout>();
  /** Průvodce nastavením při prvním spuštění (#49), když je otevřený. */
  private setupGuide: SetupGuidePanel | undefined;
  /** Naplánované dokončení oslavy; nastavení ho může přerušit (#45). */
  private celebrationTimer: Phaser.Time.TimerEvent | undefined;
  private confettiPieces: Phaser.GameObjects.Rectangle[] = [];
  private readonly sounds = createTonePlayer(createBrowserAudioContext);

  constructor() {
    super('game');
  }

  preload(): void {
    // Když se obrázek nenačte, hra běží dál bez postavičky (viz Mascot.showMood).
    Mascot.preload(this);
  }

  create(): void {
    this.gameArea = this.readGameArea();
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this),
    );
    this.createStarRow();
    this.paintStars();
    const layout = this.layout();
    this.mascot = new Mascot(this, layout.mascot, mascotLookOf(layout), this.character);
    // Kolečko je tlačítko stránky v rohu obrazovky, mimo herní plochu.
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      attachSettingsButton(settingsButton, () => this.openSettings());
    }
    // Prst puštěný i mimo hrací plochu číselník uvolní, aby se nezasekl.
    const releaseKeypad = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.keypadPointerId) {
        this.keypadPointerId = undefined;
      }
    };
    this.input.on('pointerup', releaseKeypad);
    this.input.on('pointerupoutside', releaseKeypad);
    // První spuštění: místo prvního příkladu průvodce nastavením pro rodiče (#49).
    if (guideAtStart(this.launch)) {
      this.openSetupGuide();
    } else {
      this.startRound();
    }
  }

  /** Herní plocha z registru; dokud tam není, dnešní 1024 × 768. */
  private readGameArea(): GameArea {
    const stored: unknown = this.registry.get(GAME_AREA_KEY);
    return isGameArea(stored) ? stored : gameAreaFor(undefined);
  }

  /**
   * Otočení telefonu nebo změna lišty (AC7): všechno se překreslí podle
   * nové plochy. Příklad, chyby, nápověda, hvězdičky, postavička i otevřené
   * nastavení nebo průvodce zůstanou; rozepsané tahy v okénkách se smažou.
   */
  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    // Rozložení pro starou plochu už nebudou potřeba.
    this.keypadLayouts.clear();
    this.writingLayouts.clear();
    this.redrawStars();
    this.relayoutRound(false);
    const size = { width: this.gameArea.width, height: this.gameArea.height };
    this.settingsPanel?.fitTo(size);
    this.setupGuide?.fitTo(size);
  }

  /**
   * Postavička a rozehrané kolo podle nového rozložení, bez nového příkladu
   * a bez započtení odpovědi. Rozepsané tahy se smažou.
   *
   * @param animateHint Tečky nápovědy naskočí (nápověda se právě ukázala).
   */
  private relayoutRound(animateHint: boolean): void {
    const layout = this.layout();
    this.mascot?.moveTo(layout.mascot, mascotLookOf(layout));
    if (!this.round) {
      return;
    }
    const writing = this.writingPad?.state ?? null;
    const after = playStateAfterResize(this.playState(this.round, writing), this.writingBoxSize());
    this.clearRound();
    this.drawRound(
      after.writing !== null && isTwoBoxRound(after.writing) ? after.writing : undefined,
      animateHint,
    );
  }

  /** Rozehraný stav pro přepočet po změně velikosti okna. */
  private playState(round: AnswerRound, writing: TwoBoxRound | null): PlayState {
    return {
      round,
      settings: this.settings,
      progress: { earned: this.starProgress.earned, character: this.character },
      counting: this.dotCounting,
      writing,
      settingsSession: this.settingsPanel?.currentSession ?? CLOSED_SETTINGS,
      guide: this.setupGuide?.state ?? null,
    };
  }

  /** Velikost jednoho okénka na psaní v současném rozložení. */
  private writingBoxSize(): { width: number; height: number } {
    const [first] = this.writingLayout().writingAreas;
    return { width: first?.width ?? 0, height: first?.height ?? 0 };
  }

  override update(time: number): void {
    this.writingPad?.update(time);
  }

  /** Uloží hvězdičky a postavičku do zařízení; když to nejde, hra jede dál. */
  private saveProgress(): void {
    saveProgress(browserStorage(), {
      earned: this.starProgress.earned,
      character: this.character,
    });
  }

  /**
   * Průvodce nastavením při prvním spuštění (#49). Během něj podržení kolečka
   * nic neudělá; po „Začít hrát“ se nastavení uloží a začne první příklad.
   */
  private openSetupGuide(): void {
    this.settingsOpen = true;
    const settingsButton = document.getElementById('settings-button');
    applyPageAppearance(guidePageAppearance(), settingsButton);
    this.setupGuide = new SetupGuidePanel(this, (chosen) => {
      this.setupGuide = undefined;
      this.launch = launchAfterGuide(this.launch);
      this.settings = chosen;
      saveSettings(browserStorage(), chosen);
      this.settingsOpen = false;
      applyPageAppearance(pageAppearance(CLOSED_SETTINGS), settingsButton);
      this.startRound();
    });
  }

  /**
   * Nastavení pro rodiče; po potvrzení se uloží a přijde nový příklad.
   * Stránka zůstane světlá a kolečko se ztlumí (#45). Druhé podržení kolečka
   * při otevřeném nastavení nic neudělá.
   */
  private openSettings(): void {
    if (this.settingsOpen || !canOpenSettingsByHold(this.setupGuide?.state ?? null)) {
      return;
    }
    this.settingsOpen = true;
    // Oslava se pod panelem nedohrává, dokončí ji až potvrzení (#45 AC8).
    this.stopCelebration();
    const settingsButton = document.getElementById('settings-button');
    const session = openSettings(CLOSED_SETTINGS, this.settings);
    applyPageAppearance(pageAppearance(session), settingsButton);

    this.settingsPanel = new SettingsPanel(this, session, (chosen) => {
      this.settingsPanel = undefined;
      const result = confirmSettings(chosen, this.settings, {
        earned: this.starProgress.earned,
        character: this.character,
      });
      this.settings = result.settings;
      saveSettings(browserStorage(), result.settings);
      this.settingsOpen = false;
      applyPageAppearance(pageAppearance(result.session), settingsButton);
      this.applyProgressAfterSettings(result.progress);
      if (result.startNewProblem) {
        this.startRound();
      }
    });
  }

  /** Když nastavení přerušilo oslavu, dokončí se jako po oslavě (nová řada, další postavička). */
  private applyProgressAfterSettings(progress: GameProgress): void {
    if (progress.earned === this.starProgress.earned && progress.character === this.character) {
      return;
    }
    this.stopCelebration();
    this.starProgress = { earned: progress.earned };
    this.character = progress.character;
    this.saveProgress();
    this.mascot?.switchTo(this.character);
    this.paintStars();
  }

  /** Zastaví naplánované dokončení oslavy a uklidí konfety. */
  private stopCelebration(): void {
    this.celebrationTimer?.remove();
    this.celebrationTimer = undefined;
    for (const piece of this.confettiPieces) {
      this.tweens.killTweensOf(piece);
      piece.destroy();
    }
    this.confettiPieces = [];
  }

  private createStarRow(): void {
    this.starIcons = this.layout().stars.map((slot) =>
      this.createStarShape(slot.x, slot.y, STAR_EMPTY_COLOR),
    );
  }

  /** Řada hvězdiček na novém místě a v nové velikosti, rozsvícená jako předtím. */
  private redrawStars(): void {
    for (const icon of this.starIcons) {
      this.tweens.killTweensOf(icon);
      icon.destroy();
    }
    this.createStarRow();
    this.paintStars();
  }

  private createStarShape(x: number, y: number, color: number): Phaser.GameObjects.Star {
    const size = this.layout().starSize;
    return this.add.star(x, y, 5, size * 0.25, size / 2, color);
  }

  /** Rozsvítí tolik hvězdiček zleva, kolik jich hráč v řadě získal. */
  private paintStars(): void {
    const looks = starLooks(this.starProgress);
    this.starIcons.forEach((icon, index) => {
      const look = looks[index];
      if (!look) {
        return;
      }
      icon.setFillStyle(colorNumber(look.fill));
      if (look.outlineColor === null) {
        icon.setStrokeStyle();
      } else {
        icon.setStrokeStyle(
          look.outlineWidth * this.layout().detailScale,
          colorNumber(look.outlineColor),
        );
      }
    });
  }

  private startRound(): void {
    this.clearRound();
    // Nový příklad nesmí být stejný jako ten z minulého kola (při startu žádný není).
    this.round = createAnswerRound(this.settings, Math.random, this.round?.problem);
    this.hintIsShown = false;
    this.dotCounting = startDotCounting(this.round.problem);
    this.drawRound();
  }

  /**
   * Nakreslí rozehrané kolo: příklad, číselník nebo okénka a nápovědu,
   * pokud už je vidět (po změně velikosti okna hned, bez naskakování).
   *
   * @param writingState Stav okének po změně velikosti okna; jinak prázdná okénka.
   * @param animateHint Tečky nápovědy naskočí jedna po druhé.
   */
  private drawRound(writingState?: TwoBoxRound, animateHint = false): void {
    if (!this.round) {
      return;
    }
    const layout = this.layout();
    this.drawProblem(layout);

    if (isWritingActive(this.settings)) {
      this.createWritingPad(this.round, writingState);
    } else {
      this.createKeypad(layout, this.round);
    }
    if (this.hintIsShown) {
      this.drawHint(animateHint);
    }
  }

  /** Číselník; po vyřešení (čeká se na další příklad) je správné tlačítko zelené. */
  private createKeypad(layout: DeviceScreenLayout, round: AnswerRound): void {
    answerChoices(round.maxNumber).forEach((value, index) => {
      const slot = layout.answerButtons[index];
      if (!slot) {
        return;
      }
      const button = this.createAnswerButton(value, slot, layout.detailScale);
      if (round.solved && value === round.problem.result) {
        this.paintButton(button, 'correct');
      }
      this.roundObjects.push(button.container);
    });
  }

  /** Místo číselníku okénka na psaní: při rozsahu 5 jedno, při 10 a 20 dvě (#42). */
  private createWritingPad(round: AnswerRound, writingState?: TwoBoxRound): void {
    this.writingPad = new WritingPad(
      this,
      this.writingLayout(),
      round,
      {
        onNumberChanged: (number) => this.showWrittenNumber(number),
        onConfirmed: (result) => this.onWritingConfirmed(result),
      },
      writingState,
    );
    if (round.solved) {
      this.writingPad.lock();
    }
  }

  /** Rozpoznané číslo se ukáže žlutě místo „?“, dokud ho dítě nepotvrdí. */
  private showWrittenNumber(number: number | null): void {
    if (!this.round || this.round.solved || !this.problemAnswer) {
      return;
    }
    if (number === null) {
      this.problemAnswer.setText(problemText(this.round).answer).setColor(QUESTION_MARK_COLOR);
    } else {
      this.problemAnswer.setText(String(number)).setColor(ANSWER_WRITTEN_COLOR);
    }
    this.centerProblem(this.layout());
  }

  private onWritingConfirmed(result: TwoBoxConfirmResult): void {
    const pad = this.writingPad;
    if (!pad) {
      return;
    }
    this.round = result.round.answer;
    this.applyOutcome(result.outcome, pad.confirmPosition, {
      onCorrect: () => pad.lock(),
      onWrong: () => this.showWrittenNumber(null),
    });
  }

  /** Příklad ze dvou částí: bílá levá strana „3 + 4 =“ a odpověď „?“, později výsledek. */
  private drawProblem(layout: DeviceScreenLayout): void {
    if (!this.round) {
      return;
    }
    const text = problemText(this.round);
    const style = {
      fontFamily: FONT_FAMILY,
      fontSize: `${layout.problemFontSize}px`,
      fontStyle: String(PROBLEM_STYLE.fontWeight),
      color: PROBLEM_TEXT_COLOR,
    };

    this.problemEquation = this.add
      .text(0, layout.problem.y, text.equation, style)
      .setOrigin(0, 0.5);
    const answerColor = text.answerRevealed ? ANSWER_REVEALED_COLOR : QUESTION_MARK_COLOR;
    this.problemAnswer = this.add
      .text(0, layout.problem.y, text.answer, { ...style, color: answerColor })
      .setOrigin(0.5);
    this.roundObjects.push(this.problemEquation, this.problemAnswer);
    this.centerProblem(layout);
  }

  /** Vycentruje celý příklad; odpověď může po vyřešení změnit šířku. */
  private centerProblem(layout: DeviceScreenLayout): void {
    if (!this.problemEquation || !this.problemAnswer) {
      return;
    }
    const gap = layout.problemFontSize * ANSWER_GAP_RATIO;
    const totalWidth = this.problemEquation.width + gap + this.problemAnswer.width;
    const left = layout.problem.x - totalWidth / 2;

    this.problemEquation.x = left;
    this.problemAnswer.x = left + this.problemEquation.width + gap + this.problemAnswer.width / 2;
  }

  /** Po správné odpovědi se místo „?“ ukáže zelený výsledek a jednou poskočí. */
  private revealAnswer(): void {
    if (!this.round || !this.problemAnswer) {
      return;
    }
    const text = problemText(this.round);
    this.problemAnswer.setText(text.answer).setColor(ANSWER_REVEALED_COLOR);
    this.centerProblem(this.layout());
    this.tweens.add({
      targets: this.problemAnswer,
      scale: 1.25,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private clearRound(): void {
    this.writingPad?.destroy();
    this.writingPad = undefined;
    for (const object of this.roundObjects) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.roundObjects = [];
  }

  private createAnswerButton(value: number, slot: ButtonSlot, detailScale: number): AnswerButton {
    const background = this.add.graphics();
    const label = this.add
      .text(0, 0, String(value), {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(slot.size * BUTTON_LABEL_RATIO)}px`,
        fontStyle: String(KEYPAD_BUTTON_STYLE.digitFontWeight),
        color: KEYPAD_BUTTON_STYLE.digitColor,
      })
      .setOrigin(0.5);

    const container = this.add.container(slot.x, slot.y, [background, label]);
    const button: AnswerButton = {
      value,
      container,
      background,
      label,
      size: slot.size,
      homeX: slot.x,
      detailScale,
    };

    this.paintButton(button, 'idle');
    container.setSize(slot.size, slot.size).setInteractive();
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Číselník bere jen jeden prst: dva prsty (třeba dlaň) nesmí dát dvě odpovědi.
      if (this.keypadPointerId !== undefined && this.keypadPointerId !== pointer.id) {
        return;
      }
      this.keypadPointerId = pointer.id;
      this.onAnswerTapped(button);
    });

    return button;
  }

  /** Tlačítko číselníku podle stavu: světle modré, po správné odpovědi zelené (#52). */
  private paintButton(button: AnswerButton, state: AnswerButtonState): void {
    const look = answerButtonLook(state);
    const half = button.size / 2;
    const radius = buttonCornerRadius(button.size);
    // Okraj se kreslí dovnitř tlačítka, aby se nezměnila jeho velikost.
    const borderWidth = look.borderWidth * button.detailScale;
    const inset = borderWidth / 2;

    button.background
      .clear()
      .fillStyle(colorNumber(look.background), 1)
      .fillRoundedRect(-half, -half, button.size, button.size, radius)
      .lineStyle(borderWidth, colorNumber(look.borderColor), 1)
      .strokeRoundedRect(
        -half + inset,
        -half + inset,
        button.size - borderWidth,
        button.size - borderWidth,
        radius - inset,
      );
    button.label.setColor(look.digitColor);
  }

  private onAnswerTapped(button: AnswerButton): void {
    if (!this.round) {
      return;
    }

    const result = tapAnswer(this.round, button.value);
    this.round = result.round;
    this.applyOutcome(result.outcome, button.container, {
      onCorrect: () => this.highlightCorrectButton(button),
      onWrong: () => this.showWrongAnswer(button),
    });
  }

  /**
   * Společné vyhodnocení pro číselník i psaní: zvuk, hvězdička, postavička,
   * výsledek v příkladu a nápověda po 2. chybě.
   */
  private applyOutcome(
    outcome: TapOutcome,
    origin: Origin,
    visuals: { onCorrect: () => void; onWrong: () => void },
  ): void {
    this.playSoundFor(outcome);

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

    // Až po nápovědě: na telefonu nápověda postavičku přesune (#54) a reakce by se ztratila.
    // Tanec začne až s oslavou, po doletu poslední hvězdičky.
    const reaction = mascotReactionToTap(outcome, stars.setCompleted);
    if (reaction && reaction !== 'dance') {
      this.mascot?.react(reaction);
    }
  }

  private layout(): DeviceScreenLayout {
    const maxNumber = this.round?.maxNumber ?? this.settings.maxNumber;
    const groups = this.shownHintGroups();
    const key = this.layoutKey('keypad', maxNumber, groups);
    const cached = this.keypadLayouts.get(key);
    if (cached) {
      return cached;
    }
    const layout = layoutDeviceScreen(
      this.gameArea,
      answerChoices(maxNumber).length,
      STARS_PER_SET,
      groups,
    );
    this.keypadLayouts.set(key, layout);
    return layout;
  }

  private writingLayout(): DeviceWritingLayout {
    const groups = this.shownHintGroups();
    const key = this.layoutKey('writing', this.settings.maxNumber, groups);
    const cached = this.writingLayouts.get(key);
    if (cached) {
      return cached;
    }
    const layout = layoutDeviceWritingScreen(
      this.gameArea,
      this.settings.maxNumber,
      STARS_PER_SET,
      groups,
    );
    this.writingLayouts.set(key, layout);
    return layout;
  }

  /** Rozložení telefonu se zkouší z mnoha velikostí, proto se spočítané pamatuje. */
  private layoutKey(input: string, maxNumber: number, groups: readonly number[]): string {
    const { mode, width, height } = this.gameArea;
    return [input, mode, width, height, maxNumber, groups.join('+')].join('|');
  }

  /** Skupinky teček, pro které má rozložení udělat místo (na telefonu, #54). */
  private shownHintGroups(): number[] {
    return this.round && this.hintIsShown ? hintDotGroups(this.round.problem) : [];
  }

  /** Rozložení se skutečným ovládáním: okénka na psaní, nebo číselník. */
  private answerLayout(): DeviceScreenLayout | DeviceWritingLayout {
    return isWritingActive(this.settings) ? this.writingLayout() : this.layout();
  }

  private showHintWhenNeeded(): void {
    if (!this.round || this.hintIsShown || !isHintVisible(this.round)) {
      return;
    }
    this.hintIsShown = true;
    if (this.answerLayout().device === 'phone') {
      // Na telefonu nápověda potřebuje místo: rozložení se přepočítá (V2, #54).
      this.relayoutRound(true);
      return;
    }
    this.drawHint(true);
  }

  /**
   * Tečky nápovědy. Nové naskakují jedna po druhé; po změně velikosti okna
   * (`animate` je false) jsou vidět hned i se spočítanými čísly.
   */
  private drawHint(animate: boolean): void {
    if (!this.round) {
      return;
    }
    const layout = this.answerLayout();
    const style = layout.hintStyle;
    const dots = layoutDeviceHint(layout, hintDotGroups(this.round.problem));
    const firstCrossedOut = dots.length - hintCrossedOutDots(this.round.problem);

    dots.forEach((dot, index) => {
      const crossedOut = index >= firstCrossedOut;
      const color = crossedOut
        ? HINT_CROSSED_OUT_COLOR
        : HINT_GROUP_COLORS[dot.group % HINT_GROUP_COLORS.length];
      const circle = this.add.circle(dot.x, dot.y, style.dotSize / 2, color);
      const parts: Phaser.GameObjects.Shape[] = [circle];
      if (crossedOut) {
        parts.push(
          this.add
            .rectangle(dot.x, dot.y, style.dotSize * 1.25, style.dotSize * 0.14, HINT_CROSS_COLOR)
            .setAngle(-45),
        );
      }

      this.roundObjects.push(...parts);
      if (animate) {
        this.popInDot(parts, index);
      }

      // Na tečku jde ťuknout hned, i když ještě naskakuje (#43).
      if (layout.hintDotsCountable) {
        this.addDotHitZone(dot, index, circle, layout.hintDotHitSize);
      }
      const countedNumber = this.dotCounting.numbers[index];
      if (countedNumber !== null && countedNumber !== undefined) {
        this.markDotCounted(circle, countedNumber);
      }
    });
  }

  /** Tečka naskočí se zpožděním podle pořadí. */
  private popInDot(parts: readonly Phaser.GameObjects.Shape[], index: number): void {
    for (const part of parts) {
      part.setScale(0);
    }
    this.tweens.add({
      targets: parts,
      scale: 1,
      duration: 200,
      delay: index * HINT_DOT_DELAY_MS,
      ease: 'Back.easeOut',
    });
  }

  /** Neviditelná plocha aspoň 64 CSS px kolem tečky, aby se na ni dalo ťuknout prstem. */
  private addDotHitZone(
    dot: HintDot,
    index: number,
    circle: Phaser.GameObjects.Arc,
    size: number,
  ): void {
    const zone = this.add.zone(dot.x, dot.y, size, size).setInteractive();
    zone.on('pointerdown', () => this.onDotTapped(index, circle));
    this.roundObjects.push(zone);
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
    // Tečka, která ještě naskakovala, hned doskočí, aby se do ní číslo vešlo.
    this.tweens.killTweensOf(circle);
    circle.setScale(1);
    const label = this.markDotCounted(circle, result.countedNumber);
    this.tweens.add({
      targets: [circle, label],
      scale: { from: 1, to: 1.2 },
      duration: 100,
      yoyo: true,
    });
  }

  /** Spočítaná tečka: tmavý okraj a pořadové číslo uprostřed. */
  private markDotCounted(circle: Phaser.GameObjects.Arc, number: number): Phaser.GameObjects.Text {
    const layout = this.answerLayout();
    circle.setStrokeStyle(DOT_COUNTED_RING_WIDTH * layout.detailScale, DOT_COUNTED_RING_COLOR);
    const label = this.add
      .text(circle.x, circle.y, String(number), {
        fontFamily: FONT_FAMILY,
        fontSize: `${layout.dotNumberFontSize}px`,
        fontStyle: 'bold',
        color: DOT_NUMBER_COLOR,
      })
      .setOrigin(0.5);
    this.roundObjects.push(label);
    return label;
  }

  private playSoundFor(outcome: TapOutcome): void {
    const sound = soundForOutcome(outcome);
    if (sound) {
      this.sounds.play(SOUNDS[sound]);
    }
  }

  /** Správné tlačítko zezelená a poskočí. */
  private highlightCorrectButton(button: AnswerButton): void {
    this.paintButton(button, 'correct');
    this.tweens.add({
      targets: button.container,
      scale: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private celebrateCorrectAnswer(origin: Origin, setCompleted: boolean): void {
    this.revealAnswer();
    this.flyStarToRow(origin, () => {
      if (setCompleted) {
        this.celebrateFullSet();
      }
    });

    if (!setCompleted) {
      this.time.delayedCall(NEXT_PROBLEM_DELAY_MS, () => this.startRound());
    }
  }

  /** Hvězdička přiletí od tlačítka na své místo v řadě a rozsvítí ho. */
  private flyStarToRow(origin: Origin, onArrived: () => void): void {
    const targetIndex = this.starProgress.earned - 1;
    const targetIcon = this.starIcons[targetIndex];
    if (!targetIcon) {
      onArrived();
      return;
    }

    const flyingStar = this.createStarShape(origin.x, origin.y, STAR_FILLED_COLOR)
      .setStrokeStyle(
        STAR_STYLE.earnedOutlineWidth * this.layout().detailScale,
        colorNumber(STAR_STYLE.earnedOutlineColor),
      )
      .setScale(1.6);

    this.tweens.add({
      targets: flyingStar,
      x: targetIcon.x,
      y: targetIcon.y,
      scale: 1,
      duration: STAR_FLIGHT_MS,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        flyingStar.destroy();
        this.paintStars();
        // Po otočení telefonu je řada hvězdiček nová, bere se hvězdička na stejném místě.
        this.tweens.add({
          targets: this.starIcons[targetIndex] ?? targetIcon,
          scale: 1.4,
          duration: 120,
          yoyo: true,
          repeat: 1,
        });
        onArrived();
      },
    });
  }

  /** Oslava po zaplnění řady: konfety a melodie, pak nová prázdná řada. */
  private celebrateFullSet(): void {
    // Nastavení mezitím mohlo oslavu přerušit a řadu vyprázdnit (#45).
    if (this.starProgress.earned < STARS_PER_SET || this.settingsOpen) {
      return;
    }
    this.sounds.play(SOUNDS.celebration);
    this.throwConfetti();
    this.mascot?.react('dance', CELEBRATION_MS);

    this.celebrationTimer = this.time.delayedCall(CELEBRATION_MS, () => {
      this.celebrationTimer = undefined;
      this.confettiPieces = [];
      this.starProgress = startNewStarSet();
      this.character = nextCharacter(this.character);
      this.saveProgress();
      this.mascot?.switchTo(this.character);
      this.paintStars();
      this.startRound();
    });
  }

  private throwConfetti(): void {
    const { width, height } = this.gameArea;
    const detail = this.layout().detailScale;
    const drift = CONFETTI_DRIFT * detail;

    for (let index = 0; index < CONFETTI_COUNT; index += 1) {
      const color = CONFETTI_COLOR_NUMBERS[index % CONFETTI_COLOR_NUMBERS.length];
      const piece = this.add
        .rectangle(
          Phaser.Math.Between(0, width),
          CONFETTI_START_Y * detail,
          CONFETTI_WIDTH * detail,
          CONFETTI_HEIGHT * detail,
          color,
        )
        .setAngle(Phaser.Math.Between(0, 360))
        .setDepth(10);
      this.confettiPieces.push(piece);

      this.tweens.add({
        targets: piece,
        y: height + CONFETTI_END_MARGIN * detail,
        x: piece.x + Phaser.Math.Between(-drift, drift),
        angle: piece.angle + Phaser.Math.Between(180, 720),
        duration: Phaser.Math.Between(1500, 2400),
        delay: Phaser.Math.Between(0, 500),
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  private showWrongAnswer(button: AnswerButton): void {
    // Opakované ťuknutí během třesení začne třesení znovu z výchozího místa.
    this.tweens.killTweensOf(button.container);
    button.container.x = button.homeX;

    this.tweens.add({
      targets: button.container,
      x: button.homeX + BUTTON_SHAKE_DISTANCE * button.detailScale,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        button.container.x = button.homeX;
      },
    });
  }
}

/** Je hodnota z registru herní plocha? */
function isGameArea(value: unknown): value is GameArea {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const area = value as Partial<GameArea>;
  return (
    typeof area.mode === 'string' &&
    typeof area.width === 'number' &&
    typeof area.height === 'number' &&
    typeof area.scale === 'number'
  );
}
