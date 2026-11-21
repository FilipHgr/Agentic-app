import Phaser from 'phaser';

import { STAR_STYLE, starLooks } from '../logic/stars';
import type { StarProgress } from '../logic/stars';
import { colorNumber } from '../logic/theme';

const STAR_EMPTY_COLOR = colorNumber(STAR_STYLE.emptyColor);
const STAR_FILLED_COLOR = colorNumber(STAR_STYLE.earnedColor);

/** Místo, odkud vyletí hvězdička za správnou odpověď. */
export interface Origin {
  readonly x: number;
  readonly y: number;
}

/** Kde a jak velká je řada hvězdiček; hra ji čte ze svého rozložení. */
export interface StarRowLayout {
  /** Středy hvězdiček v řadě zleva. */
  readonly stars: readonly Origin[];
  /** Průměr jedné hvězdičky. */
  readonly starSize: number;
  /** Tloušťka obrysu proti iPadu (#54). */
  readonly detailScale: number;
}

/**
 * Řada hvězdiček nahoře a hvězdička, která do ní přiletí za správnou
 * odpověď. Společná pro všechny hry.
 */
export class StarRow {
  protected icons: Phaser.GameObjects.Star[] = [];

  /**
   * @param readLayout Vrátí současné rozložení řady (čte se při kreslení).
   * @param readProgress Vrátí současný počet získaných hvězdiček (čte se při kreslení).
   * @param flightMs Jak dlouho letí hvězdička od tlačítka do řady.
   */
  constructor(
    protected readonly scene: Phaser.Scene,
    protected readonly readLayout: () => StarRowLayout,
    private readonly readProgress: () => StarProgress,
    private readonly flightMs: number,
  ) {}

  /** Nakreslí prázdnou řadu hvězdiček podle rozložení. */
  create(): void {
    this.icons = this.readLayout().stars.map((slot) =>
      this.createStarShape(slot.x, slot.y, STAR_EMPTY_COLOR),
    );
  }

  /** Řada hvězdiček na novém místě a v nové velikosti, rozsvícená jako předtím. */
  redraw(): void {
    for (const icon of this.icons) {
      this.scene.tweens.killTweensOf(icon);
      icon.destroy();
    }
    this.create();
    this.paint();
  }

  /** Rozsvítí tolik hvězdiček zleva, kolik jich hráč v řadě získal. */
  paint(): void {
    const looks = starLooks(this.shownProgress());
    this.icons.forEach((icon, index) => {
      const look = looks[index];
      if (!look) {
        return;
      }
      icon.setFillStyle(colorNumber(look.fill));
      if (look.outlineColor === null) {
        icon.setStrokeStyle();
      } else {
        icon.setStrokeStyle(
          look.outlineWidth * this.readLayout().detailScale,
          colorNumber(look.outlineColor),
        );
      }
    });
  }

  /** Hvězdička přiletí od tlačítka na své místo v řadě a rozsvítí ho. */
  flyToRow(origin: Origin, onArrived: () => void): void {
    const targetIndex = this.readProgress().earned - 1;
    const targetIcon = this.icons[targetIndex];
    if (!targetIcon) {
      onArrived();
      return;
    }

    const flyingStar = this.createEarnedStar(origin.x, origin.y).setScale(1.6);

    this.scene.tweens.add({
      targets: flyingStar,
      x: targetIcon.x,
      y: targetIcon.y,
      scale: 1,
      duration: this.flightMs,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        flyingStar.destroy();
        this.paint();
        // Po otočení telefonu je řada hvězdiček nová, bere se hvězdička na stejném místě.
        this.scene.tweens.add({
          targets: this.icons[targetIndex] ?? targetIcon,
          scale: 1.4,
          duration: 120,
          yoyo: true,
          repeat: 1,
        });
        onArrived();
      },
    });
  }

  /** Kolik hvězdiček má řada ukázat; hra to může změnit (např. při letu řady pryč). */
  protected shownProgress(): StarProgress {
    return this.readProgress();
  }

  /** Zlatá hvězdička s obrysem, jak letí za správnou odpověď. */
  protected createEarnedStar(x: number, y: number): Phaser.GameObjects.Star {
    return this.createStarShape(x, y, STAR_FILLED_COLOR).setStrokeStyle(
      STAR_STYLE.earnedOutlineWidth * this.readLayout().detailScale,
      colorNumber(STAR_STYLE.earnedOutlineColor),
    );
  }

  private createStarShape(x: number, y: number, color: number): Phaser.GameObjects.Star {
    const size = this.readLayout().starSize;
    return this.scene.add.star(x, y, 5, size * 0.25, size / 2, color);
  }
}
