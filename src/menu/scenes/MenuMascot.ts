import type Phaser from 'phaser';

import { MASCOT_MOVES } from '../../shared/logic/mascot';
import type { MascotMove } from '../../shared/logic/mascot';
import type { Mascot } from '../../shared/ui/mascot';
import type { MenuBox } from '../logic/menuLayout';
import { createMenuMascotCues } from '../logic/menuMascot';
import type { MenuShownReason } from '../logic/menuMascot';

/**
 * Panda v menu (#168): kde stojí, rozhoduje `logic/mascotPlace.ts`
 * (`MenuLayout.mascot`), kdy co dělá, `logic/menuMascot.ts`. Tady se to
 * jen předá sdílené pandě. Panda vznikne (a začne stahovat) až tam, kde
 * pro ni je místo. Ťuknutí na ni pozná logika dotyků menu, obrázek sám
 * dotyky nepřijímá.
 *
 * Kód sdílené pandy i adresy archů pohybů se stáhnou dynamickým importem
 * až při prvním místě pro pandu, takže nejsou ve startovním souboru menu
 * (#122 AC6) a telefon bez pandy je nestáhne vůbec.
 */
export class MenuMascot {
  private mascot: Mascot | undefined;
  /** Kód sdílené pandy se právě stahuje. */
  private loading = false;
  /** Poslední místo z rozložení (CSS px), `null` bez místa. */
  private box: MenuBox | null = null;
  /** Má panda v současném okně místo (je vidět)? */
  private placed = false;
  private readonly cues = createMenuMascotCues();

  constructor(
    private readonly scene: Phaser.Scene,
    /** Vrstva pandy, kterou kreslí jen její kamera (pod nabídkami, AC5). */
    private readonly layer: Phaser.GameObjects.Container,
    /** Jednotky plátna na 1 CSS px. */
    private readonly unitsPerCssPx: number,
  ) {}

  /** Postaví pandu do obdélníku z rozložení (CSS px); bez místa se schová. */
  layout(box: MenuBox | null): void {
    this.box = box;
    if (box === null) {
      this.hide();
      return;
    }
    this.placed = true;
    if (this.mascot === undefined) {
      this.loadMascot();
      return;
    }
    this.placeAt(this.mascot, box);
  }

  private placeAt(mascot: Mascot, box: MenuBox): void {
    const unit = this.unitsPerCssPx;
    mascot.place({
      x: box.left * unit,
      y: box.top * unit,
      width: (box.right - box.left) * unit,
      height: (box.bottom - box.top) * unit,
    });
    this.prepareMoves();
  }

  /**
   * Stáhne kód sdílené pandy a pak ji postaví na poslední místo. Chyba se
   * jen zapíše do konzole (dítě nic nevidí), další rozložení to zkusí znovu.
   */
  private loadMascot(): void {
    if (this.loading) {
      return;
    }
    this.loading = true;
    import('../../shared/ui/mascot').then(
      ({ Mascot: MascotView }) => {
        this.loading = false;
        if (this.mascot !== undefined || !this.scene.sys.isActive()) {
          return;
        }
        const mascot = new MascotView(this.scene, { layer: this.layer });
        this.mascot = mascot;
        if (this.box === null) {
          this.hide();
        } else {
          this.placeAt(mascot, this.box);
        }
      },
      (error: unknown) => {
        this.loading = false;
        console.warn('panda: kód pandy se nestáhl', error);
      },
    );
  }

  /**
   * Menu se ukázalo (po rozložení pro současné okno): po otevření a po
   * návratu ze hry panda zamává, jen když je vidět.
   */
  menuShown(reason: MenuShownReason): void {
    if (!this.placed) {
      return;
    }
    this.cues.menuShown(reason, this.scene.time.now);
    this.prepareMoves();
  }

  /**
   * Menu se schovalo (spustila se hra): pozdrav se vynechá a z paměti se
   * uvolní všechno kromě klidu, aby hra měla paměť pro sebe.
   */
  menuHidden(): void {
    this.cues.placeLost();
    this.discardAllBut(['idle']);
  }

  /** Je panda vidět (má místo a stažený klid)? */
  isShown(): boolean {
    return this.placed && this.mascot?.isReady('idle') === true;
  }

  /** Ťuknutí na pandu: radost, během radosti nic (tón zahraje scéna). */
  tapped(): void {
    const mascot = this.shownMascot();
    if (!mascot) {
      return;
    }
    const move = this.cues.tapped(mascot.currentMove(), this.scene.time.now);
    if (move !== null) {
      mascot.play(move);
    }
    this.prepareMoves();
  }

  /** Každý snímek: pozdrav, až je stažený. */
  update(): void {
    const mascot = this.shownMascot();
    if (!mascot) {
      return;
    }
    const move = this.cues.step(this.scene.time.now, {
      idle: mascot.isReady('idle'),
      wave: mascot.isReady('wave'),
    });
    if (move !== null) {
      mascot.play(move);
      this.prepareMoves();
    }
  }

  private shownMascot(): Mascot | undefined {
    return this.placed ? this.mascot : undefined;
  }

  /**
   * Místo zmizelo (otočení, víc her): panda se schová a uvolní z paměti
   * všechny pohyby kromě klidu. Pozdrav se už nepřehraje.
   */
  private hide(): void {
    this.placed = false;
    this.cues.placeLost();
    const mascot = this.mascot;
    if (!mascot) {
      return;
    }
    mascot.place({ x: 0, y: 0, width: 0, height: 0 });
    mascot.play('idle');
    this.discardAllBut(['idle']);
  }

  private prepareMoves(): void {
    const wanted = this.cues.preparedMoves(this.placed);
    this.discardAllBut(wanted);
    for (const move of wanted) {
      this.mascot?.prepare(move);
    }
  }

  private discardAllBut(kept: readonly MascotMove[]): void {
    for (const move of MASCOT_MOVES) {
      if (!kept.includes(move)) {
        this.mascot?.discard(move);
      }
    }
  }
}
