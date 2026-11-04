/* global console, process */
/**
 * Snímky obrazovky hry pro kontrolu před předáním úkolu.
 *
 * Spuštění z kořene repa (po `npm run build`):
 *   node tools/screenshots/take.mjs [složka]
 *
 * Udělá snímky na iPadu na šířku a na telefonu na výšku v těchto stavech:
 * první spuštění s nápovědou, začátek hry, nápověda po dvou chybách, počítání teček ťukáním,
 * otevřené nastavení pro rodiče,
 * okénka na psaní (#41, #42) a rozpoznané napsané číslo.
 * Použije WebKit (jako Safari), když je k dispozici, jinak Chromium a řekne to.
 * Playwright není závislost projektu, musí být nainstalovaný v systému.
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { preview } from 'vite';

const require = createRequire(import.meta.url);
const outputDir = process.argv[2] ?? 'snimky';

/** Herní plocha má pevně 1024 × 768 a na obrazovce se jen zmenší nebo zvětší. */
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;

/** Tlačítko 0 na číselníku 0–10 (výchozí nastavení) v herních souřadnicích. */
const BUTTON_ZERO = { x: 112, y: 514 };

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
  // Nový prohlížeč nemá uložené nastavení: první spuštění s nápovědou (#48).
  await page.screenshot({ path: join(outputDir, `${device.name}-0-prvni-spusteni.png`) });
  await tapGame(page, SETTINGS_CONFIRM);
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

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const playwright = loadPlaywright();
  const server = await preview({ preview: { port: 4321, strictPort: false } });
  const url = server.resolvedUrls.local[0];
  const { browser, engine } = await launchBrowser(playwright);

  try {
    for (const device of DEVICES) {
      const errors = await shootDevice(browser, url, device);
      const status = errors.length === 0 ? 'bez chyb' : `CHYBY: ${errors.join(' | ')}`;
      console.log(`${device.name}: hotovo (${status})`);
    }
    console.log(`Prohlížeč: ${engine}. Snímky jsou ve složce ${outputDir}/.`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(`Snímky se nepodařilo udělat: ${error.message}`);
  process.exit(1);
});
