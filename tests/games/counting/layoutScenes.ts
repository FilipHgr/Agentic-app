/**
 * Obrazovky Počítání pro společná pravidla rozložení (#81): hra
 * s číselníkem, psaní, nápověda, nastavení a průvodce ve všech zkušebních
 * oknech, rozsazích, ovládáních, druzích příkladů, nápovědách a počtech
 * hvězdiček. Každá obrazovka je `LayoutScene` z `tests/shared/layoutRules.ts`
 * s prvky v CSS px okna a s popisem případu pro zprávu při selhání.
 *
 * Schválené výjimky z pravidel jsou tady u prvků, každá s odkazem:
 * - ťukací tečka nápovědy na telefonu 48 px (#54, #56 AC5),
 * - tlačítko nápovědy 60 px v okně 932×500 u číselníku do 20 (#84,
 *   rozhodnutí 2026-11-07),
 * - tečka nápovědy a rámeček průvodce na iPadu měří 64 a 4 herní jednotky
 *   (#43 AC7, #49 AC5); iPad se nemění (#54 AC5), v okně 1180×760
 *   a 932×500 je plocha zmenšená pod 1 px na jednotku,
 * - vyhrazené místo pro nápovědu na výšku, do kterého tečky patří (#56),
 * - rámeček průvodce obepíná zvýrazněnou řadu (#49 AC5, #60),
 * - tečky nápovědy těsně vedle sebe (#43: plochy se smí dotýkat).
 * Okénko na psaní 180 px na nejnižších telefonech (#54) hlídá
 * `phoneLandscapeLayout.test.ts`, není to ťukací plocha.
 */

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import {
  isPortraitLayout,
  layoutDeviceGuideStep,
  layoutDeviceHint,
  layoutDeviceHintButton,
  layoutDeviceScreen,
  layoutDeviceSettingsPanel,
  layoutDeviceWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import type {
  DeviceScreenLayout,
  DeviceWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { slotWidth } from '../../../src/games/counting/logic/screenLayout';
import type { ButtonSlot } from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber, OperationMode } from '../../../src/games/counting/logic/settings';
import type { GuideStep } from '../../../src/games/counting/logic/setupGuide';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { cssBoxOf, panelCssPlacement } from './parentPanelCss';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  box,
  freeAreaOf,
  gearCornerOf,
  toCss,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, Placement, TestWindow } from '../../shared/viewportFixtures';

export const RANGES: readonly MaxNumber[] = [5, 10, 20];
export const OPERATIONS: readonly OperationMode[] = ['plus', 'minus', 'mixed'];
export const GUIDE_STEPS: readonly GuideStep[] = [1, 2, 3, 4];

export type Mode = 'číselník' | 'psaní';
export const MODES: readonly Mode[] = ['číselník', 'psaní'];

/** Prázdná řada hvězdiček i plná řada při oslavě po deseti. */
export const STAR_COUNTS: readonly number[] = [0, STARS_PER_SET];

/** Okna s rozložením iPadu: iPad na šířku (#54 AC5) a okno těsně nad hranicí telefonu (#54 AC6). */
export const TABLET_WINDOWS: readonly TestWindow[] = [...IPAD_WINDOWS, JUST_ABOVE_LIMIT];

/** Telefon na výšku včetně okna těsně pod hranicí a úzkého iPadu ve Split View (#56). */
export const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

/** Všechna okna, ve kterých se Počítání hraje na iPadu nebo na telefonu. */
export const PLAY_WINDOWS: readonly TestWindow[] = [
  ...TABLET_WINDOWS,
  ...PHONE_WINDOWS,
  ...PORTRAIT_WINDOWS,
];

/** Ťukací tečka nápovědy na telefonu smí mít 48 px místo 64 px (#54, #56 AC5). */
const PHONE_DOT_HIT_SIDE = 48;

/**
 * Tlačítko nápovědy smí mít 60 px místo 64 px jen v okně 932×500 u číselníku
 * do 20 (#84, rozhodnutí 2026-11-07): plocha je tam zmenšená pod 1 px na
 * herní jednotku a tlačítko měří 59,83 px, což vlastník schválil jako
 * „60 px“. Hranice je proto 59,8 px, ne zaokrouhlených 60. Mezera 8 px od
 * číselníku platí dál.
 */
const NARROW_IPAD_HINT_BUTTON_SIDE = 59.8;

/** Platí pro tento případ výjimka 60 px pro tlačítko nápovědy? */
function hasNarrowIpadHintButton(testCase: PlayCase): boolean {
  return (
    testCase.window === JUST_ABOVE_LIMIT &&
    testCase.maxNumber === 20 &&
    testCase.mode === 'číselník'
  );
}

/** Roh kolečka a domečku na telefonu na šířku: 88 × 88 px (#54, #68). */
const LANDSCAPE_CORNER_SIZE = 88;

/** Odstup od plochy kolečka a domečku na výšku (#56, #68). */
const PORTRAIT_CORNER_GAP = 4;

/** Roh kolečka v nastavení a průvodci na telefonu: x > W − 80 a y < 80 (#59 AC2). */
const PANEL_GEAR_CORNER = 80;

/** Ťukací plochy nastavení a průvodce na telefonu jsou aspoň 8 px od okraje (#59 AC2, #60). */
const PANEL_TAP_EDGE = 8;

/** Pravý horní roh plochy iPadu, kam nesmí žádný herní prvek (#44 AC3), v herních jednotkách. */
const TABLET_SETTINGS_CORNER: Box = { left: 982, right: 1024, top: 11, bottom: 82 };

// ---------------------------------------------------------------------------
// Příklady a vzorek nápověd
// ---------------------------------------------------------------------------

export function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

export function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

export function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

function includesPlus(operations: OperationMode): boolean {
  return operations !== 'minus';
}

function includesMinus(operations: OperationMode): boolean {
  return operations !== 'plus';
}

/** Všechny příklady, které v rozsahu a s druhem příkladů mohou přijít. */
export function allProblems(maxNumber: number, operations: OperationMode = 'mixed'): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    if (includesPlus(operations)) {
      for (let second = 0; first + second <= maxNumber; second += 1) {
        problems.push(plus(first, second));
      }
    }
    if (includesMinus(operations)) {
      for (let second = 0; second <= first; second += 1) {
        problems.push(minus(first, second));
      }
    }
  }
  return problems;
}

/** Příklady, u kterých se po 2. chybě ukáže aspoň jedna tečka. */
export function problemsWithDots(
  maxNumber: number,
  operations: OperationMode = 'mixed',
): Problem[] {
  return allProblems(maxNumber, operations).filter((problem) => hintDotGroups(problem).length > 0);
}

const DOTS_PER_ROW = 5;

function totalHintRows(problem: Problem): number {
  return hintDotGroups(problem).reduce((rows, dots) => rows + Math.ceil(dots / DOTS_PER_ROW), 0);
}

/** Sčítání se dvěma skupinkami, u kterého nápověda zabere nejvíc řad (první a poslední takové). */
function mostRowsProblems(maxNumber: number): Problem[] {
  const twoGroups = problemsWithDots(maxNumber, 'plus').filter(
    (problem) => hintDotGroups(problem).length === 2,
  );
  const mostRows = Math.max(...twoGroups.map(totalHintRows));
  const withMostRows = twoGroups.filter((problem) => totalHintRows(problem) === mostRows);
  return [withMostRows[0], withMostRows[withMostRows.length - 1]].filter(
    (problem): problem is Problem => problem !== undefined,
  );
}

/**
 * Okrajové a typické příklady s nápovědou na telefonu (#54, #56, #68):
 * nejmenší nápověda, jedna velká skupinka, dvě skupinky, největší součet
 * nerovnoměrně i napůl, celá řada pěti teček a jedna navíc, nejvíc řad,
 * dvě skupinky, které se na úzkém telefonu vedle sebe nevejdou (6 + 4,
 * 4 + 6, 7 + 3, 2 + 6), a odčítání. Rozložení závisí jen na skupinkách
 * teček, proto stačí vzorek místo všech příkladů.
 */
export function sampleHintProblems(
  maxNumber: MaxNumber,
  operations: OperationMode = 'mixed',
): Problem[] {
  const half = Math.floor(maxNumber / 2);
  const plusCandidates = [
    plus(1, 0),
    plus(0, maxNumber),
    plus(maxNumber, 0),
    plus(1, 1),
    plus(1, maxNumber - 1),
    plus(maxNumber - 1, 1),
    plus(half, maxNumber - half),
    plus(DOTS_PER_ROW, 0),
    plus(DOTS_PER_ROW + 1, 0),
    plus(DOTS_PER_ROW, DOTS_PER_ROW),
    plus(6, 4),
    plus(4, 6),
    plus(7, 3),
    plus(2, 6),
    ...mostRowsProblems(maxNumber),
  ];
  const minusCandidates = [
    minus(1, 0),
    minus(1, 1),
    minus(DOTS_PER_ROW, 0),
    minus(DOTS_PER_ROW + 1, 2),
    minus(maxNumber, 1),
    minus(maxNumber, maxNumber),
  ];
  const candidates = [
    ...(includesPlus(operations) ? plusCandidates : []),
    ...(includesMinus(operations) ? minusCandidates : []),
  ];
  const inRange = candidates.filter(
    (problem) =>
      problem.first <= maxNumber &&
      problem.second >= 0 &&
      (problem.operation === 'minus' || problem.first + problem.second <= maxNumber),
  );
  const unique = new Map(inRange.map((problem) => [problemName(problem), problem]));
  return [...unique.values()];
}

/** Na iPadu se nápověda ověřuje na všech příkladech (#43, #44), na telefonu na vzorku. */
function hintProblemsFor(
  area: GameArea,
  maxNumber: MaxNumber,
  operations: OperationMode,
): Problem[] {
  return area.mode === 'tablet'
    ? problemsWithDots(maxNumber, operations)
    : sampleHintProblems(maxNumber, operations);
}

// ---------------------------------------------------------------------------
// Herní obrazovka
// ---------------------------------------------------------------------------

/** Zadání jedné herní obrazovky. */
export interface PlayCase {
  readonly window: TestWindow;
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
  readonly operations: OperationMode;
  readonly starCount: number;
  /** Příklad, u kterého je po 2. chybě vidět nápověda; `null` = bez nápovědy. */
  readonly hint: Problem | null;
}

type PlayLayout = DeviceScreenLayout | DeviceWritingLayout;

function isWriting(layout: PlayLayout): layout is DeviceWritingLayout {
  return 'writingAreas' in layout;
}

/** Krátký název okna do zprávy: „390×844“. */
export function windowSize(window: TestWindow): string {
  return `${window.width}×${window.height}`;
}

/** Popis případu do zprávy: „390×844 iPhone…, do 20, psaní, mixed, 10 hvězdiček, nápověda 7 + 3“. */
export function playLabel(testCase: PlayCase): string {
  const hint = testCase.hint ? `, nápověda ${problemName(testCase.hint)}` : ', bez nápovědy';
  return [
    `${windowSize(testCase.window)} (${testCase.window.name})`,
    `do ${testCase.maxNumber}`,
    testCase.mode,
    testCase.operations,
    `${testCase.starCount} hvězdiček${hint}`,
  ].join(', ');
}

export function playLayoutOf(testCase: PlayCase): { area: GameArea; layout: PlayLayout } {
  const area = gameAreaFor(viewportOf(testCase.window));
  const groups = testCase.hint ? hintDotGroups(testCase.hint) : [];
  const { maxNumber, starCount, operations } = testCase;
  const layout =
    testCase.mode === 'číselník'
      ? layoutDeviceScreen(area, maxNumber + 1, starCount, groups, operations)
      : layoutDeviceWritingScreen(area, maxNumber, starCount, groups, operations);
  return { area, layout };
}

function slotItem(name: string, slot: ButtonSlot, area: GameArea): LayoutItem {
  return {
    name,
    box: toCss(box(slot.x, slot.y, slotWidth(slot), slot.size), area),
    tappable: true,
  };
}

/** Plocha pro prst u kolečka nastavení v CSS px okna (#55). */
export function gearHitOf(window: TestWindow): Box {
  const gear = settingsGearFor(viewportOf(window));
  const right = window.width - gear.right;
  return { left: right - gear.hitSize, right, top: gear.top, bottom: gear.top + gear.hitSize };
}

/** Plocha pro prst u domečku v CSS px okna (#68). */
export function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

/**
 * Kde je na obrazovce vidět hra: volná plocha okna (bez výřezu a lišty)
 * a zároveň herní plocha, mimo kterou plátno nic nenakreslí.
 */
export function visibleAreaOf(window: TestWindow, area: GameArea): Box {
  const free = freeAreaOf(window);
  const plane = toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
  return {
    left: Math.max(free.left, plane.left),
    right: Math.min(free.right, plane.right),
    top: Math.max(free.top, plane.top),
    bottom: Math.min(free.bottom, plane.bottom),
  };
}

function grow(b: Box, by: number): Box {
  return { left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by };
}

/** Kolečko a domeček s místem, do kterého nesmí žádný herní prvek (#44, #54, #56, #68). */
function cornerItems(window: TestWindow, area: GameArea): LayoutItem[] {
  if (area.mode === 'phoneLandscape') {
    const free = freeAreaOf(window);
    return [
      { name: 'roh kolečka', box: gearCornerOf(window), reserved: true },
      {
        name: 'roh domečku',
        box: {
          left: free.left,
          right: free.left + LANDSCAPE_CORNER_SIZE,
          top: free.top,
          bottom: free.top + LANDSCAPE_CORNER_SIZE,
        },
        reserved: true,
      },
    ];
  }
  if (area.mode === 'phonePortrait') {
    return [
      { name: 'kolečko', box: gearHitOf(window), tappable: true },
      { name: 'domeček', box: homeHitOf(window), tappable: true },
      { name: 'okolí kolečka', box: grow(gearHitOf(window), PORTRAIT_CORNER_GAP), reserved: true },
      { name: 'okolí domečku', box: grow(homeHitOf(window), PORTRAIT_CORNER_GAP), reserved: true },
    ];
  }
  return [
    { name: 'roh kolečka', box: toCss(TABLET_SETTINGS_CORNER, area), reserved: true },
    { name: 'domeček', box: homeHitOf(window), reserved: true },
  ];
}

function hintItems(testCase: PlayCase, layout: PlayLayout, area: GameArea): LayoutItem[] {
  if (!testCase.hint) {
    return [];
  }
  const countable = layout.hintDotsCountable;
  const size = countable ? layout.hintDotHitSize : layout.hintStyle.dotSize;
  const phone = area.mode !== 'tablet';
  return layoutDeviceHint(layout, hintDotGroups(testCase.hint)).map((dot, index) => ({
    name: `tečka ${index + 1}`,
    box: toCss(box(dot.x, dot.y, size, size), area),
    tappable: countable,
    // #54 a #56 AC5: na telefonu má ťukací tečka 48 px; na iPadu 64 herních jednotek (#43 AC7).
    minSide: phone ? PHONE_DOT_HIT_SIDE : MIN_TAP_SIDE * area.scale,
  }));
}

/** Plocha kolečka nebo domečku a jejich vlastní okolí 4 px. */
const SURROUNDING_OF: Readonly<Record<string, string>> = {
  kolečko: 'okolí kolečka',
  domeček: 'okolí domečku',
};

function isOwnSurrounding(button: LayoutItem, surrounding: LayoutItem): boolean {
  return SURROUNDING_OF[button.name] === surrounding.name;
}

/** Tečka nápovědy (#43). */
export function isDot(item: LayoutItem): boolean {
  return item.name.startsWith('tečka ');
}

/** Herní obrazovka jako obrazovka pro pravidla: všechno, co hra nakreslí, v CSS px okna. */
export function playScene(testCase: PlayCase): LayoutScene {
  const { area, layout } = playLayoutOf(testCase);
  const css = (b: Box): Box => toCss(b, area);
  const items: LayoutItem[] = [
    ...cornerItems(testCase.window, area),
    ...layout.stars.map((star, index) => ({
      name: `hvězdička ${index + 1}`,
      box: css(box(star.x, star.y, layout.starSize, layout.starSize)),
    })),
    {
      name: 'příklad',
      box: css(
        box(
          layout.problem.x,
          layout.problem.y,
          layout.problemSize.width,
          layout.problemSize.height,
        ),
      ),
    },
  ];
  if (isPortraitLayout(layout)) {
    items.push({ name: 'místo pro nápovědu', box: css(layout.hintRegion) });
  }
  if (isWriting(layout)) {
    layout.writingAreas.forEach((slot, index) =>
      items.push({
        name: `okénko ${index + 1}`,
        box: css(box(slot.x, slot.y, slot.width, slot.height)),
      }),
    );
    items.push(slotItem('smazání', layout.clearButton, area));
    items.push(slotItem('✓', layout.confirmButton, area));
  } else {
    layout.answerButtons.forEach((slot, index) =>
      items.push(slotItem(`tlačítko ${index}`, slot, area)),
    );
  }
  items.push(...hintItems(testCase, layout, area));
  return {
    label: playLabel(testCase),
    free: visibleAreaOf(testCase.window, area),
    items,
    // #56: tečky nápovědy na výšku leží ve vyhrazeném místě pro nápovědu.
    // Kolečko a domeček leží ve svém okolí (#56, #68).
    mayOverlap: (first, second) =>
      ([first, second].some((item) => item.name === 'místo pro nápovědu') &&
        [first, second].some(isDot)) ||
      isOwnSurrounding(first, second) ||
      isOwnSurrounding(second, first),
    // #43: plochy teček se smí dotýkat, jen nepřekrývat.
    gapExempt: (first, second) => isDot(first) && isDot(second),
  };
}

/** Název tlačítka nápovědy ve zprávách pravidel (#84). */
export const HINT_BUTTON_NAME = 'tlačítko nápovědy';

/**
 * Nový příklad `testCase.hint` s tlačítkem nápovědy, ještě bez teček (#84).
 * Rozložení je stejné jako s ukázanou nápovědou (`playScene`): na telefonu
 * na šířku má nápověda místo hned od začátku (rozhodnutí 2026-11-07,
 * varianta A) a tlačítko leží tam, kde se pak ukážou tečky (otázka 2,
 * varianta a). Tečky ve scéně nejsou, místo nich je tlačítko. Když pro
 * příklad tlačítko není (0 + 0, 0 − 0, AC5), ve scéně chybí.
 */
export function hintButtonScene(testCase: PlayCase): LayoutScene {
  if (!testCase.hint) {
    throw new Error(`${playLabel(testCase)}: tlačítko nápovědy potřebuje příklad`);
  }
  const { area, layout } = playLayoutOf(testCase);
  const withDots = playScene(testCase);
  const button = layoutDeviceHintButton(layout, hintDotGroups(testCase.hint));
  const items = withDots.items.filter((item) => !isDot(item));
  if (button) {
    const item = slotItem(HINT_BUTTON_NAME, button, area);
    // #84, rozhodnutí 2026-11-07: v okně 932×500 u číselníku do 20 stačí 60 px.
    items.push(
      hasNarrowIpadHintButton(testCase) ? { ...item, minSide: NARROW_IPAD_HINT_BUTTON_SIDE } : item,
    );
  }
  const isButton = (item: LayoutItem): boolean => item.name === HINT_BUTTON_NAME;
  return {
    ...withDots,
    label: `${withDots.label}, tlačítko nápovědy`,
    items,
    // Na výšku leží tlačítko ve vyhrazeném místě pro nápovědu jako tečky (#56).
    mayOverlap: (first, second) =>
      (withDots.mayOverlap?.(first, second) ?? false) ||
      ([first, second].some(isButton) &&
        [first, second].some((item) => item.name === 'místo pro nápovědu')),
  };
}

/** Všechna zadání herní obrazovky bez nápovědy pro dané ovládání. */
export function playCasesWithoutHint(
  mode: Mode,
  windows: readonly TestWindow[] = PLAY_WINDOWS,
): PlayCase[] {
  return windows.flatMap((window) =>
    RANGES.flatMap((maxNumber) =>
      OPERATIONS.flatMap((operations) =>
        STAR_COUNTS.map((starCount) => ({
          window,
          maxNumber,
          mode,
          operations,
          starCount,
          hint: null,
        })),
      ),
    ),
  );
}

/** Všechna zadání herní obrazovky s nápovědou (číselník i psaní). */
export function playCasesWithHint(windows: readonly TestWindow[] = PLAY_WINDOWS): PlayCase[] {
  return windows.flatMap((window) => {
    const area = gameAreaFor(viewportOf(window));
    // Druh příkladů mění rozložení jen na výšku (vyhrazené místo, #56 AC5).
    const operationsList: readonly OperationMode[] =
      area.mode === 'phonePortrait' ? OPERATIONS : ['mixed'];
    return RANGES.flatMap((maxNumber) =>
      MODES.flatMap((mode) =>
        operationsList.flatMap((operations) =>
          STAR_COUNTS.flatMap((starCount) =>
            hintProblemsFor(area, maxNumber, operations).map((hint) => ({
              window,
              maxNumber,
              mode,
              operations,
              starCount,
              hint,
            })),
          ),
        ),
      ),
    );
  });
}

// ---------------------------------------------------------------------------
// Nastavení a průvodce
// ---------------------------------------------------------------------------

/** Okna, kde má nastavení a průvodce rozložení iPadu nebo telefonu (zmenšené zobrazení hlídají pevné body). */
export const PANEL_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  ...PHONE_WINDOWS,
  ...PORTRAIT_WINDOWS,
];

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function panelItem(
  name: string,
  slot: CenteredSlot,
  placement: Placement,
  phone: boolean,
  tappable: boolean,
): LayoutItem {
  return {
    name,
    box: cssBoxOf(slot, placement),
    tappable,
    ...(phone && tappable ? { minEdge: PANEL_TAP_EDGE } : {}),
  };
}

function panelGearCorner(window: TestWindow): LayoutItem {
  const free = freeAreaOf(window);
  return {
    name: 'roh kolečka',
    box: {
      left: free.right - PANEL_GEAR_CORNER,
      right: free.right,
      top: free.top,
      bottom: free.top + PANEL_GEAR_CORNER,
    },
    reserved: true,
  };
}

/** Nastavení otevřené kolečkem jako obrazovka pro pravidla. */
export function settingsScene(window: TestWindow): LayoutScene {
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutDeviceSettingsPanel(area);
  const placement = panelCssPlacement(area, layout.placement);
  const phone = area.mode !== 'tablet';
  const items: LayoutItem[] = layout.rows.flatMap((row) => [
    panelItem(`popisek ${row.label.text}`, row.label, placement, phone, false),
    ...row.options.map((option) =>
      panelItem(`volba ${String(option.value)}`, option, placement, phone, true),
    ),
  ]);
  const { confirm } = layout;
  items.push(
    panelItem(
      '✓',
      { ...confirm, width: confirm.size, height: confirm.size },
      placement,
      phone,
      true,
    ),
  );
  if (phone) {
    items.push(panelGearCorner(window));
  }
  return {
    label: `${windowSize(window)} (${window.name}), nastavení`,
    free: visibleAreaOf(window, area),
    items,
  };
}

/** Jeden krok průvodce jako obrazovka pro pravidla. */
export function guideScene(window: TestWindow, step: GuideStep): LayoutScene {
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutDeviceGuideStep(area, step);
  const placement = panelCssPlacement(area, layout.placement);
  const phone = area.mode !== 'tablet';
  const focusedRow = step === 4 ? null : layout.rows[step - 1];
  const focusedNames = new Set<string>();
  const items: LayoutItem[] = layout.rows.flatMap((row) => {
    const rowItems = [
      panelItem(`popisek ${row.label.text}`, row.label, placement, phone, false),
      ...row.options.map((option) =>
        panelItem(`volba ${String(option.value)}`, option, placement, phone, true),
      ),
    ];
    if (row === focusedRow) {
      rowItems.forEach((item) => focusedNames.add(item.name));
    }
    return rowItems;
  });
  items.push(panelItem('rada', layout.message, placement, phone, false));
  items.push(panelItem('ukazatel kroku', layout.indicator, placement, phone, false));
  if (layout.back) {
    items.push(panelItem('Zpět', layout.back, placement, phone, true));
  }
  items.push(panelItem('reproduktor', layout.speaker, placement, phone, true));
  items.push(panelItem(step === 4 ? 'Začít hrát' : 'Další', layout.right, placement, phone, true));
  if (layout.frame) {
    items.push({
      name: 'rámeček',
      box: cssBoxOf(layout.frame, placement),
      // #49 AC5: na iPadu je rámeček 4 herní jednotky od okraje plochy.
      ...(phone ? {} : { minEdge: 4 * placement.scale }),
    });
  }
  if (phone) {
    items.push(panelGearCorner(window));
  }
  return {
    label: `${windowSize(window)} (${window.name}), průvodce krok ${step}`,
    free: visibleAreaOf(window, area),
    items,
    // Rámeček je jen obrys kolem zvýrazněné řady (#49 AC5, #60).
    mayOverlap: (first, second) =>
      [first, second].some((item) => item.name === 'rámeček') &&
      [first, second].some((item) => focusedNames.has(item.name)),
  };
}

export function guideScenes(windows: readonly TestWindow[] = PANEL_WINDOWS): LayoutScene[] {
  return windows.flatMap((window) => GUIDE_STEPS.map((step) => guideScene(window, step)));
}

export function settingsScenes(windows: readonly TestWindow[] = PANEL_WINDOWS): LayoutScene[] {
  return windows.map((window) => settingsScene(window));
}

/**
 * Všechny obrazovky Počítání v zadaných oknech (#78 AC3): hra s číselníkem,
 * psaní, nápověda, nastavení a průvodce, podle názvu obrazovky.
 */
export function countingScenesIn(
  windows: readonly TestWindow[],
): Readonly<Record<string, () => LayoutScene[]>> {
  return {
    'hra s číselníkem': () => playCasesWithoutHint('číselník', windows).map(playScene),
    'psaní prstem': () => playCasesWithoutHint('psaní', windows).map(playScene),
    'nápověda po 2. chybě': () => playCasesWithHint(windows).map(playScene),
    'nastavení pro rodiče': () => settingsScenes(windows),
    'průvodce nastavením': () => guideScenes(windows),
  };
}
