import Phaser from 'phaser';

import { STAR_FLIGHT_MS } from '../logic/countingSession';
import { starFlightPointAt, starFlightShareAt } from '../logic/mapAnimation';
import { STAR_STYLE, starLooks } from '../logic/theme';
import { colorNumber } from '../../../shared/logic/theme';
import { STARS_PER_SET } from '../logic/stars';
import type { StarProgress } from '../logic/stars';
import { ABOVE_MAP_DEPTH } from '../logic/sceneDepths';
import type { SceneLayouts } from './SceneLayouts';

const STAR_EMPTY_COLOR = colorNumber(STAR_STYLE.emptyColor);
const STAR_FILLED_COLOR = colorNumber(STAR_STYLE.earnedColor);

/** Místo, odkud vyletí hvězdička za správnou odpověď. */
export interface Origin {
  readonly x: number;
  readonly y: number;
}

/**
 * Jak velká hvězdička vyletí z řady (proti hvězdičce v řadě), aby byla
 * vidět i přes konfety, a na kolik se cestou ke značce zmenší (#154 AC7).
 */
const MAP_FLIGHT_START_SCALE = 1.4;
const MAP_FLIGHT_END_SCALE = 0.7;

/** Od jakého dílu dráhy hvězdička u značky mizí. */
const MAP_FLIGHT_FADE_FROM = 0.8;

/** Let plné řady do mapy (#154 AC3): kam letí a kolik ms od ukázání mapy uběhlo. */
interface MapFlight {
  readonly target: () => Origin | null;
  readonly elapsedMs: () => number;
  stars: Phaser.GameObjects.Star[];
}

/**
 * Řada hvězdiček nahoře, hvězdička, která do ní přiletí za správnou
 * odpověď, a let plné řady do okna s mapou (#154).
 */
export class StarRow {
  private icons: Phaser.GameObjects.Star[] = [];
  private mapFlight: MapFlight | null = null;
  /**
   * Hvězdičky z plné řady odletěly do mapy: řada je prázdná, i když sezení
   * řadu vyprázdní až po chvíli (`celebrationEnded`), aby plná řada neblikla.
   */
  private rowSentToMap = false;

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

  /**
   * Řada hvězdiček na novém místě a v nové velikosti, rozsvícená jako
   * předtím. Letící hvězdičky do mapy pokračují ze stejné části dráhy
   * mezi novými polohami řady a značky (#154 AC6).
   */
  redraw(): void {
    for (const icon of this.icons) {
      this.scene.tweens.killTweensOf(icon);
      icon.destroy();
    }
    this.create();
    this.paint();
    if (this.mapFlight !== null) {
      this.destroyFlyingStars(this.mapFlight);
      this.mapFlight.stars = this.createFlyingStars();
      this.moveFlyingStars();
    }
  }

  /**
   * Rozsvítí tolik hvězdiček zleva, kolik jich hráč v řadě získal. Během
   * letu do mapy je řada prázdná, hvězdičky jsou na cestě.
   */
  paint(): void {
    const progress = this.rowSentToMap ? { earned: 0 } : this.readProgress();
    const looks = starLooks(progress);
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

  /**
   * Plná řada odletí do okna s mapou (#154 AC3): každá hvězdička ze svého
   * místa v řadě po oblouku ke značce, kde se zmenší a zmizí. Kde je která,
   * plyne jen z času od ukázání mapy (`mapAnimation.ts`), proto let po
   * otočení pokračuje ze stejné části dráhy a odpočet běží dál v sezení.
   */
  flyToMap(target: () => Origin | null, elapsedMs: () => number): void {
    this.stopMapFlight();
    this.rowSentToMap = true;
    this.mapFlight = { target, elapsedMs, stars: this.createFlyingStars() };
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.moveFlyingStars, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.stopMapFlight, this);
    this.paint();
    this.moveFlyingStars();
  }

  /**
   * Sezení ohlásilo novou řadu (dolet, nebo přerušení nastavením): letící
   * hvězdičky zmizí a řada se nakreslí podle postupu.
   */
  stopMapFlight(): void {
    this.hideFlyingStars();
    if (this.rowSentToMap) {
      this.rowSentToMap = false;
      this.paint();
    }
  }

  /** Letící hvězdičky doletěly nebo mapa zmizela: jen zmizí, řada zůstane prázdná. */
  private hideFlyingStars(): void {
    const flight = this.mapFlight;
    if (flight === null) {
      return;
    }
    this.mapFlight = null;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.moveFlyingStars, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.stopMapFlight, this);
    this.destroyFlyingStars(flight);
  }

  private createFlyingStars(): Phaser.GameObjects.Star[] {
    const outline = STAR_STYLE.earnedOutlineWidth * this.layouts.keypad().detailScale;
    return Array.from({ length: STARS_PER_SET }, (_, index) => {
      const slot = this.icons[index];
      return this.createStarShape(slot?.x ?? 0, slot?.y ?? 0, STAR_FILLED_COLOR)
        .setStrokeStyle(outline, colorNumber(STAR_STYLE.earnedOutlineColor))
        .setDepth(ABOVE_MAP_DEPTH + 1);
    });
  }

  private destroyFlyingStars(flight: MapFlight): void {
    for (const star of flight.stars) {
      star.destroy();
    }
    flight.stars = [];
  }

  /** Každý snímek: hvězdičky na své části dráhy mezi řadou a značkou. */
  private moveFlyingStars(): void {
    const flight = this.mapFlight;
    if (flight === null) {
      return;
    }
    const target = flight.target();
    if (target === null) {
      this.hideFlyingStars();
      return;
    }
    const elapsed = flight.elapsedMs();
    flight.stars.forEach((star, index) => {
      const slot = this.icons[index];
      const from = { x: slot?.x ?? target.x, y: slot?.y ?? target.y };
      const share = starFlightShareAt(index, elapsed);
      const point = starFlightPointAt(from, target, index, elapsed);
      const fade = (share - MAP_FLIGHT_FADE_FROM) / (1 - MAP_FLIGHT_FADE_FROM);
      star
        .setPosition(point.x, point.y)
        .setScale(MAP_FLIGHT_START_SCALE + (MAP_FLIGHT_END_SCALE - MAP_FLIGHT_START_SCALE) * share)
        .setAlpha(1 - Math.min(Math.max(fade, 0), 1));
    });
    const landed = flight.stars.every((_, index) => starFlightShareAt(index, elapsed) >= 1);
    if (landed) {
      this.hideFlyingStars();
    }
  }

  private createStarShape(x: number, y: number, color: number): Phaser.GameObjects.Star {
    const size = this.layouts.scenery().starSize;
    return this.scene.add.star(x, y, 5, size * 0.25, size / 2, color);
  }
}
