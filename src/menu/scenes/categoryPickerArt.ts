import type Phaser from 'phaser';

import { colorNumber } from '../../shared/logic/theme';
import type { MenuCategoryButton, MenuCategoryView } from '../logic/menu';
import type { MenuBox, MenuCategoryPicker } from '../logic/menuLayout';
import { MENU_STYLE } from '../logic/menuTheme';
import { CHECK_SYMBOL, sceneText } from './languageArt';

/**
 * Kreslení výběru kategorie na telefonu na výšku (#95) podle obrázků
 * D1–D2: tlačítko se symbolem v rámečku, názvem a šipkou a řádky seznamu.
 * Souřadnice jsou CSS px okna, `unit` je počet jednotek plátna na CSS px.
 * Všechno se kreslí se středem v počátku kontejneru. Ťuknutí řeší logika
 * dotyků, tady se jen kreslí.
 */

const BUTTON_RADIUS = 18;
const ROW_RADIUS = 14;
const SYMBOL_BOX_RADIUS = 12;
/** Světle modrý okraj otevřeného výběru (px). */
const OPEN_BORDER_WIDTH = 2;

/** Vodorovné polohy obsahu tlačítka nebo řádku vůči jeho středu (v CSS px). */
interface ContentColumns {
  readonly symbolCenter: number;
  readonly titleLeft: number;
  /** Kolik místa má název, než narazí na šipku nebo ✓. */
  readonly titleWidth: number;
  readonly markCenter: number;
}

/** Kde je symbol, název a šipka nebo ✓ v ploše široké `width` s místem `markSlot` vpravo. */
function contentColumns(
  picker: MenuCategoryPicker,
  width: number,
  markSlot: number,
): ContentColumns {
  const left = -width / 2 + picker.textInset;
  const right = width / 2 - picker.textInset;
  const titleLeft = left + picker.symbolWidth;
  const markLeft = right - markSlot + picker.contentGap;
  return {
    symbolCenter: left + picker.symbolBoxWidth / 2,
    titleLeft,
    titleWidth: markLeft - picker.contentGap - titleLeft,
    markCenter: markLeft + picker.markWidth / 2,
  };
}

/** Symbol kategorie ve světle modrém (u vybraného řádku bílém) rámečku. */
function symbolArt(
  scene: Phaser.Scene,
  picker: MenuCategoryPicker,
  symbol: string,
  centerX: number,
  background: string,
  unit: number,
): Phaser.GameObjects.GameObject[] {
  const width = picker.symbolBoxWidth * unit;
  const height = picker.symbolBoxHeight * unit;
  const box = scene.add.graphics();
  box
    .fillStyle(colorNumber(background), 1)
    .fillRoundedRect(
      centerX * unit - width / 2,
      -height / 2,
      width,
      height,
      SYMBOL_BOX_RADIUS * unit,
    );
  const text = sceneText(
    scene,
    symbol,
    picker.symbolFontSize,
    MENU_STYLE.pickerSymbol,
    unit,
    '600',
  ).setOrigin(0.5);
  text.x = centerX * unit;
  return [box, text];
}

/**
 * Název kategorie od `left`. Odhad šířky (#65) počítá 0,6 písma na znak,
 * skutečné písmo může být širší: název, který se nevejde, se zmenší.
 */
function titleArt(
  scene: Phaser.Scene,
  title: string,
  fontSize: number,
  color: string,
  columns: ContentColumns,
  unit: number,
  fontStyle: string,
): Phaser.GameObjects.Text {
  const text = sceneText(scene, title, fontSize, color, unit, fontStyle).setOrigin(0, 0.5);
  text.x = columns.titleLeft * unit;
  const available = columns.titleWidth * unit;
  if (text.width > available) {
    text.setScale(available / text.width);
  }
  return text;
}

/** Bílé tlačítko výběru se stínem, otevřené se světle modrým okrajem (obrázky D1, D2). */
export function categoryButtonArt(
  scene: Phaser.Scene,
  picker: MenuCategoryPicker,
  button: MenuCategoryButton,
  open: boolean,
  unit: number,
): Phaser.GameObjects.GameObject[] {
  const drawn: MenuBox = picker.buttonDrawn;
  const widthCss = drawn.right - drawn.left;
  const width = widthCss * unit;
  const height = (drawn.bottom - drawn.top) * unit;
  const radius = BUTTON_RADIUS * unit;
  const background = scene.add.graphics();
  for (const spread of [3, 1]) {
    background
      .fillStyle(0x000000, MENU_STYLE.pickerShadowAlpha)
      .fillRoundedRect(
        -width / 2 - spread * unit,
        -height / 2 - spread * unit + 1.5 * unit,
        width + 2 * spread * unit,
        height + 2 * spread * unit,
        radius + spread * unit,
      );
  }
  if (open) {
    const border = OPEN_BORDER_WIDTH * unit;
    background
      .fillStyle(colorNumber(MENU_STYLE.pickerOpenBorder), 1)
      .fillRoundedRect(
        -width / 2 - border,
        -height / 2 - border,
        width + 2 * border,
        height + 2 * border,
        radius + border,
      );
  }
  background
    .fillStyle(colorNumber(MENU_STYLE.pickerBackground), 1)
    .fillRoundedRect(-width / 2, -height / 2, width, height, radius);

  const columns = contentColumns(picker, widthCss, picker.arrowWidth);
  const arrow = sceneText(
    scene,
    button.arrow,
    picker.arrowFontSize,
    MENU_STYLE.pickerArrow,
    unit,
  ).setOrigin(0.5);
  arrow.x = columns.markCenter * unit;
  return [
    background,
    ...symbolArt(
      scene,
      picker,
      button.symbol,
      columns.symbolCenter,
      MENU_STYLE.pickerSymbolBackground,
      unit,
    ),
    titleArt(scene, button.title, picker.fontSize, MENU_STYLE.pickerText, columns, unit, '600'),
    arrow,
  ];
}

/** Řádek kategorie v seznamu: symbol, název a u vybrané ✓ na světle modrém (obrázek D2). */
export function categoryRowArt(
  scene: Phaser.Scene,
  picker: MenuCategoryPicker,
  row: MenuBox,
  category: MenuCategoryView,
  unit: number,
): Phaser.GameObjects.GameObject[] {
  const widthCss = row.right - row.left;
  const width = widthCss * unit;
  const height = (row.bottom - row.top) * unit;
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (category.selected) {
    const background = scene.add.graphics();
    background
      .fillStyle(colorNumber(MENU_STYLE.selectedPickerRowBackground), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, ROW_RADIUS * unit);
    parts.push(background);
  }
  const columns = contentColumns(picker, widthCss, picker.checkWidth);
  const symbolBackground = category.selected
    ? MENU_STYLE.selectedPickerSymbolBackground
    : MENU_STYLE.pickerSymbolBackground;
  parts.push(
    ...symbolArt(scene, picker, category.symbol, columns.symbolCenter, symbolBackground, unit),
  );
  const color = category.selected ? MENU_STYLE.selectedPickerRowText : MENU_STYLE.pickerText;
  const fontStyle = category.selected ? '700' : 'normal';
  parts.push(titleArt(scene, category.title, picker.fontSize, color, columns, unit, fontStyle));
  if (category.selected) {
    const check = sceneText(scene, CHECK_SYMBOL, picker.fontSize + 3, color, unit, '700').setOrigin(
      0.5,
    );
    check.x = columns.markCenter * unit;
    parts.push(check);
  }
  return parts;
}
