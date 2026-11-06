import Phaser from 'phaser';

import { isSharedAudioUnlocked, sharedToneContext } from '../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../shared/audio/tonePlayer';
import type { Tone } from '../../shared/audio/tonePlayer';
import type { HoldButton } from '../../shared/logic/holdButton';
import type { ProfileColor } from '../../shared/logic/profiles';
import { colorNumber } from '../../shared/logic/theme';
import { readViewport } from '../../shared/ui/viewport';
import { SWITCH_TO_ACCENTS_SYMBOL, SWITCH_TO_BASE_SYMBOL, letterKeys } from '../logic/letterGrid';
import type { LetterKey } from '../logic/letterGrid';
import type { Menu } from '../logic/menu';
import type { MenuBox } from '../logic/menuLayout';
import { MENU_SOUNDS } from '../logic/menuSounds';
import {
  COLOR_TITLE_KEY,
  DELETE_CANCEL_KEY,
  DELETE_CONFIRM_KEY,
  DELETE_QUESTION_KEY,
  NICKNAME_TITLE_KEY,
} from '../logic/menuTextKeys';
import { PROFILE_SCREEN_STYLE } from '../logic/menuTheme';
import {
  colorStepLayoutFor,
  deleteConfirmLayoutFor,
  nicknameStepLayoutFor,
  profilePickerLayoutFor,
} from '../logic/profileLayout';
import type {
  ColorStepLayout,
  DeleteConfirmLayout,
  NicknameStepLayout,
  ProfilePickerLayout,
} from '../logic/profileLayout';
import { ADD_PROFILE_HOLD_MS, EDIT_PROFILE_HOLD_MS } from '../logic/profileScreens';
import type { ProfileFeedback, ProfileScreens } from '../logic/profileScreens';
import {
  LANGUAGE_PANEL_SHADOW,
  languageButtonArt,
  languageCardArt,
  languageRowArt,
  sceneText,
} from './languageArt';
import { MENU_UNITS_PER_CSS_PX } from './MenuScene';

/** Klíč scény ve hře Phaseru. */
export const PROFILE_SCENE_KEY = 'profiles';

const UNIT = MENU_UNITS_PER_CSS_PX;

/** Symboly v kódu (nejsou to texty jazyka). */
const ADD_SYMBOL = '+';
const BACKSPACE_SYMBOL = '⌫';
const NICKNAME_STEP_COUNTER = '1 / 2';
const COLOR_STEP_COUNTER = '2 / 2';

const PRESS = { scale: 0.92, durationMs: 70 };
const HELD_SCALE = 0.95;
const SHAKE = { distance: 8, durationMs: 50, repeat: 3 };
const WOBBLE = { angle: 8, durationMs: 90 };
/** Kroužek podržení „+“ a kolečka profilu: uvnitř kolečka jako u kolečka nastavení. */
const HOLD_RING = { inset: 7, width: 6 };
/** Kroužek začíná nahoře. */
const HOLD_RING_START = -Math.PI / 2;
/** Tmavý okraj bílého kroužku kolem kolečka profilu, z každé strany. */
const HOLD_RING_OUTLINE = 1;
const FIELD_TEXT_INSET = 14;
const CARET_WIDTH = 3;
/** Kroužek kolem zvolené barvy: bílá mezera a tmavý okraj. */
const SWATCH_RING = { gap: 3, width: 3 };

export interface ProfileSceneHost {
  readonly screens: ProfileScreens;
  /** Menu kvůli tlačítku a nabídce jazyků (#70). */
  readonly menu: Menu;
  /** Text menu podle klíče v aktuálním jazyce. */
  translate(key: string): string;
  /** Je výběr profilu nebo formulář otevřený? Při startu podle `startScreen` (#76). */
  isOpen(): boolean;
  /** Scéna se vytvořila; když je obrazovka profilů otevřená, menu se uspí. */
  onCreated(): void;
}

/** Prvek, který se dá zmáčknout, zhoupnout nebo zatřást. */
interface Tappable {
  readonly container: Phaser.GameObjects.Container;
  readonly homeX: number;
}

/** Ťukací plocha v CSS px okna: ťuknutí, nebo podržení („+“ a kolečka profilů). */
interface Region {
  readonly box: MenuBox;
  /** Tlačítko s podržením; bez něj se plocha jen ťuká. */
  readonly hold: HoldButton | undefined;
  readonly item: Tappable | undefined;
  /** Patří k tlačítku nebo nabídce jazyků (fungují i s otevřenou nabídkou). */
  readonly language: boolean;
  readonly onTap: () => void;
}

/** Text a kurzor pole s přezdívkou. */
interface FieldParts {
  readonly text: Phaser.GameObjects.Text;
  readonly caret: Phaser.GameObjects.Graphics;
  /** Kolik CSS px smí text zabrat. */
  readonly maxWidth: number;
}

/** Podklad → a jeho rozměry v CSS px. */
interface ForwardParts {
  readonly background: Phaser.GameObjects.Graphics;
  readonly width: number;
  readonly height: number;
  enabled: boolean;
}

/** Kroužek, který se plní během podržení (kolem „+“ nebo kolečka profilu). */
interface HoldRing {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly radius: number;
  readonly holdMs: number;
  /** Bílý kroužek s tmavým okrajem (kolečko profilu), jinak modrý („+“). */
  readonly onColor: boolean;
}

/** Klíč kroužku „+“ mezi kroužky koleček profilů (ty mají klíč podle označení). */
const ADD_RING_KEY = '+';

/** Prst, který se dotkl plochy (nebo zavřel nabídku jazyků a už nic nedělá). */
interface HeldPointer {
  readonly region: Region | null;
}

/**
 * Místa, kde jde přezdívku o `length` písmenech rozdělit na dva řádky,
 * od poloviny ven; při stejné vzdálenosti dřív delší první řádek.
 */
function balancedSplits(length: number): number[] {
  const splits = Array.from({ length: length - 1 }, (_, index) => index + 1);
  const half = length / 2;
  return splits.sort((a, b) => Math.abs(a - half) - Math.abs(b - half) || b - a);
}

function contains(box: MenuBox, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

function centerOf(box: MenuBox): { x: number; y: number } {
  return { x: ((box.left + box.right) / 2) * UNIT, y: ((box.top + box.bottom) / 2) * UNIT };
}

/**
 * Výběr profilu (obrázek P) a formulář nového profilu (#72). Scéna kreslí
 * stav z `profileScreens.ts` podle rozložení z `profileLayout.ts`, ťuknutí
 * a podržení předává logice a odezvu zahraje jako animaci a zvuk. Celá
 * obrazovka se kreslí znovu, jen když se změní krok, vrstva, barva,
 * profily, jazyk nebo okno. Při psaní se přepíše jen text pole, kurzor
 * a → (aby psaní zůstalo plynulé). Zvuk odezvy zazní hned, animace až
 * v dalším snímku na nakreslené obrazovce.
 *
 * Fyzická klávesnice se poslouchá (`keydown` na `window`) jen v 1. kroku
 * formuláře. Nikde není textové pole, systémová klávesnice se neukáže.
 */
export class ProfileScene extends Phaser.Scene {
  private readonly sounds = createTonePlayer(sharedToneContext);
  private drawn: Phaser.GameObjects.GameObject[] = [];
  private regions: Region[] = [];
  private held = new Map<number, HeldPointer>();
  private queued: ProfileFeedback[] = [];
  private drawnState = '';
  private redrawWanted = true;

  private letterItems = new Map<string, Tappable>();
  private keyItems: { switch?: Tappable; backspace?: Tappable } = {};
  private fieldItem: Tappable | undefined;
  /** Nakreslené pole 1. kroku: při psaní se přepíše jen text a kurzor. */
  private field: FieldParts | undefined;
  /** Nakreslené → v 1. kroku: při psaní se mění jen jeho barva. */
  private forward: ForwardParts | undefined;
  private drawnNickname = '';
  private addItem: Tappable | undefined;
  /** Kroužky podržení podle klíče („+“ nebo označení profilu). */
  private holdRings = new Map<string, HoldRing>();
  /** Který kroužek se právě plní a od kdy. */
  private holding: { readonly key: string; readonly startedAt: number } | null = null;
  private selectedSwatch: Tappable | undefined;
  private trashItem: Tappable | undefined;

  private keyboardListening = false;
  private readonly onKeyDown = (event: KeyboardEvent): void => this.handleKey(event);

  constructor(private readonly host: ProfileSceneHost) {
    super({ key: PROFILE_SCENE_KEY, active: true });
  }

  create(): void {
    this.input.addPointer(1);
    this.listenToFingers();
    this.events.on(Phaser.Scenes.Events.SLEEP, () => {
      this.syncKeyboard(false);
      // Odezva usnulé obrazovky se po probuzení už nezahraje.
      this.queued = [];
    });
    for (const ending of [Phaser.Scenes.Events.SHUTDOWN, Phaser.Scenes.Events.DESTROY]) {
      this.events.once(ending, () => this.syncKeyboard(false));
    }
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.requestRedraw());
    this.host.onCreated();
    if (!this.host.isOpen()) {
      this.scene.sleep();
    }
  }

  override update(): void {
    this.syncKeyboard(this.host.screens.screen() === 'nickname');
    const state = this.stateKey();
    if (this.redrawWanted || state !== this.drawnState) {
      this.redrawWanted = false;
      this.redraw(state);
    } else if (this.host.screens.nickname() !== this.drawnNickname) {
      this.refreshNickname();
    }
    const events = this.queued;
    this.queued = [];
    events.forEach((event) => this.playNow(event));
    this.drawHoldRings();
  }

  /** Nakreslí se znovu v dalším snímku (otočení, změna okna, otevření). */
  requestRedraw(): void {
    this.redrawWanted = true;
  }

  /**
   * Odezva z logiky: zvuk hned (i když se obrazovka zavírá a scéna usne),
   * animace v dalším snímku, až je nakreslený nový stav.
   */
  play(event: ProfileFeedback): void {
    this.playSoundOf(event);
    this.queued.push(event);
  }

  /**
   * Co je vidět; když se to změní, scéna se nakreslí znovu. Přezdívka
   * v 1. kroku sem nepatří, při psaní se přepíše jen pole (`refreshNickname`).
   */
  private stateKey(): string {
    const { screens, menu } = this.host;
    const onColorStep = screens.screen() === 'color' || screens.screen() === 'confirmDelete';
    return JSON.stringify([
      screens.screen(),
      screens.formMode(),
      screens.screen() === 'nickname' ? '' : screens.nickname(),
      screens.letterLayer(),
      onColorStep ? screens.selectedColor() : '',
      screens.canDeleteProfile(),
      screens.deleteConfirmProfile(),
      screens.canAddProfile(),
      screens.pickerItems(),
      menu.isLanguageMenuOpen(),
      menu.languageButtonLabel(),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Klávesnice a prsty
  // ---------------------------------------------------------------------------

  /** `keydown` na `window` jen v 1. kroku formuláře, jinde se neposlouchá. */
  private syncKeyboard(wanted: boolean): void {
    if (wanted === this.keyboardListening) {
      return;
    }
    this.keyboardListening = wanted;
    if (wanted) {
      window.addEventListener('keydown', this.onKeyDown);
    } else {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  private handleKey(event: KeyboardEvent): void {
    // Zkratky prohlížeče (Cmd+R, Ctrl+…) zůstanou prohlížeči.
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
      return;
    }
    if (event.key === 'Backspace') {
      // Starší prohlížeče by Backspacem šly o stránku zpět.
      event.preventDefault();
    } else if (event.repeat) {
      // Držená klávesa by psala písmeno pořád dokola.
      return;
    }
    this.host.screens.keyDown(event.key);
  }

  private listenToFingers(): void {
    const pointOf = (pointer: Phaser.Input.Pointer): { x: number; y: number } => ({
      x: pointer.x / UNIT,
      y: pointer.y / UNIT,
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = pointOf(pointer);
      this.fingerDown(pointer.id, x, y);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = pointOf(pointer);
      this.fingerMove(pointer.id, x, y);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      const { x, y } = pointOf(pointer);
      this.fingerUp(pointer.id, x, y, pointer.wasCanceled);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private fingerDown(id: number, x: number, y: number): void {
    if (this.held.has(id)) {
      return;
    }
    const region = this.regions.find((candidate) => contains(candidate.box, x, y)) ?? null;
    if (this.host.menu.isLanguageMenuOpen() && region?.language !== true) {
      // Ťuknutí mimo nabídku jazyků ji jen zavře (#70).
      this.host.menu.closeLanguageMenu();
      this.held.set(id, { region: null });
      return;
    }
    this.held.set(id, { region });
    if (region === null) {
      return;
    }
    region.hold?.press(id);
    this.setHeld(region.item, region.hold === undefined || region.hold.isHolding());
  }

  private fingerMove(id: number, x: number, y: number): void {
    const region = this.held.get(id)?.region;
    if (region === undefined || region === null || contains(region.box, x, y)) {
      return;
    }
    region.hold?.leave(id);
    this.setHeld(region.item, false);
  }

  private fingerUp(id: number, x: number, y: number, canceled: boolean): void {
    const region = this.held.get(id)?.region;
    this.held.delete(id);
    if (region === undefined || region === null) {
      return;
    }
    this.setHeld(region.item, false);
    if (region.hold !== undefined) {
      if (canceled) {
        region.hold.cancel(id);
      } else {
        region.hold.release(id);
      }
      return;
    }
    if (!canceled && contains(region.box, x, y)) {
      region.onTap();
    }
  }

  private setHeld(item: Tappable | undefined, held: boolean): void {
    if (item === undefined || !item.container.active || this.tweens.isTweening(item.container)) {
      return;
    }
    item.container.setScale(held ? HELD_SCALE : 1);
  }

  // ---------------------------------------------------------------------------
  // Kreslení
  // ---------------------------------------------------------------------------

  private redraw(state: string): void {
    for (const object of this.drawn) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.drawn = [];
    this.regions = [];
    this.letterItems = new Map();
    this.keyItems = {};
    this.fieldItem = undefined;
    this.field = undefined;
    this.forward = undefined;
    this.drawnNickname = this.host.screens.nickname();
    this.addItem = undefined;
    this.holdRings = new Map();
    this.selectedSwatch = undefined;
    this.trashItem = undefined;
    this.drawnState = state;

    const viewport = readViewport();
    const screens = this.host.screens;
    switch (screens.screen()) {
      case 'picker':
        this.drawPicker(
          profilePickerLayoutFor(viewport, {
            profileCount: screens.pickerItems().length,
            showAdd: screens.canAddProfile(),
            languageNames: this.host.menu.languages().map((language) => language.name),
          }),
        );
        break;
      case 'nickname':
        this.drawNicknameStep(nicknameStepLayoutFor(viewport, { layer: screens.letterLayer() }));
        break;
      case 'color':
        this.drawColorStep(colorStepLayoutFor(viewport, { withTrash: screens.canDeleteProfile() }));
        break;
      case 'confirmDelete':
        // Pod potvrzením je ztmavený 2. krok i s košem, ťukat jde jen na potvrzení.
        this.drawColorStep(colorStepLayoutFor(viewport, { withTrash: true }));
        this.regions = [];
        this.drawDeleteConfirm(deleteConfirmLayoutFor(viewport));
        break;
      case 'closed':
        break;
    }
  }

  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.drawn.push(object);
    return object;
  }

  /** Kontejner uprostřed obdélníku; přidá ťukací plochu, když má akci. */
  private tappable(box: MenuBox): Tappable {
    const { x, y } = centerOf(box);
    const container = this.keep(this.add.container(x, y));
    return { container, homeX: x };
  }

  private region(
    box: MenuBox,
    item: Tappable | undefined,
    onTap: () => void,
    options: { hold?: HoldButton; language?: boolean } = {},
  ): void {
    this.regions.push({
      box,
      item,
      onTap,
      hold: options.hold,
      language: options.language ?? false,
    });
  }

  private text(
    content: string,
    fontSize: number,
    color: string,
    fontStyle = 'normal',
  ): Phaser.GameObjects.Text {
    return sceneText(this, content, fontSize, color, UNIT, fontStyle);
  }

  /** Text zmenšený, aby se vešel do `maxWidth` CSS px. */
  private fitText(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
    if (text.width > maxWidth * UNIT) {
      text.setScale((maxWidth * UNIT) / text.width);
    }
    return text;
  }

  /** Zaoblený obdélník se středem v počátku. */
  private roundedRect(
    width: number,
    height: number,
    radius: number,
    color: string,
    shadowAlpha = 0,
  ): Phaser.GameObjects.Graphics {
    const w = width * UNIT;
    const h = height * UNIT;
    const r = Math.min(radius, height / 2) * UNIT;
    const graphics = this.add.graphics();
    if (shadowAlpha > 0) {
      graphics
        .fillStyle(0x000000, shadowAlpha)
        .fillRoundedRect(-w / 2, -h / 2 + 1 * UNIT, w, h + 1 * UNIT, r);
    }
    graphics.fillStyle(colorNumber(color), 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    return graphics;
  }

  // --- Výběr profilu ---------------------------------------------------------

  private drawPicker(layout: ProfilePickerLayout): void {
    const screens = this.host.screens;
    screens.pickerItems().forEach((profile, index) => {
      const slot = layout.profiles[index];
      if (slot === undefined) {
        return;
      }
      const item = this.drawCircle(
        slot.circle,
        profile.color,
        profile.symbol,
        layout.symbolFontSize,
      );
      // Ťuknutí profil vybere, podržení 1 s otevře úpravu (#73).
      this.addHoldRing(profile.id, item, slot.circle, EDIT_PROFILE_HOLD_MS, true);
      this.region(slot.circle, item, () => undefined, { hold: screens.profileButton(profile.id) });
      if (profile.nickname !== null) {
        this.drawNicknameLines(slot.nickname, profile.nickname, layout);
      }
    });
    if (layout.add !== null) {
      this.drawAddButton(layout.add, layout.symbolFontSize);
    }
    this.drawLanguage(layout);
  }

  private drawCircle(box: MenuBox, color: string, symbol: string, fontSize: number): Tappable {
    const item = this.tappable(box);
    const radius = ((box.right - box.left) / 2) * UNIT;
    const circle = this.add.graphics();
    circle.fillStyle(colorNumber(color), 1).fillCircle(0, 0, radius);
    const label = this.text(symbol, fontSize, PROFILE_SCREEN_STYLE.symbol, 'bold').setOrigin(0.5);
    // Háčky a kroužky nad velkými písmeny se nesmí oříznout: písmeno trochu níž.
    label.y = fontSize * 0.04 * UNIT;
    item.container.add([circle, label]);
    return item;
  }

  /**
   * Přezdívka pod kolečkem: na jednom řádku, a když se nevejde, na dva
   * vyvážené řádky (přezdívka je jedno slovo, dělí se mezi písmeny). Dělí
   * se co nejblíž polovině, kde se vejdou oba řádky („WWWWWWW / WWWWW“).
   */
  private drawNicknameLines(box: MenuBox, nickname: string, layout: ProfilePickerLayout): void {
    const width = box.right - box.left;
    const fits = (content: string): boolean => {
      const probe = this.text(content, layout.nicknameFontSize, PROFILE_SCREEN_STYLE.nickname);
      const result = probe.width <= width * UNIT;
      probe.destroy();
      return result;
    };
    const make = (content: string, line: number): void => {
      const text = this.keep(
        this.text(content, layout.nicknameFontSize, PROFILE_SCREEN_STYLE.nickname),
      ).setOrigin(0.5, 0);
      text.setPosition(
        ((box.left + box.right) / 2) * UNIT,
        (box.top + line * layout.nicknameLineHeight) * UNIT,
      );
      this.fitText(text, width);
    };
    const letters = [...nickname];
    if (letters.length < 2 || fits(nickname)) {
      make(nickname, 0);
      return;
    }
    const split = balancedSplits(letters.length).find(
      (at) => fits(letters.slice(0, at).join('')) && fits(letters.slice(at).join('')),
    );
    // Nevejde-li se ani tak, oba řádky se zmenší (`fitText`).
    const at = split ?? Math.ceil(letters.length / 2);
    make(letters.slice(0, at).join(''), 0);
    make(letters.slice(at).join(''), 1);
  }

  private drawAddButton(box: MenuBox, fontSize: number): void {
    const item = this.drawCircle(box, PROFILE_SCREEN_STYLE.addBackground, '', fontSize);
    const plus = this.text(ADD_SYMBOL, fontSize, PROFILE_SCREEN_STYLE.addSymbol).setOrigin(0.5);
    item.container.add(plus);
    this.addItem = item;
    this.addHoldRing(ADD_RING_KEY, item, box, ADD_PROFILE_HOLD_MS, false);
    this.region(box, item, () => undefined, { hold: this.host.screens.addButton });
  }

  /** Prázdný kroužek podržení uvnitř kolečka; plní se v `drawHoldRings`. */
  private addHoldRing(
    key: string,
    item: Tappable,
    box: MenuBox,
    holdMs: number,
    onColor: boolean,
  ): void {
    const graphics = this.add.graphics();
    item.container.add(graphics);
    const radius = (box.right - box.left) / 2 - HOLD_RING.inset;
    this.holdRings.set(key, { graphics, radius, holdMs, onColor });
  }

  /** Kroužek drženého kolečka se během podržení plní (jako u kolečka nastavení). */
  private drawHoldRings(): void {
    for (const [key, ring] of this.holdRings) {
      if (!ring.graphics.active) {
        continue;
      }
      ring.graphics.clear();
      if (this.holding?.key !== key) {
        continue;
      }
      const elapsed = performance.now() - this.holding.startedAt;
      const progress = Math.min(1, elapsed / ring.holdMs);
      const end = HOLD_RING_START + progress * 2 * Math.PI;
      if (ring.onColor) {
        // Tmavý okraj pod bílým kroužkem, aby byl vidět i na světlé barvě.
        this.strokeArc(
          ring,
          HOLD_RING.width + 2 * HOLD_RING_OUTLINE,
          PROFILE_SCREEN_STYLE.profileHoldRingOutline,
          PROFILE_SCREEN_STYLE.profileHoldRingOutlineAlpha,
          end,
        );
        this.strokeArc(ring, HOLD_RING.width, PROFILE_SCREEN_STYLE.profileHoldRing, 1, end);
      } else {
        this.strokeArc(ring, HOLD_RING.width, PROFILE_SCREEN_STYLE.holdRing, 1, end);
      }
    }
  }

  /** Oblouk kroužku podržení od horního bodu po úhel `end`. */
  private strokeArc(
    ring: HoldRing,
    width: number,
    color: string,
    alpha: number,
    end: number,
  ): void {
    ring.graphics.lineStyle(width * UNIT, colorNumber(color), alpha);
    ring.graphics.beginPath();
    ring.graphics.arc(0, 0, ring.radius * UNIT, HOLD_RING_START, end);
    ring.graphics.strokePath();
  }

  /** Plné tlačítko jazyka „CS“ vpravo nahoře a otevřená nabídka jazyků (#70). */
  private drawLanguage(layout: ProfilePickerLayout): void {
    const menu = this.host.menu;
    const button = this.tappable(layout.languageSlot);
    button.container.add(
      languageButtonArt(
        this,
        layout.languageSlot,
        menu.languageButtonLabel(),
        layout.languageButtonFontSize,
        UNIT,
      ),
    );
    this.region(layout.languageSlot, button, () => menu.tapLanguageButton(), { language: true });
    if (!menu.isLanguageMenuOpen()) {
      return;
    }
    const panel = layout.languagePanel;
    this.keep(languageCardArt(this, panel.panel, UNIT));
    menu.languages().forEach((language, index) => {
      const row = panel.rows[index];
      // Jazyky pod viditelnou částí seznamu se nekreslí (dnes se vejdou všechny).
      if (row === undefined || row.bottom > panel.list.viewport.bottom + LANGUAGE_PANEL_SHADOW) {
        return;
      }
      const item = this.tappable(row);
      item.container.add(languageRowArt(this, panel, row, language, UNIT));
      this.region(row, item, () => menu.tapLanguage(language.code), { language: true });
    });
  }

  // --- Formulář: společné části ---------------------------------------------

  /** Nadpis kroku a „1 / 2“ (jen kde jsou v rozložení). */
  private drawHeading(
    layout: NicknameStepLayout | ColorStepLayout,
    titleKey: string,
    counter: string,
  ): void {
    if (layout.title !== null) {
      const title = layout.title;
      const centered = layout.stepCounter === null;
      const text = this.keep(
        this.text(
          this.host.translate(titleKey),
          layout.titleFontSize,
          PROFILE_SCREEN_STYLE.title,
          centered ? '600' : 'normal',
        ),
      ).setOrigin(centered ? 0.5 : 0, 0.5);
      text.setPosition(
        (centered ? (title.left + title.right) / 2 : title.left) * UNIT,
        ((title.top + title.bottom) / 2) * UNIT,
      );
      this.fitText(text, title.right - title.left);
    }
    if (layout.stepCounter !== null) {
      const box = layout.stepCounter;
      const text = this.keep(
        this.text(counter, layout.stepCounterFontSize, PROFILE_SCREEN_STYLE.stepCounter),
      ).setOrigin(1, 0.5);
      text.setPosition(box.right * UNIT, ((box.top + box.bottom) / 2) * UNIT);
    }
  }

  /** Šedé zpět s šipkou doleva. */
  private drawBack(box: MenuBox): void {
    const item = this.tappable(box);
    const height = box.bottom - box.top;
    const background = this.roundedRect(
      box.right - box.left,
      height,
      height / 2,
      PROFILE_SCREEN_STYLE.backBackground,
    );
    const chevron = this.add.graphics();
    const size = height * 0.16 * UNIT;
    chevron.lineStyle(3 * UNIT, colorNumber(PROFILE_SCREEN_STYLE.backSymbol), 1);
    chevron.beginPath();
    chevron.moveTo(size / 2, -size);
    chevron.lineTo(-size / 2, 0);
    chevron.lineTo(size / 2, size);
    chevron.strokePath();
    item.container.add([background, chevron]);
    this.region(box, item, () => this.host.screens.tapBack());
  }

  /** Modré → (další) nebo ✓ (uložit); ztlumené, když ještě nejde. */
  private drawForward(
    box: MenuBox,
    symbol: 'arrow' | 'check',
    enabled: boolean,
    onTap: () => void,
  ): void {
    const item = this.tappable(box);
    const height = box.bottom - box.top;
    const forward: ForwardParts = {
      background: this.add.graphics(),
      width: box.right - box.left,
      height,
      enabled,
    };
    this.paintForward(forward);
    const background = forward.background;
    this.forward = forward;
    const mark = this.add.graphics();
    const size = height * 0.2 * UNIT;
    mark.lineStyle(3.5 * UNIT, colorNumber(PROFILE_SCREEN_STYLE.forwardSymbol), 1);
    mark.beginPath();
    if (symbol === 'arrow') {
      mark.moveTo(-size, 0);
      mark.lineTo(size, 0);
      mark.moveTo(size * 0.2, -size * 0.8);
      mark.lineTo(size, 0);
      mark.lineTo(size * 0.2, size * 0.8);
    } else {
      mark.moveTo(-size, 0);
      mark.lineTo(-size * 0.3, size * 0.7);
      mark.lineTo(size, -size * 0.7);
    }
    mark.strokePath();
    item.container.add([background, mark]);
    this.region(box, item, onTap);
  }

  // --- 1. krok: přezdívka ----------------------------------------------------

  private drawNicknameStep(layout: NicknameStepLayout): void {
    const screens = this.host.screens;
    this.drawHeading(layout, NICKNAME_TITLE_KEY, NICKNAME_STEP_COUNTER);
    this.drawField(layout);
    const layer = screens.letterLayer();
    letterKeys(layer).forEach((key, index) => {
      const box = layout.keys[index];
      if (box !== undefined) {
        this.drawKey(layout, box, key, layer === 'base');
      }
    });
    this.drawBack(layout.back);
    this.drawForward(layout.next, 'arrow', screens.canGoNext(), () => screens.tapNext());
  }

  /** Pole s rozepsanou přezdívkou a modrým kurzorem; ťuknutí na něj nic nedělá. */
  private drawField(layout: NicknameStepLayout): void {
    const box = layout.field;
    const item = this.tappable(box);
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    const border = this.roundedRect(
      width,
      height,
      layout.fieldRadius,
      PROFILE_SCREEN_STYLE.fieldBorder,
    );
    const inner = this.roundedRect(
      width - 4,
      height - 4,
      layout.fieldRadius - 2,
      PROFILE_SCREEN_STYLE.fieldBackground,
    );
    const text = this.text(
      this.host.screens.nickname(),
      layout.fieldFontSize,
      PROFILE_SCREEN_STYLE.fieldText,
      '600',
    ).setOrigin(0, 0.5);
    text.x = (-width / 2 + FIELD_TEXT_INSET) * UNIT;
    // Háčky nad velkými písmeny se nesmí oříznout: text trochu níž.
    text.y = layout.fieldFontSize * 0.04 * UNIT;
    const caretHeight = layout.fieldFontSize * 1.1 * UNIT;
    const caret = this.add.graphics();
    caret
      .fillStyle(colorNumber(PROFILE_SCREEN_STYLE.caret), 1)
      .fillRoundedRect(0, -caretHeight / 2, CARET_WIDTH * UNIT, caretHeight, 1.5 * UNIT);
    item.container.add([border, inner, text, caret]);
    this.fieldItem = item;
    this.field = { text, caret, maxWidth: width - 2 * FIELD_TEXT_INSET - CARET_WIDTH - 4 };
    this.placeFieldText();
  }

  /** Text pole zmenšený, aby se vešel, a kurzor hned za ním. */
  private placeFieldText(): void {
    const field = this.field;
    if (field === undefined) {
      return;
    }
    field.text.setScale(1);
    this.fitText(field.text, field.maxWidth);
    field.caret.x = field.text.x + field.text.displayWidth + 3 * UNIT;
  }

  /** Při psaní: jen nový text pole, kurzor a barva →, nic se nekreslí znovu. */
  private refreshNickname(): void {
    const screens = this.host.screens;
    this.drawnNickname = screens.nickname();
    if (this.field !== undefined && this.field.text.active) {
      this.field.text.setText(this.drawnNickname);
      this.placeFieldText();
    }
    const forward = this.forward;
    if (forward !== undefined && forward.background.active) {
      const enabled = screens.canGoNext();
      if (enabled !== forward.enabled) {
        forward.enabled = enabled;
        this.paintForward(forward);
      }
    }
  }

  /** Podklad →: plný modrý, nebo ztlumený, dokud přezdívka nejde uložit. */
  private paintForward(forward: ForwardParts): void {
    const w = forward.width * UNIT;
    const h = forward.height * UNIT;
    const color = forward.enabled
      ? PROFILE_SCREEN_STYLE.forwardBackground
      : PROFILE_SCREEN_STYLE.forwardDimmedBackground;
    forward.background
      .clear()
      .fillStyle(colorNumber(color), 1)
      .fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  }

  private drawKey(layout: NicknameStepLayout, box: MenuBox, key: LetterKey, isBase: boolean): void {
    const screens = this.host.screens;
    const item = this.tappable(box);
    const size = box.right - box.left;
    const parts: Phaser.GameObjects.GameObject[] = [];
    switch (key.kind) {
      case 'letter': {
        parts.push(
          this.roundedRect(
            size,
            size,
            layout.keyRadius,
            PROFILE_SCREEN_STYLE.keyBackground,
            PROFILE_SCREEN_STYLE.keyShadowAlpha,
          ),
        );
        const label = this.text(
          key.letter,
          layout.keyFontSize,
          PROFILE_SCREEN_STYLE.keyText,
          '500',
        );
        label.setOrigin(0.5).setY(layout.keyFontSize * 0.04 * UNIT);
        parts.push(label);
        this.letterItems.set(key.letter, item);
        this.region(box, item, () => screens.tapLetter(key.letter));
        break;
      }
      case 'switch': {
        parts.push(
          this.roundedRect(size, size, layout.keyRadius, PROFILE_SCREEN_STYLE.switchBorder),
          this.roundedRect(
            size - 4,
            size - 4,
            layout.keyRadius - 2,
            PROFILE_SCREEN_STYLE.switchBackground,
          ),
        );
        parts.push(
          this.text(
            isBase ? SWITCH_TO_ACCENTS_SYMBOL : SWITCH_TO_BASE_SYMBOL,
            layout.keyFontSize - 4,
            PROFILE_SCREEN_STYLE.switchText,
            'bold',
          ).setOrigin(0.5),
        );
        this.keyItems.switch = item;
        this.region(box, item, () => screens.tapLayerSwitch());
        break;
      }
      case 'backspace': {
        parts.push(
          this.roundedRect(size, size, layout.keyRadius, PROFILE_SCREEN_STYLE.backspaceBackground),
          this.text(
            BACKSPACE_SYMBOL,
            layout.keyFontSize - 2,
            PROFILE_SCREEN_STYLE.keyText,
          ).setOrigin(0.5),
        );
        this.keyItems.backspace = item;
        this.region(box, item, () => screens.tapBackspace());
        break;
      }
    }
    item.container.add(parts);
  }

  // --- 2. krok: barva --------------------------------------------------------

  private drawColorStep(layout: ColorStepLayout): void {
    const screens = this.host.screens;
    this.drawHeading(layout, COLOR_TITLE_KEY, COLOR_STEP_COUNTER);
    this.drawCircle(
      layout.preview,
      screens.selectedColor(),
      screens.previewSymbol(),
      layout.previewSymbolFontSize,
    );
    const nickname = this.keep(
      this.text(screens.nickname(), layout.nicknameFontSize, PROFILE_SCREEN_STYLE.nickname, '600'),
    ).setOrigin(0.5);
    const center = centerOf(layout.nickname);
    nickname.setPosition(center.x, center.y);
    this.fitText(nickname, layout.nickname.right - layout.nickname.left);

    screens.palette().forEach((swatch, index) => {
      const box = layout.swatches[index];
      if (box !== undefined) {
        this.drawSwatch(box, swatch.color, swatch.selected);
      }
    });
    this.drawBack(layout.back);
    this.drawForward(layout.save, 'check', true, () => screens.tapSave());
    if (layout.trash !== null) {
      this.drawTrash(layout.trash);
    }
  }

  /** Červený koš ve světle červeném kolečku (#73, obrázek 6). */
  private drawTrash(box: MenuBox): void {
    const item = this.tappable(box);
    const radius = ((box.right - box.left) / 2) * UNIT;
    const background = this.add.graphics();
    background
      .fillStyle(colorNumber(PROFILE_SCREEN_STYLE.trashBackground), 1)
      .fillCircle(0, 0, radius);
    item.container.add([background, this.trashIcon(radius * 0.9)]);
    this.trashItem = item;
    this.region(box, item, () => this.host.screens.tapDelete());
  }

  /** Koš jako čáry (víko, ucho, nádoba a dva proužky) v ploše `size` × `size`. */
  private trashIcon(size: number): Phaser.GameObjects.Graphics {
    // Souřadnice z obrázku 6 v mřížce 32 × 32 se středem v počátku.
    const unit = size / 32;
    const at = (value: number): number => (value - 16) * unit;
    const icon = this.add.graphics();
    icon.lineStyle(2.5 * unit, colorNumber(PROFILE_SCREEN_STYLE.trashSymbol), 1);
    icon.beginPath();
    icon.moveTo(at(5), at(9));
    icon.lineTo(at(27), at(9));
    icon.moveTo(at(12), at(9));
    icon.lineTo(at(12), at(5));
    icon.lineTo(at(20), at(5));
    icon.lineTo(at(20), at(9));
    icon.moveTo(at(8), at(9));
    icon.lineTo(at(9.5), at(27));
    icon.lineTo(at(22.5), at(27));
    icon.lineTo(at(24), at(9));
    icon.moveTo(at(13.5), at(13));
    icon.lineTo(at(13.5), at(23));
    icon.moveTo(at(18.5), at(13));
    icon.lineTo(at(18.5), at(23));
    icon.strokePath();
    return icon;
  }

  // --- Potvrzení smazání -----------------------------------------------------

  /**
   * Ztmavený formulář a nad ním bílý rámeček s kolečkem profilu, přezdívkou,
   * otázkou, červeným „Smazat“ a šedým „Zpět“ na místě ✓ (obrázek 8).
   */
  private drawDeleteConfirm(layout: DeleteConfirmLayout): void {
    const screens = this.host.screens;
    const profile = screens.deleteConfirmProfile();
    if (profile === null) {
      return;
    }
    const dim = this.keep(this.add.graphics());
    dim
      .fillStyle(0x000000, PROFILE_SCREEN_STYLE.dimAlpha)
      .fillRect(0, 0, this.scale.width, this.scale.height);
    const panel = layout.panel;
    const panelCenter = centerOf(panel);
    const card = this.keep(
      this.roundedRect(
        panel.right - panel.left,
        panel.bottom - panel.top,
        layout.panelRadius,
        PROFILE_SCREEN_STYLE.confirmPanelBackground,
        PROFILE_SCREEN_STYLE.confirmPanelShadowAlpha,
      ),
    );
    card.setPosition(panelCenter.x, panelCenter.y);
    this.drawCircle(layout.preview, profile.color, profile.symbol, layout.previewSymbolFontSize);
    if (profile.nickname !== null) {
      this.centeredText(
        profile.nickname,
        layout.nickname,
        layout.nicknameFontSize,
        PROFILE_SCREEN_STYLE.confirmNickname,
        'normal',
      );
    }
    this.centeredText(
      this.host.translate(DELETE_QUESTION_KEY),
      layout.question,
      layout.questionFontSize,
      PROFILE_SCREEN_STYLE.confirmQuestion,
      'bold',
    );
    this.drawPillButton(
      layout.confirm,
      DELETE_CONFIRM_KEY,
      layout.buttonFontSize,
      {
        background: PROFILE_SCREEN_STYLE.confirmDeleteBackground,
        text: PROFILE_SCREEN_STYLE.confirmDeleteText,
      },
      () => screens.tapConfirmDelete(),
    );
    this.drawPillButton(
      layout.cancel,
      DELETE_CANCEL_KEY,
      layout.buttonFontSize,
      {
        background: PROFILE_SCREEN_STYLE.cancelDeleteBackground,
        text: PROFILE_SCREEN_STYLE.cancelDeleteText,
      },
      () => screens.tapCancelDelete(),
    );
  }

  /** Text uprostřed plochy, zmenšený, aby se vešel. */
  private centeredText(
    content: string,
    box: MenuBox,
    fontSize: number,
    color: string,
    fontStyle: string,
  ): void {
    const text = this.keep(this.text(content, fontSize, color, fontStyle)).setOrigin(0.5);
    const center = centerOf(box);
    text.setPosition(center.x, center.y);
    this.fitText(text, box.right - box.left);
  }

  /** Tlačítko jako pilulka s textem jazyka. */
  private drawPillButton(
    box: MenuBox,
    textKey: string,
    fontSize: number,
    colors: { readonly background: string; readonly text: string },
    onTap: () => void,
  ): void {
    const item = this.tappable(box);
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    const background = this.roundedRect(width, height, height / 2, colors.background);
    const label = this.text(this.host.translate(textKey), fontSize, colors.text, '600');
    label.setOrigin(0.5);
    this.fitText(label, width - 16);
    item.container.add([background, label]);
    this.region(box, item, onTap);
  }

  private drawSwatch(box: MenuBox, color: ProfileColor, selected: boolean): void {
    const screens = this.host.screens;
    const item = this.tappable(box);
    const radius = ((box.right - box.left) / 2) * UNIT;
    const circle = this.add.graphics();
    if (selected) {
      // Zvolená barva má bílou mezeru, tmavý kroužek a ✓.
      circle
        .fillStyle(colorNumber(PROFILE_SCREEN_STYLE.selectedSwatchRing), 1)
        .fillCircle(0, 0, radius)
        .fillStyle(colorNumber(PROFILE_SCREEN_STYLE.swatchGap), 1)
        .fillCircle(0, 0, radius - SWATCH_RING.width * UNIT);
    }
    const inset = selected ? (SWATCH_RING.width + SWATCH_RING.gap) * UNIT : 0;
    circle.fillStyle(colorNumber(color), 1).fillCircle(0, 0, radius - inset);
    const parts: Phaser.GameObjects.GameObject[] = [circle];
    if (selected) {
      const check = this.add.graphics();
      const size = radius * 0.32;
      check.lineStyle(3 * UNIT, colorNumber(PROFILE_SCREEN_STYLE.swatchCheck), 1);
      check.beginPath();
      check.moveTo(-size, 0);
      check.lineTo(-size * 0.3, size * 0.7);
      check.lineTo(size, -size * 0.7);
      check.strokePath();
      parts.push(check);
      this.selectedSwatch = item;
    }
    item.container.add(parts);
    this.region(box, item, () => screens.tapColor(color));
  }

  // ---------------------------------------------------------------------------
  // Odezva
  // ---------------------------------------------------------------------------

  private playNow(event: ProfileFeedback): void {
    switch (event.kind) {
      case 'press':
        this.press(this.letterItems.get(event.key));
        break;
      case 'tap':
        this.playTap(event.target);
        break;
      case 'wobble':
        this.wobble(this.wobbleItem(event.target));
        break;
      case 'addHolding':
        this.setHolding(ADD_RING_KEY, event.holding);
        break;
      case 'profileHolding':
        this.setHolding(event.id, event.holding);
        break;
      case 'shake':
        this.shake(this.fieldItem);
        break;
    }
  }

  /** Zvuk odezvy; písmena a přepnutí tiše, aby psaní nebylo hlučné. */
  private playSoundOf(event: ProfileFeedback): void {
    switch (event.kind) {
      case 'press':
        this.playSound(MENU_SOUNDS.select);
        break;
      case 'tap':
        this.playSound(
          event.target === 'switch' || event.target === 'backspace' || event.target === 'color'
            ? MENU_SOUNDS.select
            : MENU_SOUNDS.press,
        );
        break;
      case 'wobble':
        this.playSound(MENU_SOUNDS.wobble);
        break;
      case 'shake':
        this.playSound(MENU_SOUNDS.shake);
        break;
      case 'addHolding':
      case 'profileHolding':
        break;
    }
  }

  private wobbleItem(
    target: Extract<ProfileFeedback, { kind: 'wobble' }>['target'],
  ): Tappable | undefined {
    switch (target) {
      case 'add':
        return this.addItem;
      case 'backspace':
        return this.keyItems.backspace;
      case 'delete':
        return this.trashItem;
    }
  }

  /** Začne plnit kroužek `key`, nebo ho schová (jen když se plní právě ten). */
  private setHolding(key: string, holding: boolean): void {
    if (holding) {
      this.holding = { key, startedAt: performance.now() };
    } else if (this.holding?.key === key) {
      this.holding = null;
    }
  }

  private playTap(target: Extract<ProfileFeedback, { kind: 'tap' }>['target']): void {
    switch (target) {
      case 'switch':
        this.press(this.keyItems.switch);
        break;
      case 'backspace':
        this.press(this.keyItems.backspace);
        break;
      case 'color':
        this.press(this.selectedSwatch);
        break;
      case 'delete':
        // Koš je vidět i pod potvrzením, zmáčkne se ve ztmaveném formuláři.
        this.press(this.trashItem);
        break;
      case 'cancelDelete':
      case 'confirmDelete':
      case 'back':
      case 'next':
      case 'save':
      case 'profile':
        // Obrazovka se hned změní, zmáčknutí by nebylo vidět; zvuk už zazněl.
        break;
    }
  }

  /** Tón jen s odemčeným zvukem (stejně jako v menu). */
  private playSound(tones: readonly Tone[]): void {
    if (isSharedAudioUnlocked()) {
      this.sounds.play(tones);
    }
  }

  private settle(item: Tappable): void {
    this.tweens.killTweensOf(item.container);
    item.container.setScale(1).setAngle(0);
    item.container.x = item.homeX;
  }

  private press(item: Tappable | undefined): void {
    if (item === undefined || !item.container.active) {
      return;
    }
    this.settle(item);
    this.tweens.add({
      targets: item.container,
      scale: PRESS.scale,
      duration: PRESS.durationMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private shake(item: Tappable | undefined): void {
    if (item === undefined || !item.container.active) {
      return;
    }
    this.settle(item);
    this.tweens.add({
      targets: item.container,
      x: item.homeX + SHAKE.distance * UNIT,
      duration: SHAKE.durationMs,
      yoyo: true,
      repeat: SHAKE.repeat,
      onComplete: () => {
        item.container.x = item.homeX;
      },
    });
  }

  private wobble(item: Tappable | undefined): void {
    if (item === undefined || !item.container.active) {
      return;
    }
    this.settle(item);
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
