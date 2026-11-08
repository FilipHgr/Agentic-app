/**
 * Vysouvací panel nástrojů (#96) se zástupným vzhledem A3: bílá karta se
 * stínem, v ní oddíl barev a oddíl nástrojů s přepínačem velikosti.
 * Místa pro nehotové položky jsou prázdná, na prvních místech nástrojů
 * jsou štětec, guma, fix, pastelka, duha, razítkový a puntíkový fix
 * (`PANEL_TOOLS`, #90, #93, #97, #98, #101), vybraný má
 * silný modrý okraj. Přepínač velikosti (#91) je tlačítko s tmavou tečkou
 * vybrané velikosti (`sizeToggleDot`). Panel vyjíždí zleva (na šířku)
 * nebo zdola (na výšku) do 0,3 s a zajíždí pod pruh ovládání; obrázek se přitom nehne, posouvá se jen
 * panel. Dotyky sem nechodí, rozhoduje o nich scéna přes `touchTargetAt`.
 */

import Phaser from 'phaser';

import { PAGE_BACKGROUND, colorNumber } from '../../../shared/logic/theme';
import { sizeToggleDot } from '../logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../logic/coloringLayout';
import { COLOR_BUTTON_STYLE, SIZE_DOT_STYLE, TOOL_PANEL_STYLE } from '../logic/theme';
import { PANEL_TOOLS } from '../logic/toolPanel';
import type { LineSize } from '../logic/toolPanel';
import { drawEmptySlot } from './emptySlot';
import { PaletteView } from './PaletteView';
import { drawToolIcon } from './toolIcon';

/** Kde a jak velký panel je: rozložení, CSS px na jednotku a velikost herní plochy. */
export interface PanelPlacement {
  readonly layout: ColoringLayout;
  readonly cssScale: number;
  readonly areaWidth: number;
  readonly areaHeight: number;
  /** Hloubka panelu; pruh ovládání má být výš než `depth + 1`. */
  readonly depth: number;
}

/**
 * Co je v panelu označené: barva, nástroj, barva malovacích nástrojů
 * (`null` bez barvy) a velikost čáry v přepínači.
 */
export interface PanelSelection {
  readonly markedColors: readonly boolean[];
  readonly markedTools: readonly boolean[];
  readonly paintHex: string | null;
  readonly lineSize: LineSize;
}

/** Symbol nástroje zabere tento díl strany místa. */
const TOOL_ICON_SHARE = 0.62;

/** Zhoupnutí jako u Zpět a dlaždic v menu: na jednu stranu, na druhou a zpět. */
const WOBBLE = { angle: 8, durationMs: 90 };

export class ToolPanelView {
  private container: Phaser.GameObjects.Container | null = null;
  /** Pozadí pruhu ovládání: panel pod něj zajíždí. */
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  /** Tlačítka nástrojů v pořadí `PANEL_TOOLS`, každé s počátkem ve středu svého místa. */
  private toolButtons: Phaser.GameObjects.Graphics[] = [];
  /** Přepínač velikosti s počátkem ve středu svého místa. */
  private sizeToggle: Phaser.GameObjects.Graphics | null = null;
  private readonly palette: PaletteView;
  private placement: PanelPlacement | null = null;
  private open = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.palette = new PaletteView(scene);
  }

  /** Postaví panel podle rozložení (po startu a po otočení), hned v daném stavu. */
  place(placement: PanelPlacement, selection: PanelSelection, open: boolean): void {
    this.destroy();
    this.placement = placement;
    this.open = open;
    const { layout, cssScale, depth } = placement;
    const container = this.scene.add.container(0, 0).setDepth(depth);
    container.add(this.drawCard(layout, cssScale));
    this.palette.place(layout.paletteColors, selection.markedColors, cssScale, container);
    layout.toolSlots.forEach((slot, index) => {
      // Střed místa je počátek, aby se nástroj při zhoupnutí točil kolem středu.
      const graphics = this.scene.add.graphics({
        x: slot.left + slot.width / 2,
        y: slot.top + slot.height / 2,
      });
      container.add(graphics);
      if (index < PANEL_TOOLS.length) {
        this.toolButtons.push(graphics);
      } else {
        drawEmptySlot(graphics, slot, cssScale, -slot.width / 2, -slot.height / 2);
      }
    });
    const toggle = this.scene.add.graphics({
      x: layout.sizeToggle.left + layout.sizeToggle.width / 2,
      y: layout.sizeToggle.top + layout.sizeToggle.height / 2,
    });
    container.add(toggle);
    this.sizeToggle = toggle;
    this.container = container;
    this.showTools(selection);
    this.showSize(selection.lineSize);
    this.backdrop = this.drawBackdrop(placement);
    this.jumpTo(open);
  }

  /** Označí vybranou barvu, nástroj a velikost; malovací nástroje ukáže ve vybrané barvě. */
  mark(selection: PanelSelection): void {
    this.palette.mark(selection.markedColors);
    this.showTools(selection);
    this.showSize(selection.lineSize);
  }

  /** Ťuknutí na nástroj, který už je vybraný: nástroj se zhoupne kolem středu svého místa. */
  wobbleTool(index: number): void {
    this.wobble(this.toolButtons[index]);
  }

  /** Ťuknutí na přepínač velikosti: přepínač se krátce zhoupne (#91 AC1). */
  wobbleSizeToggle(): void {
    this.wobble(this.sizeToggle ?? undefined);
  }

  /** Zhoupnutí kolem středu: na jednu stranu, na druhou a zpět. */
  private wobble(graphics: Phaser.GameObjects.Graphics | undefined): void {
    if (graphics === undefined) {
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

  /** Vysune, nebo zasune panel animací (nejvýš 0,3 s). */
  setOpen(open: boolean): void {
    const container = this.container;
    if (container === null || open === this.open) {
      return;
    }
    this.open = open;
    const hidden = this.hiddenOffset();
    this.scene.tweens.killTweensOf(container);
    container.setVisible(true);
    this.scene.tweens.add({
      targets: container,
      x: open ? 0 : hidden.x,
      y: open ? 0 : hidden.y,
      duration: TOOL_PANEL_STYLE.slideMs,
      ease: open ? 'Cubic.easeOut' : 'Cubic.easeIn',
      onComplete: () => container.setVisible(this.open),
    });
  }

  destroy(): void {
    for (const button of [...this.toolButtons, this.sizeToggle]) {
      if (button !== null) {
        this.scene.tweens.killTweensOf(button);
      }
    }
    if (this.container !== null) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy();
    }
    this.palette.destroy();
    this.backdrop?.destroy();
    this.container = null;
    this.backdrop = null;
    this.toolButtons = [];
    this.sizeToggle = null;
  }

  /** Okamžitě bez animace (po otočení obrazovky). */
  private jumpTo(open: boolean): void {
    const hidden = this.hiddenOffset();
    this.container?.setPosition(open ? 0 : hidden.x, open ? 0 : hidden.y).setVisible(open);
  }

  /** Posun zasunutého panelu: celý vlevo za okrajem, nebo dole pod okrajem. */
  private hiddenOffset(): { x: number; y: number } {
    if (this.placement === null) {
      return { x: 0, y: 0 };
    }
    const { layout, cssScale, areaHeight } = this.placement;
    const shadow = shadowReachOf(cssScale);
    const { panel } = layout;
    return layout.panelSlidesFrom === 'left'
      ? { x: -(panel.left + panel.width + shadow), y: 0 }
      : { x: 0, y: areaHeight - panel.top + shadow };
  }

  /** Překreslí tlačítka nástrojů: označený má silný okraj, malovací nástroje jsou ve vybrané barvě. */
  private showTools(selection: PanelSelection): void {
    const placement = this.placement;
    if (placement === null) {
      return;
    }
    this.toolButtons.forEach((graphics, index) => {
      const slot = placement.layout.toolSlots[index];
      const tool = PANEL_TOOLS[index];
      if (slot === undefined || tool === undefined) {
        return;
      }
      graphics.clear();
      drawToolButton(graphics, slot, placement.cssScale, selection.markedTools[index] === true);
      const size = Math.min(slot.width, slot.height) * TOOL_ICON_SHARE;
      drawToolIcon(graphics, tool, 0, 0, size, selection.paintHex);
    });
  }

  /** Překreslí přepínač velikosti: tlačítko A3 a tmavá tečka velikosti `size` (#91 AC1). */
  private showSize(size: LineSize): void {
    const graphics = this.sizeToggle;
    const placement = this.placement;
    if (graphics === null || placement === null) {
      return;
    }
    const toggle = placement.layout.sizeToggle;
    graphics.clear();
    drawToolButton(graphics, toggle, placement.cssScale, false);
    // `sizeToggleDot` počítá v herních jednotkách; grafika má počátek ve středu přepínače.
    const dot = sizeToggleDot(
      { ...toggle, left: -toggle.width / 2, top: -toggle.height / 2 },
      size,
    );
    graphics.fillStyle(colorNumber(SIZE_DOT_STYLE.color), 1);
    graphics.fillCircle(dot.centerX, dot.centerY, dot.diameter / 2);
  }

  /** Karta panelu se stínem a čárou mezi oddíly. */
  private drawCard(layout: ColoringLayout, cssScale: number): Phaser.GameObjects.Graphics {
    const style = TOOL_PANEL_STYLE;
    const { panel, panelDivider } = layout;
    const card = this.scene.add.graphics();
    const radius = Math.min(style.cornerRadiusCss / cssScale, panel.width / 4, panel.height / 4);
    const spread = style.shadowSpreadCss / cssScale;
    const offset = style.shadowOffsetCss / cssScale;
    for (let layer = style.shadowLayers; layer >= 1; layer -= 1) {
      const grow = layer * spread;
      card.fillStyle(colorNumber(style.shadowColor), style.shadowAlpha);
      card.fillRoundedRect(
        panel.left - grow,
        panel.top - grow + offset,
        panel.width + 2 * grow,
        panel.height + 2 * grow,
        radius + grow,
      );
    }
    card.fillStyle(colorNumber(style.background), 1);
    card.fillRoundedRect(panel.left, panel.top, panel.width, panel.height, radius);
    card.fillStyle(colorNumber(style.dividerColor), 1);
    card.fillRect(panelDivider.left, panelDivider.top, panelDivider.width, panelDivider.height);
    return card;
  }

  /** Pozadí stránky přes pruh ovládání, pod které panel zajíždí. */
  private drawBackdrop(placement: PanelPlacement): Phaser.GameObjects.Rectangle {
    const { layout, areaWidth, areaHeight, depth } = placement;
    const { panel } = layout;
    const box: LayoutRect =
      layout.panelSlidesFrom === 'left'
        ? { left: 0, top: 0, width: panel.left, height: areaHeight }
        : {
            left: 0,
            top: panel.top + panel.height,
            width: areaWidth,
            height: areaHeight - panel.top - panel.height,
          };
    return this.scene.add
      .rectangle(box.left, box.top, box.width, box.height, colorNumber(PAGE_BACKGROUND))
      .setOrigin(0, 0)
      .setDepth(depth + 1);
  }
}

/** Jak daleko za kartu sahá stín. */
function shadowReachOf(cssScale: number): number {
  const style = TOOL_PANEL_STYLE;
  return (style.shadowLayers * style.shadowSpreadCss + style.shadowOffsetCss) / cssScale;
}

/**
 * Tlačítko nástroje se středem v počátku ve vzhledu A3 jako tlačítko barvy;
 * vybraný nástroj má silný modrý okraj.
 */
function drawToolButton(
  graphics: Phaser.GameObjects.Graphics,
  slot: LayoutRect,
  cssScale: number,
  isMarked: boolean,
): void {
  const style = COLOR_BUTTON_STYLE;
  const borderWidth = (isMarked ? style.selectedBorderWidthCss : style.borderWidthCss) / cssScale;
  const borderColor = isMarked ? style.selectedBorderColor : style.borderColor;
  const radius = Math.min(slot.width, slot.height) * style.cornerRadiusShare;
  const inset = borderWidth / 2;
  const left = -slot.width / 2;
  const top = -slot.height / 2;
  graphics.fillStyle(colorNumber(style.background), 1);
  graphics.fillRoundedRect(left, top, slot.width, slot.height, radius);
  graphics.lineStyle(borderWidth, colorNumber(borderColor), 1);
  graphics.strokeRoundedRect(
    left + inset,
    top + inset,
    slot.width - borderWidth,
    slot.height - borderWidth,
    Math.max(0, radius - inset),
  );
}
