import type Phaser from 'phaser';

import { STAR_STYLE, starLooks } from '../logic/theme';
import { colorNumber } from '../../../shared/logic/theme';
import type { StarProgress } from '../logic/stars';
import type { SceneLayouts } from './SceneLayouts';

const STAR_EMPTY_COLOR = colorNumber(STAR_STYLE.emptyColor);
const STAR_FILLED_COLOR = colorNumber(STAR_STYLE.earnedColor);

/** Jak dlouho letí hvězdička od tlačítka do řady nahoře. */
const STAR_FLIGHT_MS = 450;

/** Místo, odkud vyletí hvězdička za správnou odpověď. */
export interface Origin {
  readonly x: number;
  readonly y: number;
}

/** Řada hvězdiček nahoře a hvězdička, která do ní přiletí za správnou odpověď. */
export class StarRow {
  private icons: Phaser.GameObjects.Star[] = [];

  /**
   * @param readProgress Vrátí současný počet získaných hvězdiček (čte se při kreslení).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layouts: SceneLayouts,
    private readonly readProgress: () => StarProgress,
  ) {}

  /** Nakreslí prázdnou řadu hvězdiček podle rozložení. */
  create(): void {
    this.icons = this.layouts
      .scenery()
      .stars.map((slot) => this.createStarShape(slot.x, slot.y, STAR_EMPTY_COLOR));
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
    const looks = starLooks(this.readProgress());
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
          look.outlineWidth * this.layouts.keypad().detailScale,
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

    const flyingStar = this.createStarShape(origin.x, origin.y, STAR_FILLED_COLOR)
      .setStrokeStyle(
        STAR_STYLE.earnedOutlineWidth * this.layouts.keypad().detailScale,
        colorNumber(STAR_STYLE.earnedOutlineColor),
      )
      .setScale(1.6);

    this.scene.tweens.add({
      targets: flyingStar,
      x: targetIcon.x,
      y: targetIcon.y,
      scale: 1,
      duration: STAR_FLIGHT_MS,
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

  private createStarShape(x: number, y: number, color: number): Phaser.GameObjects.Star {
    const size = this.layouts.scenery().starSize;
    return this.scene.add.star(x, y, 5, size * 0.25, size / 2, color);
  }
}
