import Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { MAP_STEPS } from '../logic/progressMap';
import type { MapMarker, MapMove } from '../logic/progressMap';
import { layoutProgressMap, markerAt } from '../logic/progressMapLayout';
import type { ProgressMapLayout } from '../logic/progressMapLayout';
import { PROGRESS_MAP_STYLE } from '../logic/theme';

/** Mapa leží nad příkladem, konfetami i hvězdičkami, pod panely rodičů. */
const MAP_DEPTH = 20;

/** Krátké zdržení, aby dítě vidělo značku na staré zastávce, než vyrazí. */
const STEP_DELAY_MS = 300;
const STEP_DURATION_MS = 700;
/** Zastávka po dojití značky krátce poskočí. */
const ARRIVAL_PULSE_MS = 180;

const PATH_WIDTH_SHARE = 0.18;
const PLACE_BORDER_SHARE = 0.08;
const GOAL_BORDER_SHARE = 0.14;
const MARKER_BORDER_SHARE = 0.07;
const LETTER_SIZE_SHARE = 0.55;

/**
 * Zástupný vzhled mapy postupu (#87 AC7): cesta, start, zastávky, cíl
 * a značka hráče. Prošlá místa jsou vybarvená, značka se posune o krok.
 * Jen kreslí podle kroku od sezení, nic nerozhoduje a nemá ťukací plochy;
 * kdy se ukáže a zmizí, řídí sezení. Vzhled jde vyměnit bez změny logiky.
 */
export class ProgressMapView {
  private container: Phaser.GameObjects.Container | null = null;
  private shown: MapMove | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker: () => MapMarker,
  ) {}

  /** Ukáže mapu se značkou na `move.from` a posune ji na `move.to`. */
  show(area: GameArea, move: MapMove): void {
    this.hide();
    this.shown = move;
    this.draw(area, move, true);
  }

  /** Otočení telefonu: mapa se překreslí s doběhlým krokem. */
  redraw(area: GameArea): void {
    const move = this.shown;
    if (move === null) {
      return;
    }
    this.destroyDrawing();
    this.draw(area, move, false);
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

  private draw(area: GameArea, move: MapMove, animate: boolean): void {
    const layout = layoutProgressMap(area);
    const backdrop = this.scene.add
      .rectangle(0, 0, area.width, area.height, colorNumber(PROGRESS_MAP_STYLE.background))
      .setOrigin(0, 0);
    const path = this.drawPath(layout);
    const visitedUntil = animate ? move.from : move.to;
    const places = layout.places.map((_, step) =>
      this.drawPlace(layout, step, step <= visitedUntil),
    );
    const markerPoint = markerAt(layout, animate ? move.from : move.to);
    const marker = this.drawMarker(layout, markerPoint.x, markerPoint.y);
    this.container = this.scene.add
      .container(0, 0, [backdrop, path, ...places, marker])
      .setDepth(MAP_DEPTH);

    if (animate) {
      this.animateStep(layout, move, marker, places[move.to]);
    }
  }

  private drawPath(layout: ProgressMapLayout): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(
      layout.markerSize * PATH_WIDTH_SHARE,
      colorNumber(PROGRESS_MAP_STYLE.pathColor),
    );
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
    step: number,
    visited: boolean,
  ): Phaser.GameObjects.Arc {
    const point = markerAt(layout, step);
    const place = this.scene.add.circle(point.x, point.y, layout.placeSize / 2);
    paintPlace(place, layout, step, visited);
    return place;
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
        layout.markerSize * MARKER_BORDER_SHARE,
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
        paintPlace(target, layout, move.to, true);
        this.scene.tweens.add({
          targets: [target, marker],
          scale: 1.15,
          duration: ARRIVAL_PULSE_MS,
          yoyo: true,
          ease: 'Sine.easeOut',
        });
      },
    });
  }
}

/** Barva místa: prošlé plné modré, ostatní světlé; cíl se zeleným okrajem. */
function paintPlace(
  place: Phaser.GameObjects.Arc,
  layout: ProgressMapLayout,
  step: number,
  visited: boolean,
): void {
  const isGoal = step === MAP_STEPS;
  const fill = visited ? PROGRESS_MAP_STYLE.visitedColor : PROGRESS_MAP_STYLE.placeColor;
  const borderShare = isGoal ? GOAL_BORDER_SHARE : PLACE_BORDER_SHARE;
  place.setFillStyle(colorNumber(fill));
  place.setStrokeStyle(layout.placeSize * borderShare, colorNumber(placeBorder(isGoal, visited)));
}

function placeBorder(isGoal: boolean, visited: boolean): string {
  if (isGoal) {
    return PROGRESS_MAP_STYLE.goalBorderColor;
  }
  return visited ? PROGRESS_MAP_STYLE.visitedBorderColor : PROGRESS_MAP_STYLE.placeBorderColor;
}
