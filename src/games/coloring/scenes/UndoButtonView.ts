/**
 * Tlačítko Zpět v pruhu u úchytu (#89, #96) se zástupným vzhledem A3:
 * světle modrý čtverec jako tlačítko barvy a uprostřed modrá šipka zpět
 * (↶), bez textu. Ťuknutí pozná scéna přes `touchTargetAt`; co se vrátí,
 * řídí logika (`savedPicture.ts`). Když není co vracet, scéna tlačítko
 * jen zhoupne.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { UNDO_BUTTON_STYLE } from '../logic/theme';

/** Zhoupnutí jako u dlaždic v menu: na jednu stranu, na druhou a zpět. */
const WOBBLE = { angle: 8, durationMs: 90 };

export class UndoButtonView {
  private graphics: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Postaví tlačítko na místo `rect` v hloubce `depth`, např. po otočení. */
  place(rect: LayoutRect, cssScale: number, depth: number): void {
    this.destroy();
    // Střed tlačítka je počátek, aby se zhoupnutí točilo kolem středu.
    const graphics = this.scene.add.graphics({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    graphics.setDepth(depth);
    drawButton(graphics, rect, cssScale);
    this.graphics = graphics;
  }

  /** Není co vracet: tlačítko se jen zhoupne (#89 AC3). */
  wobble(): void {
    const graphics = this.graphics;
    if (graphics === null) {
      return;
    }
    this.scene.tweens.killTweensOf(graphics);
    graphics.setAngle(0);
    this.scene.tweens.chain({
      targets: graphics,
      tweens: [
        { angle: WOBBLE.angle, duration: WOBBLE.durationMs, ease: 'Sine.easeOut' },
        { angle: -WOBBLE.angle, duration: 2 * WOBBLE.durationMs, ease: 'Sine.easeInOut' },
        { angle: 0, duration: WOBBLE.durationMs, ease: 'Sine.easeIn' },
      ],
    });
  }

  destroy(): void {
    if (this.graphics !== null) {
      this.scene.tweens.killTweensOf(this.graphics);
      this.graphics.destroy();
    }
    this.graphics = null;
  }
}

/** Tlačítko se středem v počátku: podklad s okrajem a šipka zpět. */
function drawButton(button: Phaser.GameObjects.Graphics, rect: LayoutRect, cssScale: number): void {
  const style = UNDO_BUTTON_STYLE;
  const side = Math.min(rect.width, rect.height);
  const borderWidth = style.borderWidthCss / cssScale;
  const radius = side * style.cornerRadiusShare;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const inset = borderWidth / 2;

  button.fillStyle(colorNumber(style.background), 1);
  button.fillRoundedRect(-halfWidth, -halfHeight, rect.width, rect.height, radius);
  button.lineStyle(borderWidth, colorNumber(style.borderColor), 1);
  button.strokeRoundedRect(
    -halfWidth + inset,
    -halfHeight + inset,
    rect.width - borderWidth,
    rect.height - borderWidth,
    Math.max(0, radius - inset),
  );
  drawBackArrow(button, side);
}

/** Šipka ↶: oblouk přes horní polovinu zprava doleva a hrot dolů na levém konci. */
function drawBackArrow(button: Phaser.GameObjects.Graphics, side: number): void {
  const style = UNDO_BUTTON_STYLE;
  const color = colorNumber(style.symbolColor);
  const lineWidth = side * style.symbolLineShare;
  const arcRadius = side * style.symbolRadiusShare;
  const centerY = arcRadius * 0.35;
  const head = lineWidth * 1.4;

  button.lineStyle(lineWidth, color, 1);
  button.beginPath();
  button.arc(0, centerY, arcRadius, 0, Math.PI, true);
  button.strokePath();
  // Pravý konec oblouku pokračuje kousek dolů, ať šipka vypadá jako ↶.
  button.lineBetween(arcRadius, centerY, arcRadius, centerY + arcRadius * 0.45);

  button.fillStyle(color, 1);
  button.fillTriangle(
    -arcRadius - head,
    centerY - lineWidth * 0.2,
    -arcRadius + head,
    centerY - lineWidth * 0.2,
    -arcRadius,
    centerY + head * 1.3,
  );
}
