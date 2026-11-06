import { describe, expect, it } from 'vitest';

import {
  LAYOUT_RULES,
  edgeViolations,
  fitViolations,
  overlapViolations,
  tapGapViolations,
  tapSizeViolations,
} from '../../shared/layoutRules';
import type { LayoutItem, LayoutRule, LayoutScene } from '../../shared/layoutRules';
import {
  guideScenes,
  playCasesWithHint,
  playCasesWithoutHint,
  playScene,
  settingsScenes,
} from './layoutScenes';
import { PHONE_PORTRAIT_WINDOWS } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #81: společná pravidla rozložení (`tests/shared/layoutRules.ts`)
 * na každé obrazovce Počítání. Každé pravidlo má na každé obrazovce jeden
 * test, který v cyklu projde všechna okna (iPad, telefon na šířku i na
 * výšku, hranice), rozsahy, ovládání, druhy příkladů, nápovědy a počty
 * hvězdiček (AC1). Jak se obrazovky skládají a jaké mají schválené
 * výjimky, popisuje `layoutScenes.ts`.
 *
 * Pravidla nahrazují dřívější testy „nic se nepřekrývá“, „vejde se“,
 * „64 px“, „8 px“ a „4 px od okraje“ v souborech rozložení Počítání
 * (#43, #44, #45, #49, #51, #54, #56, #59, #60, #68).
 */

type ScreenName = 'hra' | 'psaní' | 'nápověda' | 'nastavení' | 'průvodce';

const SCREEN_TITLES: Readonly<Record<ScreenName, string>> = {
  hra: 'hra s číselníkem',
  psaní: 'psaní prstem',
  nápověda: 'nápověda po 2. chybě (číselník i psaní)',
  nastavení: 'nastavení pro rodiče',
  průvodce: 'průvodce nastavením',
};

const SCREEN_BUILDERS: Readonly<Record<ScreenName, () => LayoutScene[]>> = {
  hra: () => playCasesWithoutHint('číselník').map(playScene),
  psaní: () => playCasesWithoutHint('psaní').map(playScene),
  nápověda: () => playCasesWithHint().map(playScene),
  nastavení: settingsScenes,
  průvodce: guideScenes,
};

const SCREENS = Object.keys(SCREEN_TITLES) as ScreenName[];

const sceneCache = new Map<ScreenName, LayoutScene[]>();

/** Obrazovky se spočítají jednou, všechna pravidla je pak jen čtou. */
function scenesOf(screen: ScreenName): LayoutScene[] {
  const cached = sceneCache.get(screen);
  if (cached) {
    return cached;
  }
  const scenes = SCREEN_BUILDERS[screen]();
  sceneCache.set(screen, scenes);
  return scenes;
}

for (const screen of SCREENS) {
  describe(`AC1: ${SCREEN_TITLES[screen]}`, () => {
    for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
      it(`${ruleName} ve všech oknech, rozsazích, ovládáních, nápovědách i počtech hvězdiček`, () => {
        for (const scene of scenesOf(screen)) {
          expect(rule(scene), scene.label).toEqual([]);
        }
      });
    }
  });
}

/**
 * Kolik různých kombinací (okno, rozsah, ovládání, druh příkladů, počet
 * hvězdiček, nápověda, krok průvodce) pravidlo na obrazovce hlídalo před
 * #81: počet dřívějších testovacích případů (řádků parametrizace), které
 * pravidlo nahrazuje, sečtený přes soubory. Vnitřní cykly se nepočítaly.
 * Dřívější testy na ploše 1024 × 768 se počítají jako jedno okno.
 * Spočítáno jednorázově z testů před #81.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, Readonly<Record<ScreenName, number>>>> = {
  'vejde se do okna i mimo výřez': {
    hra: 84,
    psaní: 87,
    nápověda: 1596,
    nastavení: 15,
    průvodce: 60,
  },
  'nic se nepřekrývá': { hra: 93, psaní: 93, nápověda: 3936, nastavení: 15, průvodce: 60 },
  'ťukací plocha aspoň 64 px': { hra: 45, psaní: 48, nápověda: 680, nastavení: 15, průvodce: 60 },
  'mezera mezi plochami aspoň 8 px': {
    hra: 45,
    psaní: 45,
    nápověda: 336,
    nastavení: 14,
    průvodce: 56,
  },
  'aspoň 4 px od okraje': { hra: 48, psaní: 48, nápověda: 1632, nastavení: 14, průvodce: 56 },
};

describe('AC2: pravidla projdou aspoň tolik kombinací jako testy před #81', () => {
  for (const ruleName of Object.keys(LAYOUT_RULES)) {
    it(`${ruleName}: na každé obrazovce aspoň tolik různých kombinací jako dřív`, () => {
      const today = TODAY_COMBINATIONS[ruleName];
      expect(today, ruleName).toBeDefined();
      for (const screen of SCREENS) {
        const labels = scenesOf(screen).map((scene) => scene.label);
        // Každá obrazovka je jiná kombinace, žádná se nepočítá dvakrát.
        expect(new Set(labels).size, `${screen}: různé kombinace`).toBe(labels.length);
        expect(labels.length, screen).toBeGreaterThanOrEqual(today?.[screen] ?? Infinity);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// AC3: zpráva při selhání
// ---------------------------------------------------------------------------

const IPHONE_PORTRAIT = PHONE_PORTRAIT_WINDOWS[0] as TestWindow;

/** Dnešní obrazovka 390×844 s psaním do 20, bez nápovědy, s plnou řadou hvězdiček. */
function iphoneWritingScene(): LayoutScene {
  return playScene({
    window: IPHONE_PORTRAIT,
    maxNumber: 20,
    mode: 'psaní',
    operations: 'mixed',
    starCount: 10,
    hint: null,
  });
}

function withItem(
  scene: LayoutScene,
  name: string,
  change: (item: LayoutItem) => LayoutItem,
): LayoutScene {
  expect(
    scene.items.some((item) => item.name === name),
    `${scene.label}: chybí ${name}`,
  ).toBe(true);
  return {
    ...scene,
    items: scene.items.map((item) => (item.name === name ? change(item) : item)),
  };
}

function moved(item: LayoutItem, dx: number, dy: number): LayoutItem {
  const { box } = item;
  return {
    ...item,
    box: { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy },
  };
}

function shrunk(item: LayoutItem, to: number): LayoutItem {
  const { box } = item;
  return { ...item, box: { ...box, right: box.left + to, bottom: box.top + to } };
}

describe('AC3: zpráva o porušeném pravidle řekne, kde se co stalo', () => {
  it('úmyslně chybné rozložení 390×844 do 20 s psaním: každé pravidlo uvede okno, rozsah, ovládání a prvek', () => {
    const scene = iphoneWritingScene();
    const confirm = scene.items.find((item) => item.name === '✓');
    const clear = scene.items.find((item) => item.name === 'smazání');
    if (!confirm || !clear) {
      throw new Error(`${scene.label}: chybí ✓ nebo smazání`);
    }
    const broken: Array<[string, LayoutRule, LayoutScene, string]> = [
      [
        'okénko pod spodním okrajem',
        fitViolations,
        withItem(scene, 'okénko 2', (item) => moved(item, 0, 1000)),
        'okénko 2 přesahuje spodní okraj',
      ],
      [
        'okénko na ✓',
        overlapViolations,
        withItem(scene, 'okénko 2', (item) => ({ ...item, box: confirm.box })),
        'okénko 2 se překrývá s ✓',
      ],
      [
        'malé ✓',
        tapSizeViolations,
        withItem(scene, '✓', (item) => shrunk(item, 40)),
        '✓ má jen 40 px × 40 px',
      ],
      [
        'smazání těsně u ✓',
        tapGapViolations,
        withItem(scene, 'smazání', (item) =>
          moved(item, confirm.box.left - 2 - clear.box.right, confirm.box.top - clear.box.top),
        ),
        'mezi smazání a ✓ je jen 2 px',
      ],
      [
        'okénko u okraje',
        edgeViolations,
        withItem(scene, 'okénko 1', (item) => moved(item, scene.free.left + 1 - item.box.left, 0)),
        'okénko 1 je blíž než 4 px k okraji',
      ],
    ];

    for (const [what, rule, brokenScene, expectedPart] of broken) {
      const messages = rule(brokenScene);
      const message = messages.find((text) => text.includes(expectedPart)) ?? '';
      expect(message, `${what}: ${messages.join(' | ')}`).toContain(expectedPart);
      for (const part of ['390×844', 'do 20', 'psaní']) {
        expect(message, `${what}: ${part}`).toContain(part);
      }
    }
  });
});
