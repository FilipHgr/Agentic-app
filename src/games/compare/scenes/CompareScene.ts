import Phaser from 'phaser';

import { sharedToneContext } from '../../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../../shared/audio/tonePlayer';
import { GAME_HOST_KEY, isGameHost } from '../../../shared/logic/gameHost';
import type { GameHost } from '../../../shared/logic/gameHost';
import { gameAreaFor } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { Confetti } from '../../../shared/ui/Confetti';
import { RudyMoments } from '../../../shared/ui/rudyMoments';
import { followCanvasResolution } from '../../../shared/ui/sharpCanvas';
import { StarRow } from '../../../shared/ui/StarRow';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import {
  COMPARE_GAME_AREA_FIT,
  layoutCompareScreen,
  layoutProblemScreen,
} from '../logic/compareLayout';
import type { ProblemScreenLayout, Rect } from '../logic/compareLayout';
import type { CompareProblem, CompareSign, ProblemKind } from '../logic/compareProblems';
import { createCompareSession } from '../logic/compareSession';
import type { CompareSettings } from '../logic/compareSettings';
import type {
  CompareChange,
  CompareRudy,
  CompareRudyEvents,
  CompareSession,
} from '../logic/compareSession';
import { COMPARE_SOUNDS } from '../logic/compareSounds';
import { compareRudyLines, compareRudyVoiceUrl } from '../logic/rudyLines';
import type { CompareRudyLines } from '../logic/rudyLines';
import { dimSettingsGear } from '../ui/gearOpacity';
import { EquationView, SignButtonView } from './EquationView';
import type { ProblemRowLayout, ProblemRowText } from './EquationView';
import { SettingsPanel } from './SettingsPanel';
import { SignPad } from './SignPad';
import type { SignPadButtons } from './SignPad';
import type { SignWriting } from '../logic/signWriting';

/** Jak dlouho letí hvězdička od okénka do řady. */
const STAR_FLIGHT_MS = 600;

/**
 * Jediná scéna hry Znaménka (#178, od #187 doplň znaménko, od #190
 * i < = > do „a ☐ b“). Scéna jen
 * kreslí a animuje; co se ve hře děje (příklad, odpovědi, hvězdičky,
 * oslava, uložení), řídí sezení `compareSession.ts`. Rozložení se bere
 * podle herní plochy (iPad, telefon na šířku i na výšku) a po otočení se
 * překreslí bez nového příkladu. Příklad „a ☐ b = c“ a tlačítka + a −
 * kreslí `EquationView.ts`, hvězdičky a konfety jsou sdílené (`StarRow`,
 * `Confetti`). Nastavení pro rodiče (#179) se otevře podržením kolečka
 * stránky a kreslí ho `SettingsPanel` nad hrou. Panda Rudy (#181: oslava
 * po 10. hvězdičce, od #186 přímo na obrazovce) je sdílené `RudyMoments`;
 * kdy se ukáže, řídí sezení. Při odpovědi psaním (#188) je okénko příkladu
 * plocha na psaní (`SignPad`) se smazáním a ✓ místo tlačítek + a −.
 * Příklad „a ☐ b“ (#190) má při ťukání tlačítka <, = a >, při psaní
 * (#191) stejnou plochu na psaní jako „a ☐ b = c“, která rozpozná jen
 * < = >; rozložení se bere podle druhu příkladu.
 */
export class CompareScene extends Phaser.Scene {
  private session!: CompareSession;
  private gameArea: GameArea = gameAreaFor(undefined, COMPARE_GAME_AREA_FIT);
  private layout: ProblemScreenLayout = layoutCompareScreen(this.gameArea);
  private equation: EquationView | null = null;
  private signButtons: SignButtonView[] = [];
  /** Okénko na psaní, když rodič zvolil odpověď psaním (#188). */
  private signPad: SignPad | null = null;
  private settingsPanel: SettingsPanel | null = null;
  private host: GameHost | undefined;
  // Společný zvukový kontext stránky, odemčený už ťuknutím v menu.
  private readonly tones = createTonePlayer(sharedToneContext);
  private readonly starRow = new StarRow(
    this,
    () => this.layout.stars,
    () => ({ earned: this.session.starCount() }),
    STAR_FLIGHT_MS,
  );
  private readonly confetti = new Confetti(this);
  /** Panda Rudy (#181, #186); vznikne v `create`, kód a obrázky stáhne až při oslavě. */
  private rudy!: RudyMoments;

  constructor() {
    super('compare');
  }

  create(): void {
    // Ostré plátno na iPadu (#77); kreslí se dál v herních jednotkách.
    followCanvasResolution(this);
    this.gameArea = this.readGameArea();
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      // Hra skončila jinak než domečkem: sezení se zastaví stejně.
      this.session.leave();
      // Kolečko patří stránce: další hra ho dostane neztlumené.
      dimSettingsGear(false);
    });

    const host = this.readHost();
    this.host = host;
    this.rudy = new RudyMoments(this);
    const session = createCompareSession({
      // Úložiště aktivního profilu od stránky; bez stránky jen paměť.
      storage: host?.storage,
      random: Math.random,
      sounds: {
        play: (name) => this.tones.play(COMPARE_SOUNDS[name]),
        stopAll: () => this.tones.stopAll(),
      },
      timers: {
        after: (ms, callback) => {
          const timer = this.time.delayedCall(ms, callback);
          return () => timer.remove(false);
        },
      },
      // Podržení kolečka stránky otevře nastavení (#179 AC1); bez stránky kolečko není.
      attachSettingsGear: host ? (open) => host.attachSettingsGear(open) : undefined,
      rudy: this.sessionRudy(compareRudyLines(host?.storage)),
      onChange: (change) => this.onSessionChange(change),
    });
    this.session = session;
    host?.onLeave(() => session.leave());
    host?.setHomeAvailable(session.homeAvailable());

    // Příklad nejdřív: spočítá rozložení podle plochy, podle kterého se kreslí i hvězdičky.
    this.drawProblem(false);
    this.starRow.create();
    this.starRow.paint();
  }

  /** Plocha na psaní se posouvá v čase každý snímek (rozpoznání 1 s po zvednutí prstu). */
  override update(time: number): void {
    this.signPad?.update(time);
  }

  /** Rudy pro sezení; kdy se ukáže a stáhne dopředu, řídí sezení (#181, #186). */
  private sessionRudy(lines: CompareRudyLines): CompareRudy {
    const rudy = this.rudy;
    return {
      // Replika zazní v jazyce zvoleném v menu; varianty se v profilu střídají
      // a zapamatuje se až ta, se kterou se Rudy ukázal (#176).
      celebrate: (events: CompareRudyEvents) => {
        const line = lines.upcoming();
        rudy.celebrate({
          onOpened: () => {
            lines.said(line);
            events.onOpened();
          },
          onClosed: () => events.onClosed(),
          voiceUrl: compareRudyVoiceUrl(line),
        });
      },
      prepare: () => rudy.prepare(compareRudyVoiceUrl(lines.upcoming())),
      stop: () => rudy.stop(),
    };
  }

  /** Stránka s domečkem z registru; bez ní hra běží jen bez něj. */
  private readHost(): GameHost | undefined {
    const stored: unknown = this.registry.get(GAME_HOST_KEY);
    return isGameHost(stored) ? stored : undefined;
  }

  private readGameArea(): GameArea {
    const stored: unknown = this.registry.get(GAME_AREA_KEY);
    return isGameArea(stored) ? stored : gameAreaFor(undefined, COMPARE_GAME_AREA_FIT);
  }

  private onSessionChange(change: CompareChange): void {
    switch (change.kind) {
      case 'problemStarted':
        this.drawProblem(true);
        break;
      case 'solved':
        this.showSolved(change.sign);
        break;
      case 'wrong':
        // Při psaní do okénka příkladu se zatřese a vyprázdní plocha na psaní
        // sama; se samostatnou plochou se zatřese i okénko příkladu.
        if (this.layout.writing?.padInProblem !== true) {
          this.equation?.reject(change.sign);
        }
        break;
      case 'writeAgain':
        // Nerozpoznaný zápis vybledl: okénko se zhoupne a vyzve psát znovu.
        this.signPad?.sway();
        break;
      case 'boxTapped':
        // Ťuknutí na okénko není odpověď: okénko se zhoupne a tlačítka
        // (při psaní plocha na psaní) ukážou, čím ho vyplnit.
        this.equation?.sway();
        this.signPad?.sway();
        for (const button of this.signButtons) {
          button.highlight();
        }
        break;
      case 'celebrationStarted':
        this.confetti.throw(this.gameArea, this.layout.unitsPerCssPx);
        break;
      case 'celebrationEnded':
        // Zbylé konfety dopadnou samy, řada je zase prázdná.
        this.confetti.forget();
        this.starRow.paint();
        break;
      case 'settingsOpened':
        this.openSettingsPanel();
        break;
      case 'settingsClosed':
        this.closeSettingsPanel();
        break;
    }
  }

  /** Nastavení nad hrou; kolečko se ztlumí a domeček zmizí, dokud je otevřené. */
  private openSettingsPanel(): void {
    this.confetti.forget();
    this.settingsPanel?.destroy();
    this.settingsPanel = new SettingsPanel(this, this.gameArea, {
      choice: () => this.session.settingsChoice(),
      choose: (change) => this.session.chooseSetting(change),
      confirm: () => this.session.confirmSettings(),
    });
    dimSettingsGear(true);
    this.host?.setHomeAvailable(this.session.homeAvailable());
  }

  /** Po ✓: panel zmizí, kolečko a domeček jsou zpátky a hvězdičky se překreslí. */
  private closeSettingsPanel(): void {
    this.settingsPanel?.destroy();
    this.settingsPanel = null;
    dimSettingsGear(false);
    this.host?.setHomeAvailable(this.session.homeAvailable());
    this.starRow.paint();
  }

  /** Správně: znaménko naskočí v zeleném okénku a hvězdička letí z okénka do řady. */
  private showSolved(sign: CompareSign): void {
    const equation = this.equation;
    if (!equation) {
      return;
    }
    equation.fill(sign, true);
    this.signPad?.lock();
    this.starRow.flyToRow(equation.boxCenter, () => undefined);
  }

  /** Smaže příklad, tlačítka i plochu na psaní. */
  private clearProblem(): void {
    this.equation?.destroy();
    this.equation = null;
    this.signPad?.destroy();
    this.signPad = null;
    for (const button of this.signButtons) {
      button.destroy();
    }
    this.signButtons = [];
  }

  /**
   * Nakreslí rozehraný příklad a tlačítka + a −, nebo plochu na psaní se
   * smazáním a ✓; `animate` u nového příkladu. Po otočení (`animate` je
   * `false`) zůstane rozepsaný zápis.
   */
  private drawProblem(animate: boolean): void {
    const previousWriting = animate ? undefined : this.signPad?.writing;
    this.clearProblem();
    const problem = this.session.problem();
    // Písmo příkladu je spočítané pro rozsah, ve kterém se hraje.
    const screen = screenFor(this.gameArea, this.session.settings(), problem);
    this.layout = screen.layout;
    const { layout } = this;
    const unit = layout.unitsPerCssPx;
    const writing = layout.writing;
    const boxIsPad = writing?.padInProblem ?? false;
    this.equation = new EquationView(
      this,
      screen.row,
      unit,
      screen.texts,
      // Okénko, které samo není plochou na psaní, ťuknutí zhoupne (#187, #188).
      boxIsPad ? null : () => this.session.tapBox(),
      boxIsPad,
    );
    if (writing !== null && screen.pad !== null) {
      this.signPad = this.createSignPad(screen.pad, writing, problem.kind, previousWriting);
    }
    const filled = this.session.filledSign();
    if (filled !== null) {
      // Vyřešený příklad po otočení: znaménko zůstane v zeleném okénku.
      this.equation.fill(filled, false);
      this.signPad?.lock();
    }
    if (animate) {
      this.equation.popIn();
    }
    this.drawSignButtons(layout);
  }

  private createSignPad(
    box: Rect,
    buttons: SignPadButtons,
    kind: ProblemKind,
    previous: SignWriting | undefined,
  ): SignPad {
    return new SignPad(
      this,
      box,
      buttons,
      kind,
      {
        answer: (sign) => this.session.tap(sign),
        onRejected: () => this.session.writingRejected(),
        // Se samostatnou plochou pod příkladem se znaménko ukáže i v okénku příkladu.
        onSignChanged: (sign) => {
          if (buttons.padInProblem) {
            return;
          }
          this.equation?.showWritten(sign);
        },
      },
      previous,
    );
  }

  /** Tlačítka + a − nebo < = > pod příkladem (odpověď ťuknutím); při psaní žádná. */
  private drawSignButtons(layout: ProblemScreenLayout): void {
    const unit = layout.unitsPerCssPx;
    const look = layout.problemKind === 'relation' ? layout.relationButtons : layout.signButtons;
    if (look === null) {
      return;
    }
    this.signButtons = buttonRectsOf(layout).map(
      ({ sign, rect }) =>
        new SignButtonView(this, rect, look, unit, sign, () => this.session.tap(sign)),
    );
  }

  /** Otočení zařízení nebo změna lišty: totéž kolo v novém rozložení, bez nového příkladu. */
  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    // Nové rozložení spočítá překreslení příkladu, hvězdičky se pak srovnají podle něj.
    this.drawProblem(false);
    this.starRow.redraw();
    this.settingsPanel?.fitTo(this.gameArea);
    this.rudy.relayout();
  }
}

/** Rozložení obrazovky s okénkem a čísly řady pro jeden příklad. */
interface ProblemScreen {
  readonly layout: ProblemScreenLayout;
  readonly row: ProblemRowLayout;
  readonly texts: readonly ProblemRowText[];
  /** Plocha na psaní pro tento příklad; při ťukání `null`. */
  readonly pad: Rect | null;
}

/**
 * Rozložení pro druh příkladu (#190) podle `layoutProblemScreen` a k němu
 * okénko a čísla řady: „a ☐ b“, nebo „a ☐ b = c“ s „=“ a výsledkem.
 */
function screenFor(
  area: GameArea,
  settings: CompareSettings,
  problem: CompareProblem,
): ProblemScreen {
  if (problem.kind === 'relation') {
    const layout = layoutProblemScreen(area, settings, problem.kind);
    const row = layout.equationFor(problem);
    return {
      layout,
      row,
      texts: [
        { rect: row.first, text: String(problem.a) },
        { rect: row.second, text: String(problem.b) },
      ],
      pad: layout.writing?.pad(problem) ?? null,
    };
  }
  const layout = layoutProblemScreen(area, settings, problem.kind);
  const row = layout.equationFor(problem);
  return {
    layout,
    row,
    texts: [
      { rect: row.first, text: String(problem.a) },
      { rect: row.second, text: String(problem.b) },
      // „=“ je symbol, ne text jazyka.
      { rect: row.equals, text: '=' },
      { rect: row.result, text: String(problem.result) },
    ],
    pad: layout.writing?.pad(problem) ?? null,
  };
}

/** Tlačítka zleva doprava se znaménkem; při psaní žádná. */
function buttonRectsOf(
  layout: ProblemScreenLayout,
): Array<{ readonly sign: CompareSign; readonly rect: Rect }> {
  if (layout.problemKind === 'relation') {
    if (layout.relationButtons === null) {
      return [];
    }
    const { less, equal, greater } = layout.relationButtons;
    return [
      { sign: '<', rect: less },
      { sign: '=', rect: equal },
      { sign: '>', rect: greater },
    ];
  }
  if (layout.signButtons === null) {
    return [];
  }
  return [
    { sign: '+', rect: layout.signButtons.plus },
    { sign: '−', rect: layout.signButtons.minus },
  ];
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
