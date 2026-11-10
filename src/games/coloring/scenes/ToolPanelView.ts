/**
 * Vysouvací panel nástrojů (#96) se zástupným vzhledem A3: bílá karta se
 * stínem. Od #105 je ve dvou krocích se stejným rozměrem karty: hlavička,
 * čára a tělo. Krok nástrojů má v hlavičce čtyři tlačítka tloušťky (#112, #118,
 * vlnka tloušťky `lineSizeWave` v barvě vybraného nástroje) a v těle
 * štětec, gumu, fix, pastelku, duhu, razítkový, puntíkový a proužkový
 * fix, třpytky a sprej (`PANEL_TOOLS`, #90, #93, #97, #98, #101–#104).
 * Krok barev má v hlavičce vybraný nástroj a v těle 12 barev. Ikony
 * nástrojů jsou hotová SVG z Noto Emoji v barvách autora (#106). Barvu
 * nástroje ukazuje kolečko vpravo dole jako v úchytu (#110 AC2), v kroku
 * nástrojů u každého nástroje a v hlavičce kroku barev u vybraného.
 * Vybraný nástroj, barva i tloušťka mají silný modrý okraj. Kroky se
 * vystřídají prolnutím do 0,2 s, karta se přitom nehne.
 *
 * Panel vyjíždí zleva (na šířku) nebo zdola (na výšku) do 0,3 s a zajíždí
 * pod pruh ovládání; obrázek se přitom nehne, posouvá se jen panel.
 * Dotyky sem nechodí, rozhoduje o nich scéna přes `touchTargetAt`.
 */

import Phaser from 'phaser';

import { PAGE_BACKGROUND, colorNumber } from '../../../shared/logic/theme';
import { lineSizeWave, toolSlotColorDot, toolSlotIcon } from '../logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../logic/coloringLayout';
import { COLOR_BUTTON_STYLE, LINE_SIZE_WAVE_STYLE, TOOL_PANEL_STYLE } from '../logic/theme';
import type { HandleColorDotFill } from '../logic/toolIcons';
import { LINE_SIZES, PANEL_TOOLS, markedLineSizes } from '../logic/toolPanel';
import type { LineSize, LineSizeWaveLook, PanelView, ToolId } from '../logic/toolPanel';
import { PaletteView } from './PaletteView';
import { drawColorDot } from './colorDot';
import { showToolIcon } from './toolIconTextures';

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
 * Co je v panelu označené: barva, nástroj, tloušťka čáry a barva vlnek
 * na tlačítkách tloušťky (#112), vybraný nástroj v hlavičce kroku barev
 * a kolečko barvy každého nástroje v pořadí `PANEL_TOOLS` (#110).
 */
export interface PanelSelection {
  /** Barvy kroku barev v pořadí míst: sada nástroje, který by výběr dostal (#116). */
  readonly stepColors: readonly number[];
  /** U každého místa kroku barev, jestli je označené (nejvýš jedno, #116 AC5). */
  readonly markedColors: readonly boolean[];
  readonly markedTools: readonly boolean[];
  readonly lineSize: LineSize;
  readonly waveLook: LineSizeWaveLook;
  readonly selectedTool: ToolId;
  readonly toolColorDots: readonly HandleColorDotFill[];
}

/** Otevřený krok panelu. */
type PanelStep = Exclude<PanelView, 'closed'>;

/** Zhoupnutí jako u Zpět a dlaždic v menu: na jednu stranu, na druhou a zpět. */
const WOBBLE = { angle: 8, durationMs: 90 };

export class ToolPanelView {
  private container: Phaser.GameObjects.Container | null = null;
  /** Pozadí pruhu ovládání: panel pod něj zajíždí. */
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  /** Obsah kroku nástrojů (tlačítka tloušťky a nástroje) a kroku barev (vybraný nástroj a barvy). */
  private toolStep: Phaser.GameObjects.Container | null = null;
  private colorStep: Phaser.GameObjects.Container | null = null;
  /** Tlačítka nástrojů v pořadí `PANEL_TOOLS`, každé s počátkem ve středu svého místa. */
  private toolButtons: Phaser.GameObjects.Graphics[] = [];
  /** Ikony nástrojů nad tlačítky, ve stejném pořadí. */
  private toolIcons: Phaser.GameObjects.Image[] = [];
  /** Kolečka barvy nad ikonami, ve stejném pořadí a se stejným počátkem jako tlačítka. */
  private toolDots: Phaser.GameObjects.Graphics[] = [];
  /** Tlačítka tloušťky v pořadí `LINE_SIZES`, každé s počátkem ve středu svého místa. */
  private sizeButtons: Phaser.GameObjects.Graphics[] = [];
  /** Vybraný nástroj v hlavičce kroku barev, počátek ve středu místa. */
  private colorStepTool: Phaser.GameObjects.Graphics | null = null;
  private colorStepIcon: Phaser.GameObjects.Image | null = null;
  private colorStepDot: Phaser.GameObjects.Graphics | null = null;
  private readonly palette: PaletteView;
  private placement: PanelPlacement | null = null;
  private open = false;
  private step: PanelStep = 'tools';

  constructor(private readonly scene: Phaser.Scene) {
    this.palette = new PaletteView(scene);
  }

  /** Postaví panel podle rozložení (po startu a po otočení), hned v daném kroku. */
  place(placement: PanelPlacement, selection: PanelSelection, view: PanelView): void {
    this.destroy();
    this.placement = placement;
    const { layout, cssScale, depth } = placement;
    const container = this.scene.add.container(0, 0).setDepth(depth);
    container.add(this.drawCard(layout, cssScale));
    const toolStep = this.scene.add.container(0, 0);
    const colorStep = this.scene.add.container(0, 0);
    container.add([toolStep, colorStep]);
    this.toolButtons = layout.toolSlots
      .slice(0, PANEL_TOOLS.length)
      .map((slot) => this.addCentered(slot, toolStep));
    // Ikony až po tlačítkách, aby ležely nad nimi, a kolečka barvy nad ikonami.
    this.toolIcons = this.toolButtons.map(() => this.addIcon(toolStep));
    this.toolDots = layout.toolSlots
      .slice(0, PANEL_TOOLS.length)
      .map((slot) => this.addCentered(slot, toolStep));
    this.sizeButtons = layout.sizeButtons.map((button) => this.addCentered(button, toolStep));
    this.colorStepTool = this.addCentered(layout.colorStepTool, colorStep);
    this.colorStepIcon = this.addIcon(colorStep);
    this.colorStepDot = this.addCentered(layout.colorStepTool, colorStep);
    this.palette.place(
      layout.paletteColors,
      selection.stepColors,
      selection.markedColors,
      cssScale,
      colorStep,
    );
    this.container = container;
    this.toolStep = toolStep;
    this.colorStep = colorStep;
    this.mark(selection);
    this.backdrop = this.drawBackdrop(placement);
    this.open = view !== 'closed';
    this.showStep(view === 'colors' ? 'colors' : 'tools', false);
    this.jumpTo(this.open);
  }

  /** Označí vybranou barvu, nástroj a tloušťku; u nástrojů ukáže kolečko jejich barvy. */
  mark(selection: PanelSelection): void {
    this.palette.mark(selection.stepColors, selection.markedColors);
    this.showTools(selection);
    this.showSizes(selection);
    this.showColorStepTool(selection);
  }

  /**
   * Přepne panel na krok `view`: zavřený panel se vysune, otevřený zasune
   * a v otevřeném se kroky prolnou. Zavřený panel se otevře rovnou na
   * novém kroku bez prolnutí, panel se přitom vysouvá.
   */
  setView(view: PanelView): void {
    const open = view !== 'closed';
    if (open) {
      this.showStep(view, this.open);
    }
    this.setOpen(open);
  }

  /** Ťuknutí na tlačítko tloušťky: tlačítko se krátce zhoupne (#112 AC2). */
  wobbleLineSize(size: LineSize): void {
    this.wobble(this.sizeButtons[LINE_SIZES.indexOf(size)]);
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

  /** Grafika se středem místa `slot` jako počátkem (aby se točila kolem středu). */
  private addCentered(
    slot: LayoutRect,
    parent: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics({
      x: slot.left + slot.width / 2,
      y: slot.top + slot.height / 2,
    });
    parent.add(graphics);
    return graphics;
  }

  /** Obrázek ikony nástroje; texturu a místo dostane při označení výběru. */
  private addIcon(parent: Phaser.GameObjects.Container): Phaser.GameObjects.Image {
    const image = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    parent.add(image);
    return image;
  }

  /**
   * Ukáže krok `step`: s `animate` se kroky prolnou (do 0,2 s, #105 AC7),
   * jinak se vymění hned. Prolíná se jen průhlednost, nic se neposouvá.
   */
  private showStep(step: PanelStep, animate: boolean): void {
    const shown = step === 'tools' ? this.toolStep : this.colorStep;
    const hidden = step === 'tools' ? this.colorStep : this.toolStep;
    if (shown === null || hidden === null) {
      return;
    }
    const changed = step !== this.step;
    this.step = step;
    this.scene.tweens.killTweensOf([shown, hidden]);
    if (!animate || !changed) {
      shown.setAlpha(1).setVisible(true);
      hidden.setAlpha(0).setVisible(false);
      return;
    }
    shown.setVisible(true);
    const duration = TOOL_PANEL_STYLE.stepFadeMs;
    this.scene.tweens.add({ targets: shown, alpha: 1, duration, ease: 'Sine.easeOut' });
    this.scene.tweens.add({
      targets: hidden,
      alpha: 0,
      duration,
      ease: 'Sine.easeIn',
      onComplete: () => hidden.setVisible(false),
    });
  }

  /** Vysune, nebo zasune panel animací (nejvýš 0,3 s). */
  private setOpen(open: boolean): void {
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
    const animated = [...this.sizeButtons, this.toolStep, this.colorStep, this.container];
    for (const target of animated) {
      if (target !== null) {
        this.scene.tweens.killTweensOf(target);
      }
    }
    this.palette.destroy();
    this.container?.destroy();
    this.backdrop?.destroy();
    this.container = null;
    this.backdrop = null;
    this.toolStep = null;
    this.colorStep = null;
    this.toolButtons = [];
    this.toolIcons = [];
    this.toolDots = [];
    this.sizeButtons = [];
    this.colorStepTool = null;
    this.colorStepIcon = null;
    this.colorStepDot = null;
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

  /**
   * Překreslí tlačítka nástrojů: označený má silný okraj, ikony jsou
   * v barvách autora a vpravo dole je kolečko barvy nástroje (#110 AC2).
   */
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
      const icon = this.toolIcons[index];
      if (icon !== undefined) {
        showToolIcon(icon, tool, toolSlotIcon(slot), placement.cssScale);
      }
      const dot = this.toolDots[index];
      const fill = selection.toolColorDots[index];
      if (dot !== undefined && fill !== undefined) {
        showSlotColorDot(dot, slot, fill, placement.cssScale);
      }
    });
  }

  /**
   * Překreslí vybraný nástroj v hlavičce kroku barev: označený a s kolečkem
   * své barvy stejně jako v kroku nástrojů (#105 AC2, AC7, #110 AC2).
   */
  private showColorStepTool(selection: PanelSelection): void {
    const graphics = this.colorStepTool;
    const icon = this.colorStepIcon;
    const dot = this.colorStepDot;
    const placement = this.placement;
    if (graphics === null || icon === null || dot === null || placement === null) {
      return;
    }
    const slot = placement.layout.colorStepTool;
    graphics.clear();
    drawToolButton(graphics, slot, placement.cssScale, true);
    showToolIcon(icon, selection.selectedTool, toolSlotIcon(slot), placement.cssScale);
    const fill = selection.toolColorDots[PANEL_TOOLS.indexOf(selection.selectedTool)];
    if (fill === undefined) {
      dot.clear();
    } else {
      showSlotColorDot(dot, slot, fill, placement.cssScale);
    }
  }

  /**
   * Překreslí tlačítka tloušťky (#112 AC1): tlačítko A3, vybraná tloušťka
   * se silným modrým okrajem jako vybraný nástroj a uprostřed vlnka své
   * tloušťky v barvě vybraného nástroje.
   */
  private showSizes(selection: PanelSelection): void {
    const placement = this.placement;
    if (placement === null) {
      return;
    }
    const marked = markedLineSizes(selection.lineSize);
    this.sizeButtons.forEach((graphics, index) => {
      const button = placement.layout.sizeButtons[index];
      const size = LINE_SIZES[index];
      if (button === undefined || size === undefined) {
        return;
      }
      graphics.clear();
      drawToolButton(graphics, button, placement.cssScale, marked[index] === true);
      // `lineSizeWave` počítá v herních jednotkách; grafika má počátek ve středu tlačítka.
      const centered = { ...button, left: -button.width / 2, top: -button.height / 2 };
      drawWave(graphics, centered, size, selection.waveLook, placement.cssScale);
    });
  }

  /** Karta panelu se stínem a čárou mezi hlavičkou a tělem. */
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
 * Kolečko barvy nástroje vpravo dole v místě `slot`; grafika má počátek
 * ve středu místa.
 */
function showSlotColorDot(
  graphics: Phaser.GameObjects.Graphics,
  slot: LayoutRect,
  fill: HandleColorDotFill,
  cssScale: number,
): void {
  graphics.clear();
  const centered = { ...slot, left: -slot.width / 2, top: -slot.height / 2 };
  drawColorDot(graphics, toolSlotColorDot(centered), fill, cssScale);
}

/**
 * Vlnka tloušťky `size` v tlačítku `button` (#112 AC1, AC3): čára
 * s kulatými konci a spoji (kolečko v každém bodě); u barvy se slabým
 * kontrastem nejdřív tmavý obrys, přes něj stejná vlnka v barvě.
 */
function drawWave(
  graphics: Phaser.GameObjects.Graphics,
  button: LayoutRect,
  size: LineSize,
  look: LineSizeWaveLook,
  cssScale: number,
): void {
  const wave = lineSizeWave(button, size);
  if (look.outlined) {
    const outline = LINE_SIZE_WAVE_STYLE.outlineWidthCss / cssScale;
    strokeRoundLine(
      graphics,
      wave.points,
      wave.lineWidth + 2 * outline,
      LINE_SIZE_WAVE_STYLE.outlineColor,
    );
  }
  strokeRoundLine(graphics, wave.points, wave.lineWidth, look.color);
}

/** Lomená čára tloušťky `width` s kulatými konci i spoji. */
function strokeRoundLine(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly { readonly x: number; readonly y: number }[],
  width: number,
  color: string,
): void {
  const fill = colorNumber(color);
  graphics.lineStyle(width, fill, 1);
  graphics.strokePoints(
    points.map((point) => new Phaser.Math.Vector2(point.x, point.y)),
    false,
    false,
  );
  graphics.fillStyle(fill, 1);
  for (const point of points) {
    graphics.fillCircle(point.x, point.y, width / 2);
  }
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
