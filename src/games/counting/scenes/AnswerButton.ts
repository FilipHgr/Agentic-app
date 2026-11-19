import type Phaser from 'phaser';

import { buttonCornerRadius } from '../logic/checkButton';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { KEYPAD_BUTTON_STYLE, answerButtonLook } from '../logic/theme';
import type { AnswerButtonState } from '../logic/theme';
import { slotWidth } from '../logic/screenLayout';
import type { ButtonSlot } from '../logic/screenLayout';
import { wrongButtonFrame } from '../logic/wrongAnswerFeedback';

/** Číslo na tlačítku zabírá asi dvě třetiny jeho výšky. */
const BUTTON_LABEL_RATIO = 0.64;

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
  /** Tloušťka okraje proti iPadu (#54). */
  readonly detailScale: number;
  /** Odezva na špatné ťuknutí (#155), mění se každý snímek. */
  readonly feedback: WrongButtonFeedback;
}

/** Kdy dítě na tlačítko naposledy špatně ťuklo a jak je právě nakreslené. */
interface WrongButtonFeedback {
  /** Čas posledního špatného ťuknutí (ms hodin scény); starší nejsou potřeba. */
  lastWrongTapMs: number;
  /** Probíhá odezva (tlačítko je zešedlé nebo zmenšené)? */
  active: boolean;
  /** Stav, ve kterém je tlačítko právě nakreslené (překresluje se jen při změně). */
  paintedState: AnswerButtonState;
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
    detailScale,
    feedback: { lastWrongTapMs: 0, active: false, paintedState: 'idle' },
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
  button.feedback.paintedState = state;
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

/**
 * Špatné tlačítko na chvíli zešedne a zmenší se (#155, nahrazuje zatřesení).
 * Zmenší se jen pozadí a číslo kolem středu, ťukací plocha zůstává celá.
 * Další špatné ťuknutí začne odezvu od začátku; průběh kreslí
 * `updateWrongButton` každý snímek.
 */
export function showWrongButton(button: AnswerButton, nowMs: number): void {
  button.feedback.lastWrongTapMs = nowMs;
  button.feedback.active = true;
  updateWrongButton(button, nowMs);
}

/** Nakreslí tlačítko v čase `nowMs` odezvy; po jejím konci ho jednou vrátí do klidu. */
export function updateWrongButton(button: AnswerButton, nowMs: number): void {
  const { feedback } = button;
  if (!feedback.active) {
    return;
  }
  const frame = wrongButtonFrame([feedback.lastWrongTapMs], nowMs);
  if (frame.state !== feedback.paintedState) {
    paintAnswerButton(button, frame.state);
  }
  // Zmenšuje se jen obsah; kontejner s ťukací plochou zůstane v plné velikosti.
  button.background.setScale(frame.scale);
  button.label.setScale(frame.scale);
  if (frame.state === 'idle') {
    feedback.active = false;
  }
}
