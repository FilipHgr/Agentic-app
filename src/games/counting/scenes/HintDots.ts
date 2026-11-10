import type Phaser from 'phaser';

import { hintCrossedOutDots, hintDotGroups } from '../logic/answerRound';
import type { AnswerRound } from '../logic/answerRound';
import type { DeviceScreenLayout, DeviceWritingLayout } from '../logic/deviceLayout';
import type { DotCounting } from '../logic/dotCounting';
import { layoutDeviceHint } from '../logic/deviceLayout';
import type { HintDot } from '../logic/screenLayout';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { HINT_DOT_STYLE } from '../logic/theme';

/** Každé sčítané číslo má tečky jiné barvy (#30); barvy jsou v `theme.ts` (#52). */
const HINT_GROUP_COLORS = HINT_DOT_STYLE.groupColors.map(colorNumber);

/** Odečítané tečky u odčítání jsou šedé a přeškrtnuté. */
const HINT_CROSSED_OUT_COLOR = colorNumber(HINT_DOT_STYLE.crossedOutColor);
const HINT_CROSS_COLOR = colorNumber(HINT_DOT_STYLE.crossColor);

/** Spočítaná tečka dostane tmavý okraj a tmavé číslo, které je vidět na žluté i modré. */
const DOT_COUNTED_RING_COLOR = colorNumber(HINT_DOT_STYLE.countedRingColor);
const DOT_COUNTED_RING_WIDTH = 6;
const DOT_NUMBER_COLOR = HINT_DOT_STYLE.countedNumberColor;

/** Tečky naskakují jedna po druhé, aby je dítě mohlo počítat s nimi. */
const HINT_DOT_DELAY_MS = 120;

/** Co tečky nápovědy potřebují ze scény. */
export interface HintDotsContext {
  readonly scene: Phaser.Scene;
  readonly round: AnswerRound;
  /** Rozložení se skutečným ovládáním (číselník, nebo okénka). */
  readonly layout: DeviceScreenLayout | DeviceWritingLayout;
  /** Které tečky už dítě spočítalo ťuknutím (#43). */
  readonly counting: DotCounting;
  /** Přidá objekty ke kolu, aby se s ním smazaly. */
  readonly track: (...objects: Phaser.GameObjects.GameObject[]) => void;
  /** Dítě ťuklo na tečku s pořadím `index`. */
  readonly onDotTapped: (index: number, circle: Phaser.GameObjects.Arc) => void;
}

/**
 * Tečky nápovědy. Nové naskakují jedna po druhé; po změně velikosti okna
 * (`animate` je false) jsou vidět hned i se spočítanými čísly.
 */
export function drawHintDots(context: HintDotsContext, animate: boolean): void {
  const { scene, round, layout } = context;
  const style = layout.hintStyle;
  const dots = layoutDeviceHint(layout, hintDotGroups(round.problem));
  const firstCrossedOut = dots.length - hintCrossedOutDots(round.problem);

  dots.forEach((dot, index) => {
    const crossedOut = index >= firstCrossedOut;
    const color = crossedOut
      ? HINT_CROSSED_OUT_COLOR
      : HINT_GROUP_COLORS[dot.group % HINT_GROUP_COLORS.length];
    const circle = scene.add.circle(dot.x, dot.y, style.dotSize / 2, color);
    const parts: Phaser.GameObjects.Shape[] = [circle];
    if (crossedOut) {
      parts.push(
        scene.add
          .rectangle(dot.x, dot.y, style.dotSize * 1.25, style.dotSize * 0.14, HINT_CROSS_COLOR)
          .setAngle(-45),
      );
    }

    context.track(...parts);
    if (animate) {
      popInDot(scene, parts, index);
    }

    // Na tečku jde ťuknout hned, i když ještě naskakuje (#43).
    if (layout.hintDotsCountable) {
      addDotHitZone(context, dot, index, circle, layout.hintDotHitSize);
    }
    const countedNumber = context.counting.numbers[index];
    if (countedNumber !== null && countedNumber !== undefined) {
      markDotCounted(context, circle, countedNumber);
    }
  });
}

/** Právě spočítaná tečka se rozsvítí, ukáže pořadové číslo a poskočí. */
export function showDotCounted(
  context: HintDotsContext,
  circle: Phaser.GameObjects.Arc,
  number: number,
): void {
  const { scene } = context;
  // Tečka, která ještě naskakovala, hned doskočí, aby se do ní číslo vešlo.
  scene.tweens.killTweensOf(circle);
  circle.setScale(1);
  const label = markDotCounted(context, circle, number);
  scene.tweens.add({
    targets: [circle, label],
    scale: { from: 1, to: 1.2 },
    duration: 100,
    yoyo: true,
  });
}

/** Tečka naskočí se zpožděním podle pořadí. */
function popInDot(
  scene: Phaser.Scene,
  parts: readonly Phaser.GameObjects.Shape[],
  index: number,
): void {
  for (const part of parts) {
    part.setScale(0);
  }
  scene.tweens.add({
    targets: parts,
    scale: 1,
    duration: 200,
    delay: index * HINT_DOT_DELAY_MS,
    ease: 'Back.easeOut',
  });
}

/** Neviditelná plocha aspoň 64 CSS px kolem tečky, aby se na ni dalo ťuknout prstem. */
function addDotHitZone(
  context: HintDotsContext,
  dot: HintDot,
  index: number,
  circle: Phaser.GameObjects.Arc,
  size: number,
): void {
  const zone = context.scene.add.zone(dot.x, dot.y, size, size).setInteractive();
  zone.on('pointerdown', () => context.onDotTapped(index, circle));
  context.track(zone);
}

/** Spočítaná tečka: tmavý okraj a pořadové číslo uprostřed. */
function markDotCounted(
  context: HintDotsContext,
  circle: Phaser.GameObjects.Arc,
  number: number,
): Phaser.GameObjects.Text {
  const { layout } = context;
  circle.setStrokeStyle(DOT_COUNTED_RING_WIDTH * layout.detailScale, DOT_COUNTED_RING_COLOR);
  const label = context.scene.add
    .text(circle.x, circle.y, String(number), {
      fontFamily: FONT_FAMILY,
      fontSize: `${layout.dotNumberFontSize}px`,
      fontStyle: 'bold',
      color: DOT_NUMBER_COLOR,
    })
    .setOrigin(0.5);
  context.track(label);
  return label;
}
