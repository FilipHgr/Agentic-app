import Phaser from 'phaser';

import { starFlightPointAt, starFlightShareAt } from '../logic/mapAnimation';
import { STARS_PER_SET } from '../logic/stars';
import type { StarProgress } from '../logic/stars';
import { StarRow } from './StarRow';
import type { Origin } from './StarRow';
import { ABOVE_MAP_DEPTH } from '../logic/mapDepths';

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
 * Sdílená řada hvězdiček s letem plné řady do okna s mapou (#154), společná
 * všem hrám s mapou postupu (#193): Počítání i Znaménka.
 */
export class MapStarRow extends StarRow {
  private mapFlight: MapFlight | null = null;
  /**
   * Hvězdičky z plné řady odletěly do mapy: řada je prázdná, i když sezení
   * řadu vyprázdní až po chvíli (`celebrationEnded`), aby plná řada neblikla.
   */
  private rowSentToMap = false;

  /**
   * Řada hvězdiček na novém místě a v nové velikosti, rozsvícená jako
   * předtím. Letící hvězdičky do mapy pokračují ze stejné části dráhy
   * mezi novými polohami řady a značky (#154 AC6).
   */
  override redraw(): void {
    super.redraw();
    if (this.mapFlight !== null) {
      this.destroyFlyingStars(this.mapFlight);
      this.mapFlight.stars = this.createFlyingStars();
      this.moveFlyingStars();
    }
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

  /** Během letu do mapy je řada prázdná, hvězdičky jsou na cestě. */
  protected override shownProgress(): StarProgress {
    return this.rowSentToMap ? { earned: 0 } : super.shownProgress();
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
    return Array.from({ length: STARS_PER_SET }, (_, index) => {
      const slot = this.icons[index];
      return this.createEarnedStar(slot?.x ?? 0, slot?.y ?? 0).setDepth(ABOVE_MAP_DEPTH + 1);
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
}
