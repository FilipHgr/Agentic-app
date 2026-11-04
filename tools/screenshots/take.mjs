/* global console, process, document, localStorage */
// document a localStorage používají jen funkce, které Playwright spouští ve stránce.
/**
 * Snímky obrazovky hry pro kontrolu před předáním úkolu.
 *
 * Spuštění z kořene repa (po `npm run build`):
 *   node tools/screenshots/take.mjs [složka]
 *
 * Udělá snímky na iPadu na šířku, na telefonu na výšku a na telefonu na šířku
 * (#54: 844×340 iPhone s výřezem, 800×300 Samsung) v těchto stavech:
 * průvodce nastavením při prvním spuštění (všechny kroky), začátek hry, nápověda po dvou chybách, počítání teček ťukáním,
 * otevřené nastavení pro rodiče,
 * okénka na psaní (#41, #42) a rozpoznané napsané číslo. Na telefonu na
 * šířku navíc otočení na výšku a zpět a oslava po deseti hvězdičkách.
 * Výřez iPhonu Playwright neumí, nasimuluje se přes `#safe-area-probe`
 * a na snímku je černě. Místa pro ťuknutí na telefonu se berou ze
 * skutečného rozložení (`src/logic/deviceLayout.ts` přes Vite).
 * Použije WebKit (jako Safari), když je k dispozici, jinak Chromium a řekne to.
 * Playwright není závislost projektu, musí být nainstalovaný v systému.
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { createServer, preview } from 'vite';

const require = createRequire(import.meta.url);
const outputDir = process.argv[2] ?? 'snimky';

/** Herní plocha má pevně 1024 × 768 a na obrazovce se jen zmenší nebo zvětší. */
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;

/** Tlačítko 0 na číselníku 0–10 (výchozí nastavení) v herních souřadnicích. */
const BUTTON_ZERO = { x: 112, y: 514 };

/** Průvodce (#49): pravé tlačítko (Další / Začít hrát). */
const GUIDE_RIGHT_BUTTON = { x: 880, y: 716 };

/** Volba „psaní“ a ✓ v nastavení pro rodiče (rozložení z #47). */
const SETTINGS_WRITING = { x: 642, y: 497 };
const SETTINGS_CONFIRM = { x: 512, y: 669 };

/**
 * Číslo 17 napsané do dvou okének při rozsahu 10 (#42): jednička do okénka
 * desítek (střed 360, 604), sedmička do okénka jednotek (střed 664, 604).
 */
const ONE = [
  { x: 340, y: 500 },
  { x: 370, y: 470 },
  { x: 370, y: 720 },
];
const SEVEN = [
  { x: 574, y: 514 },
  { x: 754, y: 514 },
  { x: 614, y: 704 },
];

const DEVICES = [
  { name: 'ipad-sirka', viewport: { width: 1180, height: 820 }, scale: 2 },
  { name: 'telefon-vyska', viewport: { width: 390, height: 844 }, scale: 3 },
];

const NO_NOTCH = { top: 0, right: 0, bottom: 0, left: 0 };

/** Telefon na šířku (#54): okno v CSS px a výřez s lištou domů. */
const PHONE_DEVICES = [
  {
    name: 'iphone-sirka',
    viewport: { width: 844, height: 340 },
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 },
    scale: 3,
  },
  { name: 'samsung-sirka', viewport: { width: 800, height: 300 }, safeArea: NO_NOTCH, scale: 3 },
];

/** Okénka na iPadu, ze kterých jsou tahy ONE a SEVEN (střed a strana). */
const IPAD_TENS_BOX = { x: 360, y: 604, side: 280 };
const IPAD_ONES_BOX = { x: 664, y: 604, side: 280 };

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('Playwright není nainstalovaný, snímky nejdou udělat.');
    process.exit(1);
  }
}

/** WebKit je stejný engine jako Safari na iPadu; když chybí, použije se Chromium. */
async function launchBrowser(playwright) {
  try {
    return { browser: await playwright.webkit.launch(), engine: 'WebKit' };
  } catch {
    return { browser: await playwright.chromium.launch(), engine: 'Chromium (WebKit chybí)' };
  }
}

/** Převede herní souřadnice na souřadnice stránky. */
async function toPage(page, point) {
  const box = await page.locator('canvas').boundingBox();
  return {
    x: box.x + (point.x / GAME_WIDTH) * box.width,
    y: box.y + (point.y / GAME_HEIGHT) * box.height,
  };
}

/** Ťukne na místo zadané v herních souřadnicích. */
async function tapGame(page, point) {
  const { x, y } = await toPage(page, point);
  await page.mouse.click(x, y);
}

/** Táhne prstem přes body v herních souřadnicích, jako když dítě píše. */
async function drawGame(page, points) {
  const [first, ...rest] = points;
  const start = await toPage(page, first);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const point of rest) {
    const next = await toPage(page, point);
    await page.mouse.move(next.x, next.y, { steps: 12 });
  }
  await page.mouse.up();
}

async function shootDevice(browser, url, device) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(url);
  await page.waitForTimeout(1500);
  // Nový prohlížeč nemá uložené nastavení: průvodce nastavením (#49).
  await page.screenshot({ path: join(outputDir, `${device.name}-0b-pruvodce-rozsah.png`) });
  await tapGame(page, GUIDE_RIGHT_BUTTON);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outputDir, `${device.name}-0c-pruvodce-priklady.png`) });
  await tapGame(page, GUIDE_RIGHT_BUTTON);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outputDir, `${device.name}-0d-pruvodce-odpoved.png`) });
  await tapGame(page, GUIDE_RIGHT_BUTTON);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outputDir, `${device.name}-0e-pruvodce-shrnuti.png`) });
  await tapGame(page, GUIDE_RIGHT_BUTTON);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outputDir, `${device.name}-1-zacatek.png`) });

  // Dvě chyby za sebou ukážou nápovědu (výjimka: příklad s výsledkem 0).
  await tapGame(page, BUTTON_ZERO);
  await page.waitForTimeout(500);
  await tapGame(page, BUTTON_ZERO);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outputDir, `${device.name}-2-napoveda.png`) });

  // Počítání teček ťukáním (#43): pár ťuknutí do řady teček nápovědy.
  for (let x = 300; x <= 620; x += 64) {
    await tapGame(page, { x, y: 345 });
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outputDir, `${device.name}-2b-pocitani.png`) });

  const gear = await page.locator('#settings-button').boundingBox();
  await page.mouse.move(gear.x + gear.width / 2, gear.y + gear.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outputDir, `${device.name}-3-nastaveni.png`) });

  await tapGame(page, SETTINGS_WRITING);
  await page.waitForTimeout(200);
  await tapGame(page, SETTINGS_CONFIRM);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outputDir, `${device.name}-4-psani.png`) });

  await drawGame(page, ONE);
  await drawGame(page, SEVEN);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(outputDir, `${device.name}-5-psani-cislice.png`) });

  await context.close();
  return errors;
}

/**
 * Simulovaný výřez: `#safe-area-probe` dostane padding jako z `env()` dřív,
 * než se spustí hra, a výřez se na snímku zakreslí černě.
 */
function simulateNotch(safeArea) {
  const apply = () => {
    const style = document.createElement('style');
    const { top, right, bottom, left } = safeArea;
    style.textContent =
      `#safe-area-probe { padding: ${top}px ${right}px ${bottom}px ${left}px !important; }` +
      `#settings-button { top: ${top + 12}px !important; right: ${right + 12}px !important; }` +
      '.notch { position: fixed; background: #000; z-index: 1000; pointer-events: none; }' +
      // Po otočení na výšku je výřez nahoře a lišta dole (jako iPhone na výšku).
      '@media (orientation: portrait) {' +
      `  #safe-area-probe { padding: ${left}px 0 ${bottom + 13}px 0 !important; }` +
      `  #settings-button { top: ${left + 12}px !important; right: 12px !important; }` +
      '  .notch { display: none; }' +
      '}';
    document.head.append(style);
    const bars = [
      { left: '0', top: '0', width: `${left}px`, height: '100%' },
      { right: '0', top: '0', width: `${right}px`, height: '100%' },
      { left: '0', bottom: '0', width: '100%', height: `${bottom}px` },
    ];
    for (const bar of bars) {
      const element = document.createElement('div');
      element.className = 'notch';
      Object.assign(element.style, bar);
      document.body.append(element);
    }
  };
  // Stav „interactive“ nastane před spuštěním skriptů hry (type="module").
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive') {
      apply();
    }
  });
}

/** Převod herních souřadnic telefonu a panelů na souřadnice stránky. */
function phoneMapper(layoutModule, device) {
  const area = layoutModule.gameAreaFor({ ...device.viewport, safeArea: device.safeArea });
  const panel = layoutModule.panelPlacement(area);
  const game = (point) => ({
    x: area.offsetX + point.x * area.scale,
    y: area.offsetY + point.y * area.scale,
  });
  const inPanel = (point) =>
    game({ x: panel.x + point.x * panel.scale, y: panel.y + point.y * panel.scale });
  return { area, game, inPanel };
}

async function tapAt(page, point) {
  await page.mouse.click(point.x, point.y);
}

async function drawAt(page, points) {
  const [first, ...rest] = points;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps: 12 });
  }
  await page.mouse.up();
}

/** Tahy z okénka na iPadu přenesené do okénka na telefonu. */
function strokeInBox(points, ipadBox, phoneBox) {
  return points.map((point) => ({
    x: phoneBox.x + ((point.x - ipadBox.x) / ipadBox.side) * phoneBox.width,
    y: phoneBox.y + ((point.y - ipadBox.y) / ipadBox.side) * phoneBox.height,
  }));
}

async function newPhonePage(browser, device, viewport = device.viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: device.scale,
    hasTouch: true,
  });
  await context.addInitScript(simulateNotch, device.safeArea);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}

/** Telefon na šířku (#54): průvodce, hra, nápověda, nastavení, psaní, otočení. */
async function shootPhone(browser, url, device, layoutModule) {
  const { context, page, errors } = await newPhonePage(browser, device);
  const map = phoneMapper(layoutModule, device);
  const shot = (name) => page.screenshot({ path: join(outputDir, `${device.name}-${name}.png`) });

  await page.goto(url);
  await page.waitForTimeout(1500);
  await shot('0b-pruvodce-rozsah');
  for (let step = 0; step < 3; step += 1) {
    await tapAt(page, map.inPanel(GUIDE_RIGHT_BUTTON));
    await page.waitForTimeout(400);
  }
  await shot('0e-pruvodce-shrnuti');
  await tapAt(page, map.inPanel(GUIDE_RIGHT_BUTTON));
  await page.waitForTimeout(600);
  await shot('1-zacatek');

  // Výchozí nastavení: číselník do 10. Dvě chyby za sebou ukážou nápovědu.
  const keypad = layoutModule.layoutPhoneScreen(map.area, 11, 10);
  const zero = map.game(keypad.answerButtons[0]);
  await tapAt(page, zero);
  await page.waitForTimeout(500);
  await tapAt(page, zero);
  await page.waitForTimeout(2500);
  await shot('2-napoveda');

  // Počítání teček: ťuknutí na středy buněk v horní řadě obdélníku nápovědy.
  const region = keypad.hintRegion;
  const cell = keypad.hintGrid.cell;
  for (let x = region.left + cell / 2; x < region.right; x += cell) {
    for (let y = region.top + cell / 2; y < region.bottom; y += cell) {
      await tapAt(page, map.game({ x, y }));
      await page.waitForTimeout(60);
    }
  }
  await page.waitForTimeout(300);
  await shot('2b-pocitani');

  const gear = await page.locator('#settings-button').boundingBox();
  await page.mouse.move(gear.x + gear.width / 2, gear.y + gear.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shot('3-nastaveni');

  await tapAt(page, map.inPanel(SETTINGS_WRITING));
  await page.waitForTimeout(200);
  await tapAt(page, map.inPanel(SETTINGS_CONFIRM));
  await page.waitForTimeout(600);
  await shot('4-psani');

  const writing = layoutModule.layoutPhoneWritingScreen(map.area, 10, 10);
  const [tens, ones] = writing.writingAreas;
  await drawAt(page, strokeInBox(ONE, IPAD_TENS_BOX, tens).map(map.game));
  await drawAt(page, strokeInBox(SEVEN, IPAD_ONES_BOX, ones).map(map.game));
  await page.waitForTimeout(1300);
  await shot('5-psani-cislice');

  // Otočení na výšku a zpět (AC7): příklad zůstane, okénka se vyprázdní.
  const { width, height } = device.viewport;
  await page.setViewportSize({ width: height, height: width });
  await page.waitForTimeout(800);
  await shot('6-otoceni-na-vysku');
  await page.setViewportSize(device.viewport);
  await page.waitForTimeout(800);
  await shot('7-otoceni-zpet');

  await context.close();
  return errors.concat(await shootPhoneCelebration(browser, url, device, layoutModule));
}

/** Oslava: uložených 9 hvězdiček, pak se ťuká na čísla od 0, dokud jedno není správně. */
async function shootPhoneCelebration(browser, url, device, layoutModule) {
  const { context, page, errors } = await newPhonePage(browser, device);
  await context.addInitScript(() => {
    localStorage.setItem(
      'agentic-app.settings',
      JSON.stringify({ maxNumber: 10, operations: 'plus', answerInput: 'keypad' }),
    );
    localStorage.setItem('agentic-app.progress', JSON.stringify({ earned: 9, character: 'robik' }));
  });
  const map = phoneMapper(layoutModule, device);
  const keypad = layoutModule.layoutPhoneScreen(map.area, 11, 10);

  await page.goto(url);
  await page.waitForTimeout(1500);
  for (const slot of keypad.answerButtons) {
    await tapAt(page, map.game(slot));
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(outputDir, `${device.name}-8-oslava.png`) });
  await context.close();
  return errors;
}

/** Rozložení telefonu z TypeScriptu hry, aby snímky ťukaly tam, kde opravdu jsou tlačítka. */
async function loadLayoutModule() {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
  try {
    return { server, module: await server.ssrLoadModule('/src/logic/deviceLayout.ts') };
  } catch (error) {
    await server.close();
    throw error;
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const playwright = loadPlaywright();
  const server = await preview({ preview: { port: 4321, strictPort: false } });
  const url = server.resolvedUrls.local[0];
  const { browser, engine } = await launchBrowser(playwright);
  const layout = await loadLayoutModule();

  try {
    for (const device of DEVICES) {
      const errors = await shootDevice(browser, url, device);
      const status = errors.length === 0 ? 'bez chyb' : `CHYBY: ${errors.join(' | ')}`;
      console.log(`${device.name}: hotovo (${status})`);
    }
    for (const device of PHONE_DEVICES) {
      const errors = await shootPhone(browser, url, device, layout.module);
      const status = errors.length === 0 ? 'bez chyb' : `CHYBY: ${errors.join(' | ')}`;
      console.log(`${device.name}: hotovo (${status})`);
    }
    console.log(`Prohlížeč: ${engine}. Snímky jsou ve složce ${outputDir}/.`);
  } finally {
    await browser.close();
    await layout.server.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(`Snímky se nepodařilo udělat: ${error.message}`);
  process.exit(1);
});
