import Phaser from 'phaser';

import { sharedToneContext } from '../../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../../shared/audio/tonePlayer';
import { GAME_HOST_KEY, isGameHost } from '../../../shared/logic/gameHost';
import type { GameHost } from '../../../shared/logic/gameHost';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { gameAreaFor } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import type { RudyLineMove } from '../../../shared/logic/rudy';
import { Confetti } from '../../../shared/ui/Confetti';
import { RudyMoments } from '../../../shared/ui/rudyMoments';
import { followCanvasResolution } from '../../../shared/ui/sharpCanvas';
import { StarRow } from '../../../shared/ui/StarRow';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import { clipSegment, hintPicture, playHintPairing } from '../logic/compareHint';
import type { HintLink, HintPairing } from '../logic/compareHint';
import { COMPARE_GAME_AREA_FIT, layoutCompareScreen } from '../logic/compareLayout';
import type { CompareLayout } from '../logic/compareLayout';
import { correctChoice } from '../logic/compareProblems';
import type { CompareChoice } from '../logic/compareProblems';
import { createCompareSession } from '../logic/compareSession';
import type {
  CompareChange,
  CompareRudy,
  CompareRudyEvents,
  CompareSession,
} from '../logic/compareSession';
import { COMPARE_SOUNDS } from '../logic/compareSounds';
import { compareRudyLines, compareRudyVoiceUrl } from '../logic/rudyLines';
import type { CompareRudyLines } from '../logic/rudyLines';
import { HINT_STYLE, SIGN_STYLE } from '../logic/theme';
import { dimSettingsGear } from '../ui/gearOpacity';
import { CardView, EqualButtonView } from './CardView';
import { SettingsPanel } from './SettingsPanel';

/** Jak dlouho letí hvězdička od karty do řady. */
const STAR_FLIGHT_MS = 600;
/** Znak naskočí ze zmenšení. */
const SIGN_POP_MS = 220;
/** Nové karty naskočí ze zmenšení. */
const CARDS_POP_MS = 180;
const CARDS_POP_FROM = 0.92;

/**
 * Jediná scéna Porovnávání (#178). Scéna jen kreslí a animuje; co se ve
 * hře děje (příklad, odpovědi, hvězdičky, oslava, uložení), řídí sezení
 * `compareSession.ts`. Rozložení se bere podle herní plochy (iPad,
 * telefon na šířku i na výšku) a po otočení se překreslí bez nového
 * příkladu. Hvězdičky a konfety jsou sdílené (`StarRow`, `Confetti`).
 * Nastavení pro rodiče (#179) se otevře podržením kolečka stránky a kreslí
 * ho `SettingsPanel` nad hrou. Po 2. chybě scéna nakreslí nápovědu
 * párováním teček (#180) podle `compareHint.ts`. Okno s pandou Rudym
 * (#181: pozdrav po otevření hry, oslava po 10. hvězdičce) je sdílené
 * `RudyMoments`; kdy se ukáže, řídí sezení.
 */
export class CompareScene extends Phaser.Scene {
  private session!: CompareSession;
  private gameArea: GameArea = gameAreaFor(undefined, COMPARE_GAME_AREA_FIT);
  private layout: CompareLayout = layoutCompareScreen(this.gameArea);
  private cards: CardView[] = [];
  private equalButton: EqualButtonView | null = null;
  /**
   * Vrstva čar spojení dvojic (#180) pod kartami: z čáry je vidět jen kus
   * mezi kartami, kus na kartě kreslí karta sama pod tečkami.
   */
  private hintLayer: Phaser.GameObjects.Container | null = null;
  /** Rozehrané spojování dvojic; zastaví se s příkladem. */
  private hintPairing: HintPairing | null = null;
  private sign: Phaser.GameObjects.Text | null = null;
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
  /** Okno s pandou Rudym (#181); vznikne v `create`, kód a obrázky stáhne až při pozdravu. */
  private rudy!: RudyMoments;

  constructor() {
    super('compare');
  }

  create(): void {
    // Ostré plátno na iPadu (#77); kreslí se dál v herních jednotkách.
    followCanvasResolution(this);
    this.gameArea = this.readGameArea();
    this.layout = layoutCompareScreen(this.gameArea);
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
    this.rudy = new RudyMoments(this, {
      // Okraje stránky kolem plátna ztmavne okno stejně jako hru (#169).
      pageBackdrop: (backdrop) => host?.setPageBackdrop?.(backdrop),
    });
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

    this.starRow.create();
    this.starRow.paint();
    this.drawProblem(false);
  }

  /** Okno s pandou pro sezení; kdy se co ukáže a stáhne dopředu, řídí sezení (#181). */
  private sessionRudy(lines: CompareRudyLines): CompareRudy {
    const rudy = this.rudy;
    return {
      // Replika zazní v jazyce zvoleném v menu; varianty se v profilu střídají
      // a zapamatuje se až ta, jejíž okno se ukázalo (#176).
      show: (move: RudyLineMove, events: CompareRudyEvents) => {
        const line = lines.upcoming(move);
        rudy.show(move, {
          onOpened: () => {
            lines.said(move, line);
            events.onOpened();
          },
          onClosed: () => events.onClosed(),
          voiceUrl: compareRudyVoiceUrl(line),
        });
      },
      prepare: (move: RudyLineMove) =>
        rudy.prepare(move, compareRudyVoiceUrl(lines.upcoming(move))),
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
        this.showSolved(change.choice);
        break;
      case 'wrong':
        this.targetOf(change.choice)?.shake();
        break;
      case 'hintShown':
        this.showHint(true);
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

  private targetOf(choice: CompareChoice): CardView | EqualButtonView | null | undefined {
    switch (choice) {
      case 'left':
        return this.cards[0];
      case 'right':
        return this.cards[1];
      case 'equal':
        return this.equalButton;
    }
  }

  /** Správně: karta se rozsvítí, místo „=“ naskočí znak a hvězdička letí do řady. */
  private showSolved(choice: CompareChoice): void {
    // Správně během spojování: nápověda se hned dokreslí, bez animace a cinkání.
    this.hintPairing?.finish();
    const target = this.targetOf(choice);
    if (choice !== 'equal') {
      this.cards[choice === 'left' ? 0 : 1]?.markCorrect();
    }
    const origin = target?.center ?? { x: this.layout.sign.x, y: this.layout.sign.y };
    this.equalButton?.hide();
    this.drawSign(true);
    this.starRow.flyToRow(origin, () => undefined);
  }

  /** Zelený okraj správné karty bez zhoupnutí; u „=“ žádná karta. */
  private markCorrectCard(choice: CompareChoice): void {
    if (choice !== 'equal') {
      this.cards[choice === 'left' ? 0 : 1]?.markCorrect(false);
    }
  }

  /**
   * Nápověda párováním (#180): karty ukážou tečky (u čísel nově pod číslem),
   * dvojice se po jedné spojí čarou s cinknutím a nakonec se rozsvítí tečky
   * bez dvojice. Spojení zůstanou vidět jako jemné čáry pod tečkami. Bez
   * `animate` (po otočení) je nápověda hned celá. Ťuknutí na karty a „=“
   * fungují po celou dobu; správné ťuknutí nápovědu hned dokreslí.
   */
  private showHint(animate: boolean): void {
    const picture = hintPicture(this.layout, this.session.problem(), this.session.problemLook());
    const [left, right] = this.cards;
    if (!left || !right) {
      return;
    }
    const hadDots = this.session.problemLook().show !== 'numbers';
    left.showHint(picture.cards[0], picture.numerals[0], animate);
    right.showHint(picture.cards[1], picture.numerals[1], animate);
    // Všechny tečky příkladu jsou stejně velké.
    const dotRadius = picture.cards[0][0]?.radius ?? 0;
    this.hintPairing?.cancel();
    this.hintPairing = playHintPairing(
      picture.links.length,
      // Tečky pod samotným číslem nejdřív naskočí, pak se párují.
      animate && !hadDots ? HINT_STYLE.dotsAppearMs : 0,
      {
        after: (ms, callback) => {
          const timer = this.time.delayedCall(ms, callback);
          return () => timer.remove(false);
        },
      },
      {
        pairUp: (pair, animatePair) => {
          const link = picture.links[pair];
          if (link) {
            this.pairUp(link, dotRadius, animate && animatePair);
          }
        },
        lightExtras: () => {
          left.lightExtras();
          right.lightExtras();
        },
      },
    );
    if (!animate) {
      this.hintPairing.finish();
    }
  }

  /**
   * Jedna dvojice se spojí: čára mezi tečkami pod nimi. S `animate` obě
   * tečky poskočí, čára se rozsvítí, cinkne tón a čára pak zjemní.
   */
  private pairUp(link: HintLink, dotRadius: number, animate: boolean): void {
    this.cards[0]?.pairDot(link.pair, animate);
    this.cards[1]?.pairDot(link.pair, animate);
    if (animate) {
      this.tones.play(COMPARE_SOUNDS.pair);
    }
    // Čára vede od okraje tečky k okraji tečky, aby ji ztlumené tečky nepřekryly.
    const { from, to } = link;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const trim = length > 0 ? dotRadius / length : 0;
    const start = { x: from.x + (to.x - from.x) * trim, y: from.y + (to.y - from.y) * trim };
    const end = { x: to.x - (to.x - from.x) * trim, y: to.y - (to.y - from.y) * trim };
    const width = HINT_STYLE.linkWidth * this.layout.unitsPerCssPx;
    const parts: Phaser.GameObjects.Graphics[] = [];
    if (this.hintLayer) {
      const gap = this.add.graphics();
      gap
        .lineStyle(width, colorNumber(HINT_STYLE.linkColor))
        .lineBetween(start.x, start.y, end.x, end.y);
      this.hintLayer.add(gap);
      parts.push(gap);
    }
    for (const [side, card] of this.cards.entries()) {
      const part = clipSegment(start, end, this.layout.cards[side === 0 ? 0 : 1]);
      if (part) {
        parts.push(card.addLinkPart(part, width, HINT_STYLE.linkColor));
      }
    }
    for (const part of parts) {
      part.setAlpha(animate ? HINT_STYLE.linkAlpha : HINT_STYLE.linkRestAlpha);
    }
    if (animate) {
      this.tweens.add({
        targets: parts,
        alpha: HINT_STYLE.linkRestAlpha,
        delay: HINT_STYLE.linkHoldMs,
        duration: HINT_STYLE.linkFadeMs,
      });
    }
  }

  /** Smaže karty, „=“ i znak. */
  private clearProblem(): void {
    this.hintPairing?.cancel();
    this.hintPairing = null;
    if (this.hintLayer) {
      for (const line of this.hintLayer.list) {
        this.tweens.killTweensOf(line);
      }
      this.hintLayer.destroy();
      this.hintLayer = null;
    }
    for (const card of this.cards) {
      card.destroy();
    }
    this.cards = [];
    this.equalButton?.destroy();
    this.equalButton = null;
    if (this.sign) {
      this.tweens.killTweensOf(this.sign);
      this.sign.destroy();
      this.sign = null;
    }
  }

  /** Nakreslí rozehraný příklad podle rozložení; `animate` u nového příkladu. */
  private drawProblem(animate: boolean): void {
    this.clearProblem();
    // Čáry spojení nápovědy jsou pod kartami: mezi kartami je z nich vidět kus.
    this.hintLayer = this.add.container(0, 0);
    const { layout } = this;
    const unit = layout.unitsPerCssPx;
    const problem = this.session.problem();
    // Karty se kreslí podle nastavení, se kterým příklad začal (#179 AC3).
    const look = this.session.problemLook();
    this.cards = [
      new CardView(
        this,
        layout.cards[0],
        unit,
        layout.cardCornerRadius,
        { count: problem.left, groups: layout.dotGroups, side: 0, look },
        () => this.session.tap('left'),
      ),
      new CardView(
        this,
        layout.cards[1],
        unit,
        layout.cardCornerRadius,
        { count: problem.right, groups: layout.dotGroups, side: 1, look },
        () => this.session.tap('right'),
      ),
    ];
    if (this.session.shownSign() === null) {
      this.equalButton = new EqualButtonView(this, layout.equalButton, unit, () =>
        this.session.tap('equal'),
      );
    } else {
      // Vyřešený příklad po otočení: správná karta zůstane zeleně orámovaná.
      this.markCorrectCard(correctChoice(problem));
      this.drawSign(false);
    }
    if (this.session.hintShown()) {
      // Po otočení zůstane nápověda celá, bez nového spárování.
      this.showHint(false);
    }
    if (animate) {
      for (const card of this.cards) {
        card.container.setScale(CARDS_POP_FROM);
        this.tweens.add({
          targets: card.container,
          scale: 1,
          duration: CARDS_POP_MS,
          ease: 'Back.easeOut',
        });
      }
    }
  }

  /** Znak na místě „=“ („>“, „<“, „=“), vždy rovně: karty jsou vedle sebe. */
  private drawSign(animate: boolean): void {
    const sign = this.session.shownSign();
    if (sign === null) {
      return;
    }
    const { layout } = this;
    this.sign = this.add
      .text(layout.sign.x, layout.sign.y, sign, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(layout.sign.size)}px`,
        fontStyle: SIGN_STYLE.fontWeight,
        color: SIGN_STYLE.color,
      })
      .setOrigin(0.5);
    if (animate) {
      this.sign.setScale(0.3);
      this.tweens.add({
        targets: this.sign,
        scale: 1,
        duration: SIGN_POP_MS,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Otočení zařízení nebo změna lišty: totéž kolo v novém rozložení, bez nového příkladu. */
  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    this.layout = layoutCompareScreen(this.gameArea);
    this.starRow.redraw();
    this.drawProblem(false);
    this.settingsPanel?.fitTo(this.gameArea);
    this.rudy.relayout();
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
