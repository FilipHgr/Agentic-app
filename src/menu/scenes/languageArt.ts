import type Phaser from 'phaser';

import { FONT_FAMILY, colorNumber } from '../../shared/logic/theme';
import { languageFlagOf } from '../logic/languageFlags';
import type { LanguageFlag } from '../logic/languageFlags';
import { languageButtonParts, languageRowParts } from '../logic/menuLayout';
import type { MenuBox, MenuLanguagePanel } from '../logic/menuLayout';
import { MENU_STYLE } from '../logic/menuTheme';
import { languageFlagImage } from './languageFlagTextures';

/**
 * Kreslení tlačítka a nabídky jazyků (#70), společné pro menu a výběr
 * profilu (#72). Souřadnice jsou CSS px okna, `unit` je počet jednotek
 * plátna na CSS px. Ťuknutí řeší scéna, tady se jen kreslí.
 */

/** Symbol u aktuálního jazyka v nabídce (není to text jazyka). */
export const CHECK_SYMBOL = '✓';
const LANGUAGE_PANEL_RADIUS = 20;
const LANGUAGE_ROW_RADIUS = 14;
/** Jak daleko od karty nabídky sahá její stín (px). */
export const LANGUAGE_PANEL_SHADOW = 6;

export interface LanguageView {
  readonly code: string;
  readonly name: string;
  readonly selected: boolean;
}

export function sceneText(
  scene: Phaser.Scene,
  content: string,
  fontSizeCss: number,
  color: string,
  unit: number,
  fontStyle = 'normal',
): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, content, {
    fontFamily: FONT_FAMILY,
    fontSize: `${fontSizeCss * unit}px`,
    fontStyle,
    color,
  });
}

/**
 * Plné bílé kolečko se stínem, zkratkou jazyka a pod ní vlajkou (#138), se
 * středem v počátku kontejneru. Bez vlajky (jazyk bez vlajky nebo nenačtené
 * SVG) je zkratka uprostřed kolečka.
 */
export function languageButtonArt(
  scene: Phaser.Scene,
  box: MenuBox,
  label: string,
  flag: LanguageFlag | null,
  fontSize: number,
  unit: number,
): Phaser.GameObjects.GameObject[] {
  const radius = ((box.right - box.left) / 2) * unit;
  const circle = scene.add.graphics();
  for (const spread of [3, 1]) {
    circle
      .fillStyle(0x000000, MENU_STYLE.languageButtonShadowAlpha)
      .fillCircle(0, 1.5 * unit, radius + spread * unit);
  }
  circle.fillStyle(colorNumber(MENU_STYLE.languageButtonBackground), 1).fillCircle(0, 0, radius);
  const layout = languageButtonParts(box, fontSize);
  const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  const text = sceneText(scene, label, fontSize, MENU_STYLE.languageButtonText, unit).setOrigin(
    0.5,
  );
  const image = languageFlagImage(scene, flag, layout.flag, center, unit);
  if (image === null) {
    return [circle, text];
  }
  text.y = ((layout.code.top + layout.code.bottom) / 2 - center.y) * unit;
  return [circle, text, image];
}

/** Bílá karta nabídky jazyků se stínem, v souřadnicích plátna. */
export function languageCardArt(
  scene: Phaser.Scene,
  panel: MenuBox,
  unit: number,
): Phaser.GameObjects.Graphics {
  const width = (panel.right - panel.left) * unit;
  const height = (panel.bottom - panel.top) * unit;
  const radius = LANGUAGE_PANEL_RADIUS * unit;
  const card = scene.add.graphics({ x: panel.left * unit, y: panel.top * unit });
  for (const spread of [LANGUAGE_PANEL_SHADOW, LANGUAGE_PANEL_SHADOW / 2, 1]) {
    card
      .fillStyle(0x000000, MENU_STYLE.languagePanelShadowAlpha / 3)
      .fillRoundedRect(
        -spread * unit,
        -spread * unit + 2 * unit,
        width + 2 * spread * unit,
        height + 2 * spread * unit,
        radius + spread * unit,
      );
  }
  card
    .fillStyle(colorNumber(MENU_STYLE.languagePanelBackground), 1)
    .fillRoundedRect(0, 0, width, height, radius);
  return card;
}

/**
 * Řádek jazyka se středem v počátku kontejneru: vlajka (#138), vlastní název
 * jazyka a u aktuálního ✓ na modrém. Bez načtené vlajky zůstane její místo
 * prázdné a názvy jsou dál pod sebou.
 */
export function languageRowArt(
  scene: Phaser.Scene,
  panel: MenuLanguagePanel,
  row: MenuBox,
  language: LanguageView,
  unit: number,
): Phaser.GameObjects.GameObject[] {
  const width = (row.right - row.left) * unit;
  const height = (row.bottom - row.top) * unit;
  const color = language.selected ? MENU_STYLE.selectedLanguageText : MENU_STYLE.languageText;
  const layout = languageRowParts(panel, row);
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (language.selected) {
    const background = scene.add.graphics();
    background
      .fillStyle(colorNumber(MENU_STYLE.selectedLanguageBackground), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, LANGUAGE_ROW_RADIUS * unit);
    parts.push(background);
  }
  const name = sceneText(
    scene,
    language.name,
    panel.fontSize,
    color,
    unit,
    language.selected ? '600' : 'normal',
  ).setOrigin(0, 0.5);
  name.x = -width / 2 + (layout.name.left - row.left) * unit;
  const flag = languageFlagImage(
    scene,
    languageFlagOf(language.code),
    layout.flag,
    { x: (row.left + row.right) / 2, y: (row.top + row.bottom) / 2 },
    unit,
  );
  if (flag !== null) {
    parts.push(flag);
  }
  parts.push(name);
  if (language.selected) {
    const check = sceneText(scene, CHECK_SYMBOL, panel.fontSize + 3, color, unit, '600').setOrigin(
      1,
      0.5,
    );
    check.x = width / 2 - (row.right - layout.check.right) * unit;
    parts.push(check);
  }
  return parts;
}
