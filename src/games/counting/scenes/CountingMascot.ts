import type Phaser from 'phaser';

import { MASCOT_MOVES } from '../../../shared/logic/mascot';
import type { MascotMove } from '../../../shared/logic/mascot';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { Mascot } from '../../../shared/ui/mascot';
import { readViewport } from '../../../shared/ui/viewport';
import {
  GREETING_NOT_YET,
  greetingInterrupted,
  greetingRequested,
  greetingStep,
  isGreetingDone,
  movesToPrepare,
} from '../logic/mascotCues';
import type { GreetingState } from '../logic/mascotCues';
import { countingMascotArea } from '../logic/mascotPlace';
import { MASCOT_DEPTH } from '../logic/sceneDepths';
import type { GameSettings } from '../logic/settings';

/** Pohyby, které hra stahuje dopředu a zase uvolňuje (pozdrav řídí zvlášť). */
const GAME_MOVES: readonly MascotMove[] = MASCOT_MOVES.filter(
  (move) => move !== 'idle' && move !== 'wave',
);

/** Co panda potřebuje vědět o hře. */
export interface CountingMascotInputs {
  readonly gameArea: GameArea;
  /** Uložené nastavení rodiče (rozsah, druh příkladů, ovládání). */
  readonly settings: GameSettings;
  readonly starCount: number;
}

/**
 * Panda v Počítání (#167): kde stojí, rozhoduje `logic/mascotPlace.ts`,
 * kdy co dělá, `logic/mascotCues.ts`. Tady se to jen předá sdílené pandě.
 * Panda vznikne (a začne stahovat) až tam, kde pro ni je místo; jinde
 * není vidět a nic nestahuje. Dotyky nepřijímá, projdou jako na pozadí.
 */
export class CountingMascot {
  private mascot: Mascot | undefined;
  /** Má panda v současném okně místo (je vidět)? */
  private placed = false;
  private greeting: GreetingState = GREETING_NOT_YET;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly readInputs: () => CountingMascotInputs,
  ) {}

  /**
   * Postaví pandu podle plochy a nastavení (při startu, po otočení, změně
   * okna a po nastavení). Bez místa panda zmizí.
   */
  layout(): void {
    const { gameArea, settings } = this.readInputs();
    const area = countingMascotArea(gameArea, readViewport(), settings);
    if (area === null) {
      this.hide();
      return;
    }
    this.mascot ??= new Mascot(this.scene, { depth: MASCOT_DEPTH });
    this.placed = true;
    this.mascot.place(area);
    this.prepareMoves();
  }

  /**
   * Místo zmizelo (třeba po otočení na telefon): panda se schová a uvolní
   * z paměti všechny pohyby kromě klidu. Klid zůstane, aby se po otočení
   * zpět hned ukázala. Pozdrav se už nepřehraje.
   */
  private hide(): void {
    const mascot = this.mascot;
    this.placed = false;
    if (!mascot) {
      return;
    }
    mascot.place({ x: 0, y: 0, width: 0, height: 0 });
    mascot.play('idle');
    this.greeting = greetingInterrupted(this.greeting, this.scene.time.now);
    for (const move of MASCOT_MOVES) {
      mascot.discard(move);
    }
  }

  /** Panda, když je vidět; schovaná nic nestahuje ani nehraje. */
  private shown(): Mascot | undefined {
    return this.placed ? this.mascot : undefined;
  }

  /** Herní obrazovka je vidět (bez průvodce): panda pozdraví, když to stihne (AC5). */
  gameScreenShown(): void {
    this.greeting = greetingRequested(this.greeting, this.scene.time.now);
    this.prepareMoves();
  }

  /** Reakce na hru; `null` nic nemění. Pozdrav, který ještě nezačal, se vynechá. */
  react(move: MascotMove | null): void {
    const mascot = this.shown();
    if (move === null || !mascot) {
      return;
    }
    this.skipGreeting();
    mascot.play(move);
    this.prepareMoves();
  }

  /** Panda se vrátí do klidu (po zavření karty s mapou, AC4). */
  rest(): void {
    this.shown()?.play('idle');
  }

  /** Změnil se počet hvězdiček: jiný pohyb může přijít příště. */
  starsChanged(): void {
    this.prepareMoves();
  }

  /** Každý snímek: pozdrav čeká na stažení nejvýš 2 s. */
  update(): void {
    const mascot = this.shown();
    if (!mascot) {
      return;
    }
    const ready = mascot.isReady('idle') && mascot.isReady('wave');
    const step = greetingStep(this.greeting, this.scene.time.now, ready);
    const finished = !isGreetingDone(this.greeting) && isGreetingDone(step.state);
    this.greeting = step.state;
    if (step.play) {
      mascot.play('wave');
    }
    if (finished) {
      mascot.discard('wave');
      this.prepareMoves();
    }
  }

  private skipGreeting(): void {
    if (isGreetingDone(this.greeting)) {
      return;
    }
    this.greeting = greetingInterrupted(this.greeting, this.scene.time.now);
    this.mascot?.discard('wave');
  }

  /** Stáhne dopředu pohyby, které můžou přijít, ostatní uvolní (paměť je omezená, #166). */
  private prepareMoves(): void {
    const mascot = this.shown();
    if (!mascot) {
      return;
    }
    const wanted = movesToPrepare(this.readInputs().starCount, isGreetingDone(this.greeting));
    for (const move of GAME_MOVES) {
      if (!wanted.includes(move)) {
        mascot.discard(move);
      }
    }
    if (!isGreetingDone(this.greeting)) {
      mascot.prepare('wave');
    }
    for (const move of wanted) {
      mascot.prepare(move);
    }
  }
}
