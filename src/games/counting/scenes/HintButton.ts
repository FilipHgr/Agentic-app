import type Phaser from 'phaser';

import type { ButtonSlot } from '../logic/screenLayout';
import { HINT_BUTTON_STYLE } from '../logic/theme';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';

/** Symbol v baňce žárovky (#84); je to symbol, ne text jazyka. */
const HINT_SYMBOL = '?';

/**
 * Rozměry žárovky jako díl průměru tlačítka, aby vypadala stejně při
 * každé velikosti. Svislé polohy jsou od středu tlačítka (záporné nahoru).
 */
const BULB = {
  centerY: -0.08,
  radius: 0.2,
  /** Hrdlo baňky mezi koulí a paticí. */
  neckWidth: 0.2,
  neckBottom: 0.14,
  symbolSize: 0.22,
} as const;

/** Patice: dva šedé proužky pod baňkou. */
const BASE = {
  width: 0.2,
  stripeHeight: 0.045,
  stripeGap: 0.02,
  top: 0.15,
} as const;

/** Paprsky: krátké čárky v horním oblouku kolem baňky. */
const RAYS = {
  anglesDegrees: [-150, -120, -90, -60, -30],
  innerRadius: 0.27,
  outerRadius: 0.35,
  lineWidth: 0.03,
} as const;

/** Jemný stín: o kolik CSS px jsou průhledné kruhy větší a posunuté dolů. */
const SHADOW_SPREADS = [3, 1.2];
const SHADOW_OFFSET = 2;

/**
 * Záře rozzářeného tlačítka (#155) ze soustředných kruhů, které ven
 * slábnou. Jak daleko sahá, počítá `hintGlowSpread` podle mezery
 * k ostatním plochám; velikost tlačítka se nemění.
 */
const GLOW_RINGS = 3;

/** Zhoupnutí po ťuknutí: úhel v jednom směru a doba jednoho kyvu. */
const SWING_ANGLE = 12;
const SWING_MS = 70;

/** Tlačítko nápovědy na místě, kde se pak ukážou tečky (#84). */
export interface HintButton {
  readonly container: Phaser.GameObjects.Container;
  /** Záře kolem tlačítka po 1. chybě (#155), jinak skrytá. */
  readonly glow: Phaser.GameObjects.Graphics;
  /** Šedý stín; když tlačítko září, schová se, aby okraj nebyl špinavý. */
  readonly shadow: Phaser.GameObjects.Graphics;
}

/**
 * Žlutá záře kolem kruhu do vzdálenosti `spread`: i vnější kruh je dobře
 * vidět, dovnitř se kruhy sčítají. Sílu mění průhlednost celé záře.
 */
function drawGlow(
  scene: Phaser.Scene,
  radius: number,
  spread: number,
): Phaser.GameObjects.Graphics {
  const glow = scene.add.graphics();
  for (let ring = GLOW_RINGS; ring >= 1; ring -= 1) {
    glow
      .fillStyle(colorNumber(HINT_BUTTON_STYLE.glowColor), HINT_BUTTON_STYLE.glowAlpha)
      .fillCircle(0, 0, radius + (spread * ring) / GLOW_RINGS);
  }
  return glow.setVisible(false);
}

/** Jemný stín pod kulatým tlačítkem o poloměru `radius`. */
function drawShadow(
  scene: Phaser.Scene,
  radius: number,
  detailScale: number,
): Phaser.GameObjects.Graphics {
  const shadow = scene.add.graphics();
  for (const spread of SHADOW_SPREADS) {
    shadow
      .fillStyle(0x000000, HINT_BUTTON_STYLE.shadowAlpha)
      .fillCircle(0, SHADOW_OFFSET * detailScale, radius + spread * detailScale);
  }
  return shadow;
}

/** Světle žlutý kruh se žlutým okrajem, okraj se kreslí dovnitř kruhu. */
function drawDisc(
  scene: Phaser.Scene,
  radius: number,
  detailScale: number,
): Phaser.GameObjects.Graphics {
  const borderWidth = HINT_BUTTON_STYLE.borderWidth * detailScale;
  return scene.add
    .graphics()
    .fillStyle(colorNumber(HINT_BUTTON_STYLE.background), 1)
    .fillCircle(0, 0, radius)
    .lineStyle(borderWidth, colorNumber(HINT_BUTTON_STYLE.borderColor), 1)
    .strokeCircle(0, 0, radius - borderWidth / 2);
}

/** Paprsky nad baňkou. */
function drawRays(scene: Phaser.Scene, size: number): Phaser.GameObjects.Graphics {
  const rays = scene.add
    .graphics()
    .lineStyle(RAYS.lineWidth * size, colorNumber(HINT_BUTTON_STYLE.rayColor), 1);
  const centerY = BULB.centerY * size;
  for (const degrees of RAYS.anglesDegrees) {
    const angle = (degrees * Math.PI) / 180;
    const inner = RAYS.innerRadius * size;
    const outer = RAYS.outerRadius * size;
    rays.lineBetween(
      Math.cos(angle) * inner,
      centerY + Math.sin(angle) * inner,
      Math.cos(angle) * outer,
      centerY + Math.sin(angle) * outer,
    );
  }
  return rays;
}

/** Žlutá baňka: koule a pod ní hrdlo až k patici. */
function drawBulb(scene: Phaser.Scene, size: number): Phaser.GameObjects.Graphics {
  const centerY = BULB.centerY * size;
  const neckWidth = BULB.neckWidth * size;
  return scene.add
    .graphics()
    .fillStyle(colorNumber(HINT_BUTTON_STYLE.bulbColor), 1)
    .fillCircle(0, centerY, BULB.radius * size)
    .fillRect(-neckWidth / 2, centerY, neckWidth, BULB.neckBottom * size - centerY);
}

/** Šedá patice ze dvou zaoblených proužků. */
function drawBase(scene: Phaser.Scene, size: number): Phaser.GameObjects.Graphics {
  const width = BASE.width * size;
  const stripeHeight = BASE.stripeHeight * size;
  const cornerRadius = stripeHeight / 2;
  const firstTop = BASE.top * size;
  const secondTop = firstTop + stripeHeight + BASE.stripeGap * size;
  return scene.add
    .graphics()
    .fillStyle(colorNumber(HINT_BUTTON_STYLE.baseColor), 1)
    .fillRoundedRect(-width / 2, firstTop, width, stripeHeight, cornerRadius)
    .fillRoundedRect(-width / 2, secondTop, width, stripeHeight, cornerRadius);
}

/** Malý tmavý otazník uprostřed baňky. */
function drawSymbol(scene: Phaser.Scene, size: number): Phaser.GameObjects.Text {
  return scene.add
    .text(0, BULB.centerY * size, HINT_SYMBOL, {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.round(size * BULB.symbolSize)}px`,
      fontStyle: String(HINT_BUTTON_STYLE.symbolFontWeight),
      color: HINT_BUTTON_STYLE.symbolColor,
    })
    .setOrigin(0.5);
}

/**
 * Nakreslí tlačítko nápovědy (varianta C): světle žlutý kruh se žlutým
 * okrajem a uvnitř žárovka s paprsky, šedou paticí a malým tmavým „?“.
 *
 * @param glowSpread Jak daleko sahá záře po 1. chybě (`hintGlowSpread`).
 * @param onPressed Prst se tlačítka dotkl (co to znamená, rozhoduje scéna).
 */
export function createHintButton(
  scene: Phaser.Scene,
  slot: ButtonSlot,
  detailScale: number,
  glowSpread: number,
  onPressed: () => void,
): HintButton {
  const { size } = slot;
  const radius = size / 2;
  const glow = drawGlow(scene, radius, glowSpread);
  const shadow = drawShadow(scene, radius, detailScale);
  const container = scene.add.container(slot.x, slot.y, [
    glow,
    shadow,
    drawDisc(scene, radius, detailScale),
    drawRays(scene, size),
    drawBulb(scene, size),
    drawBase(scene, size),
    drawSymbol(scene, size),
  ]);
  container.setSize(size, size).setInteractive();
  container.on('pointerdown', onPressed);
  return { container, glow, shadow };
}

/**
 * Síla záře kolem tlačítka (0 až 1, #155); `null` záři schová.
 * Tlačítko samo zůstává stejně velké.
 */
export function setHintButtonGlow(button: HintButton, glow: number | null): void {
  if (glow === null) {
    button.glow.setVisible(false);
    button.shadow.setVisible(true);
    return;
  }
  button.glow.setVisible(true).setAlpha(glow);
  button.shadow.setVisible(false);
}

/** Tlačítko se zhoupne na jednu stranu, na druhou a zpět a pak zavolá `onDone`. */
export function swingHintButton(scene: Phaser.Scene, button: HintButton, onDone: () => void): void {
  button.container.disableInteractive();
  scene.tweens.chain({
    targets: button.container,
    tweens: [
      { angle: SWING_ANGLE, duration: SWING_MS, ease: 'Sine.easeOut' },
      { angle: -SWING_ANGLE, duration: 2 * SWING_MS, ease: 'Sine.easeInOut' },
      { angle: 0, duration: SWING_MS, ease: 'Sine.easeIn' },
    ],
    onComplete: onDone,
  });
}
