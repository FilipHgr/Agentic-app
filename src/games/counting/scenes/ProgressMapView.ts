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
import { MAP_ARRIVAL_PULSE_SCALE, layoutProgressMap, markerAt } from '../logic/progressMapLayout';
import type { ProgressMapLayout } from '../logic/progressMapLayout';
import {
  PROGRESS_MAP_BACKGROUNDS,
  PROGRESS_MAP_SHAPE,
  PROGRESS_MAP_STYLE,
  progressMapStyleFor,
} from '../logic/theme';
import type { ProgressMapStyle } from '../logic/theme';
import { goalSymbolTextureKey, mapPictureTextureKey } from './mapPictureTextures';

/** Mapa leží nad příkladem, konfetami i hvězdičkami, pod panely rodičů. */
const MAP_DEPTH = 20;

/** Krátké zdržení, aby dítě vidělo značku na staré zastávce, než vyrazí. */
const STEP_DELAY_MS = 300;
const STEP_DURATION_MS = 700;
/** Zastávka po dojití značky krátce poskočí. */
const ARRIVAL_PULSE_MS = 180;

const PATH_WIDTH_SHARE = 0.18;
const LETTER_SIZE_SHARE = 0.55;

/** Kde a jak mapu nakreslit: plocha, okno v CSS px a vzhled tohoto ukázání. */
export interface MapScreen {
  readonly area: GameArea;
  readonly window: GameSize;
  readonly look: MapLook;
}

/**
 * Mapa postupu (#87, #133, #134): obrázek prostředí přes celé okno, nad
 * ním cesta, start, 2 zastávky, cíl se symbolem tématu a značka hráče.
 * Bez staženého obrázku zástupný vzhled v barvě mapy (#134 AC4). Prošlá
 * místa jsou vybarvená, značka se posune o krok.
 * Jen kreslí podle kroku a vzhledu od scény, nic nerozhoduje a nemá ťukací
 * plochy (#134 AC3); kdy se ukáže a zmizí, řídí sezení. Kolečko a domeček
 * jsou prvky stránky, leží nad plátnem, a tedy i nad mapou.
 */
export class ProgressMapView {
  private container: Phaser.GameObjects.Container | null = null;
  private shown: MapMove | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker: () => MapMarker,
  ) {}

  /** Ukáže mapu se značkou na `move.from` a posune ji na `move.to`. */
  show(screen: MapScreen, move: MapMove): void {
    this.hide();
    this.shown = move;
    this.draw(screen, move, true);
  }

  /** Otočení zařízení: mapa se překreslí s doběhlým krokem. */
  redraw(screen: MapScreen): void {
    const move = this.shown;
    if (move === null) {
      return;
    }
    this.destroyDrawing();
    this.draw(screen, move, false);
  }

  hide(): void {
    this.shown = null;
    this.destroyDrawing();
  }

  private destroyDrawing(): void {
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container.list);
      this.container.destroy(true);
      this.container = null;
    }
  }

  private draw(screen: MapScreen, move: MapMove, animate: boolean): void {
    const { area, look } = screen;
    const layout = layoutProgressMap(area, move.theme);
    const style = progressMapStyleFor(move.theme, look);
    const background = this.drawBackground(screen, move);
    const path = this.drawPath(layout, style);
    const visitedUntil = animate ? move.from : move.to;
    const places = layout.places.map((_, step) =>
      this.drawPlace(layout, style, step, step <= visitedUntil),
    );
    const symbol = this.drawGoalSymbol(layout, style, move);
    const markerPoint = markerAt(layout, animate ? move.from : move.to);
    const marker = this.drawMarker(layout, markerPoint.x, markerPoint.y);
    this.container = this.scene.add
      .container(0, 0, [...background, path, ...places, symbol, marker])
      .setDepth(MAP_DEPTH);

    if (animate) {
      this.animateStep(layout, style, move, marker, places[move.to]);
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
   * (symbol, ne text jazyka).
   */
  private drawGoalSymbol(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
    move: MapMove,
  ): Phaser.GameObjects.Container {
    const { x, y, size } = layout.goalSymbol;
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
    return this.scene.add.container(x, y, [badge, symbol]);
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

  /** Značka dojde po cestě na další zastávku, ta se vybarví a poskočí. */
  private animateStep(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
    move: MapMove,
    marker: Phaser.GameObjects.Container,
    target: Phaser.GameObjects.Arc | undefined,
  ): void {
    const to = markerAt(layout, move.to);
    this.scene.tweens.add({
      targets: marker,
      x: to.x,
      y: to.y,
      delay: STEP_DELAY_MS,
      duration: STEP_DURATION_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!target) {
          return;
        }
        paintPlace(target, layout, style, move.to, true);
        this.scene.tweens.add({
          targets: [target, marker],
          scale: MAP_ARRIVAL_PULSE_SCALE,
          duration: ARRIVAL_PULSE_MS,
          yoyo: true,
          ease: 'Sine.easeOut',
        });
      },
    });
  }
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
