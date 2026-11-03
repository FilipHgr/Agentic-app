/* global console, process */
/**
 * Snímky obrazovky hry pro kontrolu před předáním úkolu.
 *
 * Spuštění z kořene repa (po `npm run build`):
 *   node tools/screenshots/take.mjs [složka]
 *
 * Udělá snímky na iPadu na šířku a na telefonu na výšku ve třech stavech:
 * začátek hry, nápověda po dvou chybách a otevřené nastavení pro rodiče.
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

/** Ťukne na místo zadané v herních souřadnicích. */
async function tapGame(page, point) {
  const box = await page.locator('canvas').boundingBox();
  const x = box.x + (point.x / GAME_WIDTH) * box.width;
  const y = box.y + (point.y / GAME_HEIGHT) * box.height;
  await page.mouse.click(x, y);
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
  await page.screenshot({ path: join(outputDir, `${device.name}-1-zacatek.png`) });

  // Dvě chyby za sebou ukážou nápovědu (výjimka: příklad s výsledkem 0).
  await tapGame(page, BUTTON_ZERO);
  await page.waitForTimeout(500);
  await tapGame(page, BUTTON_ZERO);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outputDir, `${device.name}-2-napoveda.png`) });

  const gear = await page.locator('#settings-button').boundingBox();
  await page.mouse.move(gear.x + gear.width / 2, gear.y + gear.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outputDir, `${device.name}-3-nastaveni.png`) });

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
