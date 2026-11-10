import type Phaser from 'phaser';

import { buttonCornerRadius } from '../logic/checkButton';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { KEYPAD_BUTTON_STYLE, answerButtonLook } from '../logic/theme';
import type { AnswerButtonState } from '../logic/theme';
import { slotWidth } from '../logic/screenLayout';
import type { ButtonSlot } from '../logic/screenLayout';

/** Číslo na tlačítku zabírá asi dvě třetiny jeho výšky. */
const BUTTON_LABEL_RATIO = 0.64;

/** O kolik se tlačítko zatřese po špatné odpovědi (na iPadu). */
const BUTTON_SHAKE_DISTANCE = 14;

/** Jedno tlačítko číselníku. */
export interface AnswerButton {
  readonly value: number;
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  /** Výška tlačítka. */
  readonly size: number;
  /** Šířka tlačítka (na telefonu na šířku širší než výška, #68). */
  readonly width: number;
  /** Vodorovná poloha, kam se tlačítko vrací po zatřesení. */
  readonly homeX: number;
  /** Tloušťka okraje a zatřesení proti iPadu (#54). */
  readonly detailScale: number;
}

/**
 * Nakreslí tlačítko s číslem na místo `slot`.
 *
 * @param onPressed Prst se tlačítka dotkl (o tom, jestli se počítá, rozhoduje scéna).
 */
export function createAnswerButton(
  scene: Phaser.Scene,
  value: number,
  slot: ButtonSlot,
  detailScale: number,
  onPressed: (button: AnswerButton, pointer: Phaser.Input.Pointer) => void,
): AnswerButton {
  const background = scene.add.graphics();
  const label = scene.add
    .text(0, 0, String(value), {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.round(slot.size * BUTTON_LABEL_RATIO)}px`,
      fontStyle: String(KEYPAD_BUTTON_STYLE.digitFontWeight),
      color: KEYPAD_BUTTON_STYLE.digitColor,
    })
    .setOrigin(0.5);

  const container = scene.add.container(slot.x, slot.y, [background, label]);
  const button: AnswerButton = {
    value,
    container,
    background,
    label,
    size: slot.size,
    width: slotWidth(slot),
    homeX: slot.x,
    detailScale,
  };

  paintAnswerButton(button, 'idle');
  container.setSize(button.width, slot.size).setInteractive();
  container.on('pointerdown', (pointer: Phaser.Input.Pointer) => onPressed(button, pointer));

  return button;
}

/** Tlačítko číselníku podle stavu: světle modré, po správné odpovědi zelené (#52). */
export function paintAnswerButton(button: AnswerButton, state: AnswerButtonState): void {
  const look = answerButtonLook(state);
  const halfWidth = button.width / 2;
  const halfHeight = button.size / 2;
  const radius = buttonCornerRadius(button.size);
  // Okraj se kreslí dovnitř tlačítka, aby se nezměnila jeho velikost.
  const borderWidth = look.borderWidth * button.detailScale;
  const inset = borderWidth / 2;

  button.background
    .clear()
    .fillStyle(colorNumber(look.background), 1)
    .fillRoundedRect(-halfWidth, -halfHeight, button.width, button.size, radius)
    .lineStyle(borderWidth, colorNumber(look.borderColor), 1)
    .strokeRoundedRect(
      -halfWidth + inset,
      -halfHeight + inset,
      button.width - borderWidth,
      button.size - borderWidth,
      radius - inset,
    );
  button.label.setColor(look.digitColor);
}

/** Správné tlačítko zezelená a poskočí. */
export function highlightCorrectButton(scene: Phaser.Scene, button: AnswerButton): void {
  paintAnswerButton(button, 'correct');
  scene.tweens.add({
    targets: button.container,
    scale: 1.2,
    duration: 150,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

/** Špatné tlačítko se zatřese a vrátí na své místo. */
export function shakeWrongButton(scene: Phaser.Scene, button: AnswerButton): void {
  // Opakované ťuknutí během třesení začne třesení znovu z výchozího místa.
  scene.tweens.killTweensOf(button.container);
  button.container.x = button.homeX;

  scene.tweens.add({
    targets: button.container,
    x: button.homeX + BUTTON_SHAKE_DISTANCE * button.detailScale,
    duration: 50,
    yoyo: true,
    repeat: 3,
    onComplete: () => {
      button.container.x = button.homeX;
    },
  });
}
