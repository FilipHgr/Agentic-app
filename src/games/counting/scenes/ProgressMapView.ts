import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { GameArea, GameSize } from '../../../shared/logic/viewportLayout';
import type { MapLook } from '../logic/mapPictureLoading';
import {
  MAP_GOAL_SYMBOLS,
  MAP_PICTURE_SIZE,
  mapOrientationOf,
  mapPictureCover,
} from '../logic/mapPictures';
import type { PictureRect } from '../logic/mapPictures';
import { MAP_STEPS } from '../logic/progressMap';
import type { MapMarker, MapMove } from '../logic/progressMap';
import {
  MAP_GOAL_CELEBRATION_SCALE,
  MARKER_ARRIVAL_MS,
  goalCelebrationAt,
  isPlaceLitAt,
  markerPointAt,
  markerShareAt,
} from '../logic/mapAnimation';
import { MAP_ARRIVAL_PULSE_SCALE, layoutProgressMap, markerAt } from '../logic/progressMapLayout';
import type { MapPoint, ProgressMapLayout } from '../logic/progressMapLayout';
import {
  CONFETTI_COLORS,
  PROGRESS_MAP_BACKGROUNDS,
  PROGRESS_MAP_EFFECTS,
  PROGRESS_MAP_SHAPE,
  PROGRESS_MAP_STYLE,
  progressMapStyleFor,
} from '../logic/theme';
import type { ProgressMapStyle } from '../logic/theme';
import { goalSymbolTextureKey, mapPictureTextureKey } from './mapPictureTextures';

/** Mapa leží nad příkladem, konfetami i hvězdičkami, pod panely rodičů. */
const MAP_DEPTH = 20;

/** Zastávka a značka po dojití krátce poskočí (zvětšení a skok nahoru). */
const ARRIVAL_PULSE_MS = 180;
const ARRIVAL_HOP_MS = 280;
const ARRIVAL_HOP_SHARE = 0.12;

/**
 * Zlatá zářící stopa za značkou: jak dlouhá (v průměrech značky), z kolika
 * vrstev (ke značce sílí), jak široká (díl průměru značky) a jak krytá.
 */
const TRAIL_LENGTH = 3.2;
const TRAIL_LAYERS = 8;
const TRAIL_GLOW_WIDTH_SHARE = 0.5;
const TRAIL_CORE_WIDTH_SHARE = 0.12;
/** Krytí jedné vrstvy stopy; u značky se všechny vrstvy sečtou téměř do plna. */
const TRAIL_GLOW_LAYER_ALPHA = 0.4;
const TRAIL_CORE_LAYER_ALPHA = 0.5;

/** Jiskřičky po stopě: kolik, jak velké a jak daleko od cesty (díl průměru značky), jak rychle mihotají. */
const TRAIL_SPARKLES = 4;
const TRAIL_SPARKLE_SIZE = 0.15;
const TRAIL_SPARKLE_SIDE = 0.34;
const TRAIL_SPARKLE_TWINKLE_MS = 70;
const TRAIL_SPARKLE_ALPHA = 0.95;
/** Mihotání jiskřičky: nejmenší velikost a o kolik naroste. */
const TWINKLE_MIN = 0.6;
const TWINKLE_SWING = 0.4;

/** Čtyřcípá jiskřička: vnitřní poloměr a obrys jako díl jejího poloměru. */
const SPARKLE_INNER_SHARE = 0.38;
const SPARKLE_OUTLINE_SHARE = 0.12;

/** Modrá svatozář při zastavení: poloměr a šířka (díl průměru značky), krytí, růst a délka. */
const HALO_RADIUS_SHARE = 0.56;
const HALO_WIDTH_SHARE = 0.14;
const HALO_ALPHA = 0.8;
const HALO_MS = 520;
const HALO_GROWTH = 1.7;

/** Jiskřičky při zastavení: kolik, jak velké a jak daleko doletí (v průměrech značky). */
const ARRIVAL_SPARKLES = 8;
const ARRIVAL_SPARKLE_SIZE = 0.12;
const ARRIVAL_SPARKLE_MS = 560;
const ARRIVAL_SPARKLE_REACH = 1.0;
const ARRIVAL_SPARKLE_END_SCALE = 0.6;

/** Záře slavícího cíle: z kolika vrstev, jak krytá a jak rychle a silně pulzuje. */
const GOAL_GLOW_LAYERS = 4;
const GOAL_GLOW_ALPHA = 0.65;
const GOAL_GLOW_PULSE_MS = 260;
const GOAL_GLOW_PULSE_BASE = 0.8;
const GOAL_GLOW_PULSE_SWING = 0.2;
const GOAL_RING_WIDTH_SHARE = 0.07;

/**
 * Jiskřičky v rozích slavícího cíle: kolik, jak daleko od středu (díl
 * poloviny slavícího čtverce, aby zůstaly uvnitř), jak velké (díl průměru
 * značky) a jak mihotají (rychlost, posun mezi jiskřičkami, velikost).
 */
const GOAL_SPARKLES = 4;
const GOAL_SPARKLE_REACH = 0.82;
const GOAL_SPARKLE_SIZE = 0.11;
const GOAL_SPARKLE_TWINKLE_MS = 180;
const GOAL_SPARKLE_PHASE = 1.3;
const GOAL_SPARKLE_SCALE_MIN = 0.7;
const GOAL_SPARKLE_SCALE_SWING = 0.4;

/**
 * Konfety v cíli (návrh 3-cil): vyletí ze symbolu cíle daleko do mapy
 * (díl šířky okna), pak padají přes celé okno pod jeho spodní okraj a mizí.
 */
const GOAL_CONFETTI_COUNT = 48;
const GOAL_CONFETTI_REACH = { min: 0.12, max: 0.6 };
const GOAL_CONFETTI_BURST_MS = { min: 450, max: 650 };
const GOAL_CONFETTI_FALL_MS = { min: 1500, max: 2300 };
const GOAL_CONFETTI_DRIFT = 0.08;
const GOAL_CONFETTI_ANGLE_JITTER = 0.3;
const GOAL_CONFETTI_SPIN = { min: 180, max: 540 };
/** Velikost konfety jako díl průměru značky. */
const GOAL_CONFETTI_WIDTH = 0.1;
const GOAL_CONFETTI_HEIGHT = 0.16;

const PATH_WIDTH_SHARE = 0.18;
const LETTER_SIZE_SHARE = 0.55;

const CONFETTI_COLOR_NUMBERS = CONFETTI_COLORS.map(colorNumber);

/** Barvy efektů převedené na čísla jednou, ne v každém snímku. */
const EFFECT_COLORS = {
  trailGlow: colorNumber(PROGRESS_MAP_EFFECTS.trailGlowColor),
  trailCore: colorNumber(PROGRESS_MAP_EFFECTS.trailCoreColor),
  sparkles: PROGRESS_MAP_EFFECTS.sparkleColors.map(colorNumber),
  sparkleOutline: colorNumber(PROGRESS_MAP_EFFECTS.sparkleOutlineColor),
  halo: colorNumber(PROGRESS_MAP_EFFECTS.haloColor),
  goalGlow: colorNumber(PROGRESS_MAP_EFFECTS.goalGlowColor),
  goalRing: colorNumber(PROGRESS_MAP_EFFECTS.goalRingColor),
};

function sparkleColor(index: number): number {
  return EFFECT_COLORS.sparkles[index % EFFECT_COLORS.sparkles.length] ?? EFFECT_COLORS.goalRing;
}

/** Kde a jak mapu nakreslit: plocha, okno v CSS px a vzhled tohoto ukázání. */
export interface MapScreen {
  readonly area: GameArea;
  readonly window: GameSize;
  readonly look: MapLook;
}

/** Nakreslená mapa jednoho ukázání a co už z jednorázových efektů proběhlo. */
interface MapDrawing {
  readonly container: Phaser.GameObjects.Container;
  readonly layout: ProgressMapLayout;
  readonly style: ProgressMapStyle;
  readonly move: MapMove;
  readonly marker: Phaser.GameObjects.Container;
  readonly target: Phaser.GameObjects.Arc | undefined;
  readonly trail: Phaser.GameObjects.Graphics;
  readonly goal: Phaser.GameObjects.Container;
  readonly goalGlow: Phaser.GameObjects.Graphics;
  readonly goalSparkles: readonly Phaser.GameObjects.Star[];
  /** Značka už zastavila na novém místě (svatozář a jiskřičky proběhly). */
  arrived: boolean;
  /** Konfety v cíli už vyletěly. */
  confettiThrown: boolean;
  /** Značka stojí a doskákala: stopa a poloha se už nepočítají. */
  settled: boolean;
  /** Cíl je plně zvětšený: velikost se už nepočítá. */
  goalGrown: boolean;
  /** Spodní okraj okna v herních jednotkách: konfety padají až pod něj. */
  readonly windowBottom: number;
  /** Šířka okna v herních jednotkách: jak daleko konfety vyletí. */
  readonly windowWidth: number;
}

/**
 * Mapa postupu (#87, #133, #134, #135): obrázek prostředí přes celé okno,
 * nad ním cesta, start, 2 zastávky, cíl se symbolem tématu a značka hráče.
 * Bez staženého obrázku zástupný vzhled v barvě mapy (#134 AC4).
 * Značka jde po cestě se zlatou stopou, nové místo se rozsvítí až při
 * zastavení (svatozář, jiskřičky, poskočení) a v cíli se symbol zvětší
 * a zazáří a přijdou konfety. Kde co je, řídí časová osa
 * `logic/mapAnimation.ts` podle času od ukázání, takže po otočení se mapa
 * překreslí ve stejném okamžiku. Nic nerozhoduje a nemá ťukací plochy
 * (#134 AC3); kdy se ukáže a zmizí, řídí sezení. Kolečko a domeček jsou
 * prvky stránky, leží nad plátnem, a tedy i nad mapou.
 */
export class ProgressMapView {
  private drawing: MapDrawing | null = null;
  private shown: MapMove | null = null;
  /** Kdy se mapa ukázala (čas scény); po otočení se zachová. */
  private shownAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker: () => MapMarker,
  ) {}

  /** Ukáže mapu se značkou na `move.from`; značka pak jde na `move.to`. */
  show(screen: MapScreen, move: MapMove): void {
    this.hide();
    this.shown = move;
    this.shownAt = this.scene.time.now;
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.hide, this);
    this.draw(screen, move);
  }

  /** Otočení zařízení: mapa se překreslí a animace pokračuje ze stejného okamžiku. */
  redraw(screen: MapScreen): void {
    const move = this.shown;
    if (move === null) {
      return;
    }
    this.destroyDrawing();
    this.draw(screen, move);
  }

  /** Mapa zmizí i uprostřed animace: efekty se zastaví a nic dalšího se nestane. */
  hide(): void {
    this.shown = null;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.hide, this);
    this.destroyDrawing();
  }

  private elapsedMs(): number {
    return Math.max(0, this.scene.time.now - this.shownAt);
  }

  private destroyDrawing(): void {
    const drawing = this.drawing;
    this.drawing = null;
    if (drawing) {
      this.scene.tweens.killTweensOf(drawing.container.list);
      drawing.container.destroy(true);
    }
  }

  private draw(screen: MapScreen, move: MapMove): void {
    const { area, look } = screen;
    const elapsed = this.elapsedMs();
    const windowRect = toGameUnits({ left: 0, top: 0, ...screen.window }, area);
    const layout = layoutProgressMap(area, move.theme);
    const style = progressMapStyleFor(move.theme, look);
    const background = this.drawBackground(screen, move);
    const path = this.drawPath(layout, style);
    const trail = this.scene.add.graphics();
    const places = layout.places.map((_, step) =>
      this.drawPlace(layout, style, step, isPlaceLitAt(move, step, elapsed)),
    );
    const goalGlow = this.scene.add.graphics();
    const goal = this.drawGoalSymbol(layout, style, move, goalGlow);
    const goalSparkles = this.drawGoalSparkles(layout);
    const markerPoint = markerPointAt(layout, move, elapsed);
    const marker = this.drawMarker(layout, markerPoint.x, markerPoint.y);
    const container = this.scene.add
      .container(0, 0, [...background, path, ...places, trail, goal, ...goalSparkles, marker])
      .setDepth(MAP_DEPTH);
    this.drawing = {
      container,
      layout,
      style,
      move,
      marker,
      target: places[move.to],
      trail,
      goal,
      goalGlow,
      goalSparkles,
      // Po otočení se jednorázové efekty, které už proběhly, neopakují.
      arrived: isPlaceLitAt(move, move.to, elapsed),
      confettiThrown: goalCelebrationAt(move, elapsed).confetti,
      settled: false,
      goalGrown: false,
      windowBottom: windowRect.top + windowRect.height,
      windowWidth: windowRect.width,
    };
    this.tick();
  }

  /** Každý snímek: značka, stopa, rozsvícení nového místa a slavící cíl podle času. */
  private tick(): void {
    const drawing = this.drawing;
    if (drawing === null) {
      return;
    }
    const elapsed = this.elapsedMs();
    const { layout, move, marker } = drawing;
    if (!drawing.settled) {
      const point = markerPointAt(layout, move, elapsed);
      marker.setPosition(point.x, point.y - arrivalHop(elapsed) * layout.markerSize);
      this.drawTrail(drawing, elapsed);
      // Značka stojí a doskákala: poloha ani stopa se už nemění.
      drawing.settled = elapsed >= MARKER_ARRIVAL_MS + ARRIVAL_HOP_MS;
    }
    if (!drawing.arrived && isPlaceLitAt(move, move.to, elapsed)) {
      drawing.arrived = true;
      this.celebrateArrival(drawing);
    }
    if (move.reachedGoal) {
      this.paintGoal(drawing, elapsed);
    }
  }

  /**
   * Zástupná barva přes celé okno a nad ní obrázek, když je v tomto
   * ukázání (AC1, AC4). Okno je v herních jednotkách, plátno z něj ukáže
   * jen herní plochu; zbytek okna vyplní stránka stejným obrázkem.
   */
  private drawBackground(screen: MapScreen, move: MapMove): Phaser.GameObjects.GameObject[] {
    const { area, window, look } = screen;
    const windowRect = toGameUnits({ left: 0, top: 0, ...window }, area);
    const backdrop = this.scene.add
      .rectangle(
        windowRect.left,
        windowRect.top,
        windowRect.width,
        windowRect.height,
        colorNumber(PROGRESS_MAP_BACKGROUNDS[move.theme]),
      )
      .setOrigin(0, 0);
    const orientation = mapOrientationOf(window);
    const key = mapPictureTextureKey({ theme: move.theme, orientation });
    if (look !== 'picture' || !this.scene.textures.exists(key)) {
      return [backdrop];
    }
    const cover = toGameUnits(mapPictureCover(window, MAP_PICTURE_SIZE[orientation]), area);
    const picture = this.scene.add
      .image(cover.left, cover.top, key)
      .setOrigin(0, 0)
      .setDisplaySize(cover.width, cover.height);
    return [backdrop, picture];
  }

  private drawPath(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(layout.markerSize * PATH_WIDTH_SHARE, colorNumber(style.pathColor));
    const [first, ...rest] = layout.places;
    if (first) {
      graphics.beginPath();
      graphics.moveTo(first.x, first.y);
      for (const point of rest) {
        graphics.lineTo(point.x, point.y);
      }
      graphics.strokePath();
    }
    return graphics;
  }

  private drawPlace(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
    step: number,
    visited: boolean,
  ): Phaser.GameObjects.Arc {
    const point = markerAt(layout, step);
    const place = this.scene.add.circle(point.x, point.y, layout.placeSize / 2);
    paintPlace(place, layout, style, step, visited);
    return place;
  }

  /**
   * Symbol tématu u cíle (AC2) na světlém kruhovém podkladu s okrajem, aby
   * nesplýval s obrázkem pod ním. Bez načteného SVG systémové emoji
   * (symbol, ne text jazyka). Pod podkladem je skrytá zlatá záře
   * s prstencem, která se ukáže, až cíl slaví (#135 AC3).
   */
  private drawGoalSymbol(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
    move: MapMove,
    glow: Phaser.GameObjects.Graphics,
  ): Phaser.GameObjects.Container {
    const { x, y, size } = layout.goalSymbol;
    paintGoalGlow(glow, size);
    glow.setVisible(false);
    const border = size * PROGRESS_MAP_SHAPE.goalBadgeBorderShare;
    // Okraj leží na hraně kruhu napůl venku: celý podklad má průměr `size`.
    const badge = this.scene.add
      .circle(0, 0, (size - border) / 2, colorNumber(style.goalBadgeColor))
      .setStrokeStyle(border, colorNumber(style.goalBadgeBorderColor));
    const symbolSize = size * PROGRESS_MAP_SHAPE.goalSymbolShare;
    const key = goalSymbolTextureKey(move.theme);
    const symbol = this.scene.textures.exists(key)
      ? this.scene.add.image(0, 0, key).setDisplaySize(symbolSize, symbolSize)
      : this.scene.add
          .text(0, 0, MAP_GOAL_SYMBOLS[move.theme].emoji, {
            fontFamily: FONT_FAMILY,
            fontSize: `${Math.round(symbolSize)}px`,
          })
          .setOrigin(0.5);
    return this.scene.add.container(x, y, [glow, badge, symbol]);
  }

  /** Jiskřičky v rozích slavícího cíle, skryté, dokud cíl neslaví. */
  private drawGoalSparkles(layout: ProgressMapLayout): Phaser.GameObjects.Star[] {
    const { x, y, size } = layout.goalCelebration;
    const reach = (size / 2) * GOAL_SPARKLE_REACH;
    return Array.from({ length: GOAL_SPARKLES }, (_, index) => {
      const angle = Math.PI / 4 + (index * Math.PI) / 2;
      return this.sparkle(
        x + Math.cos(angle) * reach,
        y + Math.sin(angle) * reach,
        layout.markerSize * GOAL_SPARKLE_SIZE,
        index,
      ).setVisible(false);
    });
  }

  private drawMarker(
    layout: ProgressMapLayout,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const { color, letter } = this.marker();
    const radius = layout.markerSize / 2;
    const circle = this.scene.add
      .circle(0, 0, radius, colorNumber(color))
      .setStrokeStyle(
        layout.markerSize * PROGRESS_MAP_SHAPE.markerBorderShare,
        colorNumber(PROGRESS_MAP_STYLE.markerBorderColor),
      );
    const parts: Phaser.GameObjects.GameObject[] = [circle];
    if (letter !== null) {
      parts.push(
        this.scene.add
          .text(0, 0, letter, {
            fontFamily: FONT_FAMILY,
            fontSize: `${Math.round(layout.markerSize * LETTER_SIZE_SHARE)}px`,
            fontStyle: String(PROGRESS_MAP_STYLE.markerLetterWeight),
            color: PROGRESS_MAP_STYLE.markerLetterColor,
          })
          .setOrigin(0.5),
      );
    }
    return this.scene.add.container(x, y, parts);
  }

  /** Bílá nebo zlatá čtyřcípá jiskřička se zlatým obrysem. */
  private sparkle(x: number, y: number, radius: number, index: number): Phaser.GameObjects.Star {
    return this.scene.add
      .star(x, y, 4, radius * SPARKLE_INNER_SHARE, radius, sparkleColor(index))
      .setStrokeStyle(Math.max(1, radius * SPARKLE_OUTLINE_SHARE), EFFECT_COLORS.sparkleOutline);
  }

  /**
   * Krátká zlatá zářící stopa za jdoucí značkou: dílky blíž ke značce
   * jasnější, po stopě pár mihotajících se jiskřiček. Po zastavení zmizí.
   */
  private drawTrail(drawing: MapDrawing, elapsed: number): void {
    const { trail, layout, move } = drawing;
    trail.clear();
    const share = markerShareAt(elapsed);
    if (share <= 0 || share >= 1) {
      return;
    }
    const from = layout.places[move.from];
    const to = layout.places[move.to];
    if (!from || !to) {
      return;
    }
    const stepLength = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    // Stopa začíná až za okrajem minulého místa, aby ho nepřekryla.
    const tailMin = layout.placeSize / 2 / stepLength;
    const tail = Math.max(tailMin, share - (layout.markerSize * TRAIL_LENGTH) / stepLength);
    if (share <= tail) {
      return;
    }
    const head = pointBetween(from, to, share);
    const layerShare = (share - tail) / TRAIL_LAYERS;
    // Vrstvy jdou od stále bližšího začátku až ke značce: u značky se
    // sečtou do plného jasu, ke konci stopy plynule slábnou (bez švů).
    for (let layer = 0; layer < TRAIL_LAYERS; layer += 1) {
      const start = pointBetween(from, to, tail + layerShare * layer);
      trail.lineStyle(
        layout.markerSize * TRAIL_GLOW_WIDTH_SHARE,
        EFFECT_COLORS.trailGlow,
        TRAIL_GLOW_LAYER_ALPHA,
      );
      trail.lineBetween(start.x, start.y, head.x, head.y);
      trail.lineStyle(
        layout.markerSize * TRAIL_CORE_WIDTH_SHARE,
        EFFECT_COLORS.trailCore,
        TRAIL_CORE_LAYER_ALPHA,
      );
      trail.lineBetween(start.x, start.y, head.x, head.y);
    }
    this.drawTrailSparkles(drawing, from, to, tail, share, elapsed);
  }

  private drawTrailSparkles(
    drawing: MapDrawing,
    from: MapPoint,
    to: MapPoint,
    tail: number,
    share: number,
    elapsed: number,
  ): void {
    const { trail, layout } = drawing;
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
    for (let index = 0; index < TRAIL_SPARKLES; index += 1) {
      const along = pointBetween(
        from,
        to,
        tail + ((share - tail) * (index + 0.5)) / TRAIL_SPARKLES,
      );
      const side = (index % 2 === 0 ? 1 : -1) * layout.markerSize * TRAIL_SPARKLE_SIDE;
      const twinkle =
        TWINKLE_MIN + TWINKLE_SWING * Math.sin(elapsed / TRAIL_SPARKLE_TWINKLE_MS + index * 2);
      const radius = layout.markerSize * TRAIL_SPARKLE_SIZE * twinkle;
      trail.fillStyle(sparkleColor(index), TRAIL_SPARKLE_ALPHA);
      trail.fillPoints(
        starPoints(along.x + normal.x * side, along.y + normal.y * side, radius),
        true,
      );
    }
  }

  /**
   * Značka zastavila: nové místo se rozsvítí, místo i značka poskočí,
   * kolem značky se rozplyne modrá svatozář a rozletí 8 jiskřiček (AC2).
   * Efekty po doběhnutí samy zmizí.
   */
  private celebrateArrival(drawing: MapDrawing): void {
    const { layout, style, move, marker, target, container } = drawing;
    const point = markerAt(layout, move.to);
    if (target) {
      paintPlace(target, layout, style, move.to, true);
    }
    this.scene.tweens.add({
      targets: target ? [target, marker] : [marker],
      scale: MAP_ARRIVAL_PULSE_SCALE,
      duration: ARRIVAL_PULSE_MS,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    const halo = this.scene.add
      .circle(point.x, point.y, layout.markerSize * HALO_RADIUS_SHARE)
      .setStrokeStyle(layout.markerSize * HALO_WIDTH_SHARE, EFFECT_COLORS.halo, HALO_ALPHA);
    container.addAt(halo, container.getIndex(marker));
    this.scene.tweens.add({
      targets: halo,
      scale: HALO_GROWTH,
      alpha: 0,
      duration: HALO_MS,
      ease: 'Sine.easeOut',
      onComplete: () => halo.destroy(),
    });
    for (let index = 0; index < ARRIVAL_SPARKLES; index += 1) {
      const angle = (index / ARRIVAL_SPARKLES) * Math.PI * 2;
      const star = this.sparkle(point.x, point.y, layout.markerSize * ARRIVAL_SPARKLE_SIZE, index);
      container.add(star);
      const reach = layout.markerSize * ARRIVAL_SPARKLE_REACH;
      this.scene.tweens.add({
        targets: star,
        x: point.x + Math.cos(angle) * reach,
        y: point.y + Math.sin(angle) * reach,
        scale: ARRIVAL_SPARKLE_END_SCALE,
        // Jiskřička nejdřív doletí a teprve ke konci zmizí.
        alpha: { value: 0, ease: 'Quart.easeIn' },
        angle: 90,
        duration: ARRIVAL_SPARKLE_MS,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  /** Slavící cíl: zvětšení, pulzující záře, jiskřičky a jednou konfety (AC3). */
  private paintGoal(drawing: MapDrawing, elapsed: number): void {
    const moment = goalCelebrationAt(drawing.move, elapsed);
    if (!drawing.goalGrown) {
      drawing.goal.setScale(moment.scale);
      drawing.goalGrown = moment.scale >= MAP_GOAL_CELEBRATION_SCALE;
    }
    drawing.goalGlow.setVisible(moment.glowing);
    drawing.goalSparkles.forEach((star) => star.setVisible(moment.glowing));
    if (moment.glowing) {
      drawing.goalGlow.setAlpha(
        GOAL_GLOW_PULSE_BASE + GOAL_GLOW_PULSE_SWING * Math.sin(elapsed / GOAL_GLOW_PULSE_MS),
      );
      drawing.goalSparkles.forEach((star, index) => {
        const twinkle = Math.sin(elapsed / GOAL_SPARKLE_TWINKLE_MS + index * GOAL_SPARKLE_PHASE);
        star.setScale(GOAL_SPARKLE_SCALE_MIN + GOAL_SPARKLE_SCALE_SWING * Math.abs(twinkle));
      });
    }
    if (moment.confetti && !drawing.confettiThrown) {
      drawing.confettiThrown = true;
      this.throwGoalConfetti(drawing);
    }
  }

  /**
   * Konfety vyletí ze symbolu cíle na všechny strany daleko do mapy, pak
   * padají přes celé okno pod jeho spodní okraj a mizí. Druhý tween
   * (pád) začne až po prvním (výletu), oba se ruší se zbytkem mapy.
   */
  private throwGoalConfetti(drawing: MapDrawing): void {
    const { layout, container, windowBottom, windowWidth } = drawing;
    const { x, y } = layout.goalSymbol;
    const unit = layout.markerSize;
    const fallTo = windowBottom + unit * GOAL_CONFETTI_HEIGHT * 2;
    for (let index = 0; index < GOAL_CONFETTI_COUNT; index += 1) {
      const color = CONFETTI_COLOR_NUMBERS[index % CONFETTI_COLOR_NUMBERS.length];
      const piece = this.scene.add
        .rectangle(x, y, unit * GOAL_CONFETTI_WIDTH, unit * GOAL_CONFETTI_HEIGHT, color)
        .setAngle(Phaser.Math.Between(0, 360));
      container.add(piece);
      const angle =
        (index / GOAL_CONFETTI_COUNT) * Math.PI * 2 +
        Phaser.Math.FloatBetween(0, GOAL_CONFETTI_ANGLE_JITTER);
      const reach =
        windowWidth * Phaser.Math.FloatBetween(GOAL_CONFETTI_REACH.min, GOAL_CONFETTI_REACH.max);
      const burstX = x + Math.cos(angle) * reach;
      const burstMs = Phaser.Math.Between(GOAL_CONFETTI_BURST_MS.min, GOAL_CONFETTI_BURST_MS.max);
      const fallMs = Phaser.Math.Between(GOAL_CONFETTI_FALL_MS.min, GOAL_CONFETTI_FALL_MS.max);
      const spin = Phaser.Math.Between(GOAL_CONFETTI_SPIN.min, GOAL_CONFETTI_SPIN.max);
      this.scene.tweens.add({
        targets: piece,
        x: burstX,
        y: y + Math.sin(angle) * reach,
        angle: piece.angle + spin / 2,
        duration: burstMs,
        ease: 'Cubic.easeOut',
      });
      const drift = windowWidth * GOAL_CONFETTI_DRIFT;
      this.scene.tweens.add({
        targets: piece,
        x: burstX + Phaser.Math.FloatBetween(-drift, drift),
        y: fallTo,
        angle: piece.angle + spin,
        delay: burstMs,
        duration: fallMs,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }
}

/** Jak vysoko (v průměrech značky) značka po zastavení zrovna poskočila. */
function arrivalHop(elapsed: number): number {
  const sinceArrival = elapsed - MARKER_ARRIVAL_MS;
  if (sinceArrival <= 0 || sinceArrival >= ARRIVAL_HOP_MS) {
    return 0;
  }
  return Math.sin((Math.PI * sinceArrival) / ARRIVAL_HOP_MS) * ARRIVAL_HOP_SHARE;
}

/** Bod na úseku `from`–`to` v dílu `share`. */
function pointBetween(from: MapPoint, to: MapPoint, share: number): MapPoint {
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

/** Body čtyřcípé jiskřičky se středem `x`, `y`. */
function starPoints(x: number, y: number, radius: number): Phaser.Math.Vector2[] {
  const inner = radius * SPARKLE_INNER_SHARE;
  return Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4 - Math.PI / 2;
    const reach = index % 2 === 0 ? radius : inner;
    return new Phaser.Math.Vector2(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  });
}

/**
 * Zlatá záře a prstenec kolem podkladu symbolu cíle o průměru `size`
 * (v souřadnicích symbolu, zvětší se s ním). Záře sahá o `goalGlowShare`
 * průměru za podklad, jak s ní počítá rozložení (`goalCelebration`).
 */
function paintGoalGlow(glow: Phaser.GameObjects.Graphics, size: number): void {
  const radius = size / 2;
  const reach = radius * PROGRESS_MAP_SHAPE.goalGlowShare;
  for (let layer = GOAL_GLOW_LAYERS; layer >= 1; layer -= 1) {
    glow.fillStyle(EFFECT_COLORS.goalGlow, GOAL_GLOW_ALPHA);
    glow.fillCircle(0, 0, radius + (reach * layer) / GOAL_GLOW_LAYERS);
  }
  const ringWidth = size * GOAL_RING_WIDTH_SHARE;
  glow.lineStyle(ringWidth, EFFECT_COLORS.goalRing, 1);
  glow.strokeCircle(0, 0, radius + ringWidth / 2);
}

/** Obdélník v CSS px okna převedený do herních jednotek plochy `area`. */
function toGameUnits(rect: PictureRect, area: GameArea): PictureRect {
  const scale = area.scale > 0 ? area.scale : 1;
  return {
    left: (rect.left - area.offsetX) / scale,
    top: (rect.top - area.offsetY) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

/** Barva místa: prošlé plné modré, ostatní světlé; cíl se zeleným okrajem. */
function paintPlace(
  place: Phaser.GameObjects.Arc,
  layout: ProgressMapLayout,
  style: ProgressMapStyle,
  step: number,
  visited: boolean,
): void {
  const isGoal = step === MAP_STEPS;
  const fill = visited ? PROGRESS_MAP_STYLE.visitedColor : PROGRESS_MAP_STYLE.placeColor;
  const borderShare = isGoal
    ? PROGRESS_MAP_SHAPE.goalBorderShare
    : PROGRESS_MAP_SHAPE.placeBorderShare;
  place.setFillStyle(colorNumber(fill));
  place.setStrokeStyle(
    layout.placeSize * borderShare,
    colorNumber(placeBorder(style, isGoal, visited)),
  );
}

function placeBorder(style: ProgressMapStyle, isGoal: boolean, visited: boolean): string {
  if (isGoal) {
    return style.goalBorderColor;
  }
  return visited ? PROGRESS_MAP_STYLE.visitedBorderColor : style.placeBorderColor;
}
