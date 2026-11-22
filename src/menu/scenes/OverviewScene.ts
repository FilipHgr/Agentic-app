import Phaser from 'phaser';

import { isSharedAudioUnlocked, sharedToneContext } from '../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../shared/audio/tonePlayer';
import { colorNumber } from '../../shared/logic/theme';
import type { Language } from '../../shared/texts/languages';
import type { MenuProfileBadge } from '../logic/menu';
import type { MenuBox } from '../logic/menuLayout';
import { MENU_SOUNDS } from '../logic/menuSounds';
import { MENU_STYLE, OVERVIEW_STYLE } from '../logic/menuTheme';
import { LEGEND_TEXT_GAP, overviewBars, overviewTargetAt } from '../logic/overviewLayout';
import type {
  OverviewLegendEntry,
  OverviewScreenLayout,
  OverviewTab,
  OverviewText,
} from '../logic/overviewLayout';
import { mistakeSections, weekLines } from '../logic/overviewLines';
import type { OverviewFeedback, ParentOverview } from '../logic/parentOverview';
import type { OverviewTexts } from '../texts/menuTextsTypes';
import { sceneText } from './languageArt';
import { MENU_UNITS_PER_CSS_PX } from './MenuScene';

/** Klíč scény přehledu pro rodiče ve hře Phaseru menu. */
export const OVERVIEW_SCENE_KEY = 'overview';

const UNIT = MENU_UNITS_PER_CSS_PX;
const PRESS = { scale: 0.94, durationMs: 70 };
const WOBBLE = { angle: 2.5, durationMs: 90 };
/** Barevné kolečko profilu je 48 px v bílém kolečku 64 px, jako v liště menu (#71). */
const PROFILE_COLOR_INSET = 8;

export interface OverviewSceneHost {
  readonly overview: ParentOverview;
  /** Rozložení pro současné okno a vybranou hru. */
  layout(): OverviewScreenLayout;
  /** Kolečko aktivního profilu jako v menu. */
  profileBadge(): MenuProfileBadge;
  texts(): OverviewTexts;
  /** Jazyk menu pro procenta („75 %“). */
  language(): Language;
  /** Scéna se vytvořila; stránka nechá vidět jen ji, nebo jen menu. */
  onCreated(): void;
}

/** Kontejner, který se dá zmáčknout nebo zhoupnout. */
interface Tappable {
  readonly container: Phaser.GameObjects.Container;
}

/**
 * Přehled pro rodiče v menu (#192): Zpět, kolečko profilu, záložky her
 * a stránek a stránka 7 dní (graf ze sloupečků Phaseru) nebo Chyby
 * (řádky). Rozměry jsou v `overviewLayout.ts` v CSS px okna, plátno má
 * `MENU_UNITS_PER_CSS_PX` jednotek na CSS px. Ťuknutí platí, když prst
 * dosedne i zvedne se na stejné ťukací ploše; pak ho předá logice
 * přehledu (`parentOverview.ts`) a zahraje odezvu, kterou ohlásí.
 */
export class OverviewScene extends Phaser.Scene {
  private readonly sounds = createTonePlayer(sharedToneContext);
  private drawn: Phaser.GameObjects.GameObject[] = [];
  private layout: OverviewScreenLayout | undefined;
  private back: Tappable | undefined;
  private gameTabs: Tappable[] = [];
  private pageTabs: Tappable[] = [];
  private redrawWanted = false;
  /** Na co prst dosedl; ťuknutí platí jen se zvednutím na stejném místě. */
  private downTarget: string | undefined;

  constructor(private readonly host: OverviewSceneHost) {
    // Běží od startu stránky jako výběr profilu; stránka ji hned uspí (`showOnlyScene`).
    super({ key: OVERVIEW_SCENE_KEY, active: true });
  }

  create(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.downTarget = this.targetKey(pointer);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      const down = this.downTarget;
      this.downTarget = undefined;
      if (pointer.wasCanceled || down === undefined || down !== this.targetKey(pointer)) {
        return;
      }
      this.tap(pointer);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.redraw();
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.host.onCreated());
  }

  override update(): void {
    if (this.redrawWanted) {
      this.redrawWanted = false;
      this.redraw();
    }
  }

  /** Přehled se nakreslí znovu v dalším snímku (otevření, jiná záložka, otočení). */
  requestRedraw(): void {
    this.redrawWanted = true;
  }

  /** Odezva logiky přehledu: tón a zmáčknutí nebo zhoupnutí. */
  play(event: OverviewFeedback): void {
    switch (event.kind) {
      case 'select':
        this.playSound('select');
        this.requestRedraw();
        break;
      case 'wobble':
        this.playSound('wobble');
        this.wobble(
          event.target === 'game' ? this.gameTabs[event.index] : this.pageTabs[event.index],
        );
        break;
      case 'back':
        this.playSound('press');
        break;
    }
  }

  private playSound(name: keyof typeof MENU_SOUNDS): void {
    // Zvuk jen odemčený (menu ho odemklo prvním ťuknutím), jinak potichu.
    if (isSharedAudioUnlocked()) {
      this.sounds.play(MENU_SOUNDS[name]);
    }
  }

  private pointOf(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: pointer.x / UNIT, y: pointer.y / UNIT };
  }

  private targetKey(pointer: Phaser.Input.Pointer): string | undefined {
    const layout = this.layout;
    if (layout === undefined) {
      return undefined;
    }
    const target = overviewTargetAt(layout, this.pointOf(pointer));
    return target === undefined ? undefined : JSON.stringify(target);
  }

  private tap(pointer: Phaser.Input.Pointer): void {
    const layout = this.layout;
    const target =
      layout === undefined ? undefined : overviewTargetAt(layout, this.pointOf(pointer));
    if (target === undefined) {
      return;
    }
    const { overview } = this.host;
    switch (target.kind) {
      case 'back':
        this.press(this.back);
        overview.tapBack();
        break;
      case 'game':
        overview.tapGame(target.index);
        break;
      case 'page':
        overview.tapPage(target.page);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Kreslení
  // ---------------------------------------------------------------------------

  private redraw(): void {
    for (const object of this.drawn) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.drawn = [];
    this.gameTabs = [];
    this.pageTabs = [];
    const layout = this.host.layout();
    this.layout = layout;
    const texts = this.host.texts();
    this.back = this.drawBack(layout, texts.back);
    this.drawProfile(layout);
    if (layout.title !== null) {
      this.addText(layout.title, texts.title, OVERVIEW_STYLE.title, 'bold');
    }
    this.host.overview.games().forEach((game, index) => {
      const tab = layout.gameTabs[index];
      if (tab !== undefined) {
        this.gameTabs.push(this.drawTab(tab, game.title, game.selected, layout.tabFontSize));
      }
    });
    const page = this.host.overview.page();
    const [weekTab, mistakesTab] = layout.pageTabs;
    this.pageTabs.push(this.drawTab(weekTab, texts.weekTab, page === 'week', layout.tabFontSize));
    this.pageTabs.push(
      this.drawTab(mistakesTab, texts.mistakesTab, page === 'mistakes', layout.tabFontSize),
    );
    if (page === 'week') {
      this.drawWeek(layout, texts);
    } else {
      this.drawMistakes(layout, texts);
    }
  }

  /** Kontejner uprostřed obdélníku v CSS px. */
  private containerAt(box: MenuBox): Phaser.GameObjects.Container {
    const container = this.add.container(
      ((box.left + box.right) / 2) * UNIT,
      ((box.top + box.bottom) / 2) * UNIT,
    );
    this.drawn.push(container);
    return container;
  }

  private addText(
    slot: OverviewText,
    content: string,
    color: string,
    fontStyle = 'normal',
  ): Phaser.GameObjects.Text {
    const label = sceneText(this, content, slot.fontSize, color, UNIT, fontStyle);
    const y = ((slot.box.top + slot.box.bottom) / 2) * UNIT;
    if (slot.align === 'left') {
      label.setOrigin(0, 0.5).setPosition((slot.box.left + (slot.inset ?? 0)) * UNIT, y);
    } else {
      label.setOrigin(0.5).setPosition(((slot.box.left + slot.box.right) / 2) * UNIT, y);
    }
    this.drawn.push(label);
    return label;
  }

  private addRect(box: MenuBox, color: string): void {
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    if (width <= 0 || height <= 0) {
      return;
    }
    const rect = this.add.rectangle(
      ((box.left + box.right) / 2) * UNIT,
      ((box.top + box.bottom) / 2) * UNIT,
      width * UNIT,
      height * UNIT,
      colorNumber(color),
    );
    this.drawn.push(rect);
  }

  /** Zpět: světle modré tlačítko s okrajem a modrým tučným textem (A3). */
  private drawBack(layout: OverviewScreenLayout, label: string): Tappable {
    const box = layout.back;
    const container = this.containerAt(box);
    const width = (box.right - box.left) * UNIT;
    const height = (box.bottom - box.top) * UNIT;
    const border = 2 * UNIT;
    const radius = 18 * UNIT;
    const background = this.add
      .graphics()
      .fillStyle(colorNumber(OVERVIEW_STYLE.backBackground), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
      .lineStyle(border, colorNumber(OVERVIEW_STYLE.backBorder), 1)
      .strokeRoundedRect(
        -width / 2 + border / 2,
        -height / 2 + border / 2,
        width - border,
        height - border,
        radius - border / 2,
      );
    const text = sceneText(
      this,
      label,
      layout.buttonFontSize,
      OVERVIEW_STYLE.backText,
      UNIT,
      'bold',
    ).setOrigin(0.5);
    container.add([background, text]);
    return { container };
  }

  /** Kolečko aktivního profilu v jeho barvě s písmenem, jako v menu (neťuká se). */
  private drawProfile(layout: OverviewScreenLayout): void {
    const badge = this.host.profileBadge();
    const container = this.containerAt(layout.profile);
    const outer = ((layout.profile.right - layout.profile.left) / 2) * UNIT;
    // Bílé kolečko se stínem a uvnitř barva profilu, jako kolečko v liště menu.
    const circle = this.add.graphics();
    for (const spread of [3, 1]) {
      circle
        .fillStyle(0x000000, MENU_STYLE.languageButtonShadowAlpha)
        .fillCircle(0, 1.5 * UNIT, outer + spread * UNIT);
    }
    circle
      .fillStyle(colorNumber(MENU_STYLE.profileBackground), 1)
      .fillCircle(0, 0, outer)
      .fillStyle(colorNumber(badge.color), 1)
      .fillCircle(0, 0, outer - PROFILE_COLOR_INSET * UNIT);
    const symbol = sceneText(
      this,
      badge.symbol,
      layout.profileSymbolFontSize,
      OVERVIEW_STYLE.profileSymbol,
      UNIT,
      'bold',
    ).setOrigin(0.5);
    container.add([circle, symbol]);
  }

  /** Záložka jako kategorie v menu: bílá pilulka, vybraná modrá s bílým textem. */
  private drawTab(tab: OverviewTab, label: string, selected: boolean, fontSize: number): Tappable {
    const container = this.containerAt(tab.hit);
    const width = (tab.pill.right - tab.pill.left) * UNIT;
    const height = (tab.pill.bottom - tab.pill.top) * UNIT;
    const background = this.add
      .graphics()
      .fillStyle(
        colorNumber(selected ? OVERVIEW_STYLE.selectedTabBackground : OVERVIEW_STYLE.tabBackground),
        1,
      )
      .fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    const text = sceneText(
      this,
      label,
      fontSize,
      selected ? OVERVIEW_STYLE.selectedTabText : OVERVIEW_STYLE.tabText,
      UNIT,
      selected ? '600' : 'normal',
    ).setOrigin(0.5);
    container.add([background, text]);
    return { container };
  }

  /** Stránka 7 dní: nadpis, sloupečky (bez dat nápis), zkratky dnů, vysvětlivky a součty. */
  private drawWeek(layout: OverviewScreenLayout, texts: OverviewTexts): void {
    const { week } = layout;
    const overview = this.host.overview;
    const data = overview.data().week;
    const lines = weekLines(data, overview.spec(), texts);
    this.addText(week.title, lines.title, OVERVIEW_STYLE.title, 'bold');
    week.days.forEach((slot, index) => {
      const today = data.days[index]?.isToday === true;
      const color = today ? OVERVIEW_STYLE.text : OVERVIEW_STYLE.secondary;
      this.addText(slot, lines.days[index] ?? '', color, today ? 'bold' : 'normal');
    });
    if (lines.empty !== null) {
      this.addText(week.empty, lines.empty, OVERVIEW_STYLE.secondary);
    } else {
      overviewBars(week, data).forEach((bar, index) => {
        this.addRect(bar.solved, OVERVIEW_STYLE.solved);
        this.addRect(bar.firstTry, OVERVIEW_STYLE.firstTry);
        this.addText(bar.value, String(data.days[index]?.solved ?? 0), OVERVIEW_STYLE.secondary);
      });
    }
    const [afterMistake, laidOutFirstTry] = week.legend;
    this.addRect(afterMistake.swatch, OVERVIEW_STYLE.solved);
    const firstLabel = this.addText(afterMistake.label, lines.legend[0], OVERVIEW_STYLE.text);
    const firstTry = this.besideFirstLegend(afterMistake.label, firstLabel, laidOutFirstTry);
    this.addRect(firstTry.swatch, OVERVIEW_STYLE.firstTry);
    this.addText(firstTry.label, lines.legend[1], OVERVIEW_STYLE.text);
    this.addText(week.totals[0], lines.totals[0], OVERVIEW_STYLE.text, 'bold');
    this.addText(week.totals[1], lines.totals[1], OVERVIEW_STYLE.text);
  }

  /**
   * Vysvětlivky vedle sebe (iPad): rozložení počítá s odhadem šířky textu,
   * skutečné písmo bývá užší. Druhá vysvětlivka se proto posune doleva na
   * `LEGEND_TEXT_GAP` za skutečný konec textu první, nikdy doprava.
   */
  private besideFirstLegend(
    firstSlot: OverviewText,
    firstLabel: Phaser.GameObjects.Text,
    second: OverviewLegendEntry,
  ): OverviewLegendEntry {
    if (second.swatch.top >= firstSlot.box.bottom) {
      return second;
    }
    const textEnd = firstSlot.box.left + (firstSlot.inset ?? 0) + firstLabel.width / UNIT;
    const shift = Math.min(0, textEnd + LEGEND_TEXT_GAP - second.swatch.left);
    const moved = (box: MenuBox): MenuBox => ({
      ...box,
      left: box.left + shift,
      right: box.right + shift,
    });
    return {
      swatch: moved(second.swatch),
      label: { ...second.label, box: moved(second.label.box) },
    };
  }

  /** Stránka Chyby: nadpis a oddíly řádků; nadpis oddílu tučně a o kousek větší. */
  private drawMistakes(layout: OverviewScreenLayout, texts: OverviewTexts): void {
    const { mistakes } = layout;
    const overview = this.host.overview;
    this.addText(mistakes.title, texts.mistakesTitle, OVERVIEW_STYLE.title, 'bold');
    const sections = mistakeSections(
      overview.data().mistakes,
      overview.spec(),
      texts,
      this.host.language(),
    );
    sections.forEach((section, sectionIndex) => {
      const slots = mistakes.sections[sectionIndex] ?? [];
      section.forEach((line, index) => {
        const slot = slots[index];
        if (slot === undefined) {
          return;
        }
        const fitted = line.heading ? { ...slot, fontSize: mistakes.headingFontSize } : slot;
        this.addText(fitted, line.text, OVERVIEW_STYLE.text, line.heading ? 'bold' : 'normal');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Odezva
  // ---------------------------------------------------------------------------

  private press(item: Tappable | undefined): void {
    if (item === undefined) {
      return;
    }
    this.tweens.killTweensOf(item.container);
    item.container.setScale(1).setAngle(0);
    this.tweens.add({
      targets: item.container,
      scale: PRESS.scale,
      duration: PRESS.durationMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private wobble(item: Tappable | undefined): void {
    if (item === undefined) {
      return;
    }
    this.tweens.killTweensOf(item.container);
    item.container.setScale(1).setAngle(0);
    this.tweens.chain({
      targets: item.container,
      tweens: [
        { angle: WOBBLE.angle, duration: WOBBLE.durationMs, ease: 'Sine.easeOut' },
        { angle: -WOBBLE.angle, duration: 2 * WOBBLE.durationMs, ease: 'Sine.easeInOut' },
        { angle: 0, duration: WOBBLE.durationMs, ease: 'Sine.easeIn' },
      ],
    });
  }
}
