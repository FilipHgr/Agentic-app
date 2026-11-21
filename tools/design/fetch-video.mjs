/* global console, process, fetch, AbortController, setTimeout, clearTimeout, URL */
/**
 * Stáhne jedno video vygenerované v ElevenLabs (pohyby pandy) do zvolené
 * složky, aby šlo prohlédnout, vyříznout pozadí a převést pro hru
 * (rozhodnutí 2026-11-21). Úzká výjimka ze zákazu `curl` a `wget` stejně
 * jako `fetch-image.mjs`: jen HTTPS ze serveru elevenlabsusercontent.com,
 * jen mp4 a jen do 100 MB. Hra sama nic nestahuje.
 *
 * Spuštění:
 *   node tools/design/fetch-video.mjs <adresa videa> <cílový soubor .mp4>
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';

const ALLOWED_HOST = 'elevenlabsusercontent.com';
const ALLOWED_EXTENSIONS = new Set(['.mp4']);
const MAX_BYTES = 100 * 1024 * 1024;
const TIMEOUT_MS = 180_000;

/** Adresa smí vést jen na HTTPS server ElevenLabs. */
export function isAllowedVideoUrl(text) {
  let url;
  try {
    url = new URL(text);
  } catch (error) {
    console.warn(`Neplatná adresa: ${error.message}`);
    return false;
  }
  return url.protocol === 'https:' && url.hostname === ALLOWED_HOST && url.port === '';
}

/** Cílový soubor musí být mp4 podle přípony. */
export function isAllowedTarget(path) {
  return ALLOWED_EXTENSIONS.has(extname(path).toLowerCase());
}

async function download(url, target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) {
      throw new Error(`server vrátil ${response.status}`);
    }
    const type = response.headers.get('content-type') ?? '';
    if (type !== 'video/mp4') {
      throw new Error(`odpověď není video mp4 (${type})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error(`video je větší než ${MAX_BYTES} bajtů`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    console.log(`Uloženo ${target} (${bytes.byteLength} bajtů)`);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const [url, target] = process.argv.slice(2);
  if (url === undefined || target === undefined) {
    console.error('Použití: node tools/design/fetch-video.mjs <adresa> <cílový soubor .mp4>');
    process.exit(1);
  }
  if (!isAllowedVideoUrl(url)) {
    console.error(`Stahovat jde jen přes HTTPS z ${ALLOWED_HOST}.`);
    process.exit(1);
  }
  if (!isAllowedTarget(target)) {
    console.error('Cílový soubor musí mít příponu .mp4.');
    process.exit(1);
  }
  // Vestavěný fetch v Node čte nastavení proxy z prostředí jen s touto proměnnou.
  if (process.env.NODE_USE_ENV_PROXY !== '1') {
    const child = spawnSync(process.execPath, process.argv.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
    });
    process.exit(child.status ?? 1);
  }
  try {
    await download(url, target);
  } catch (error) {
    console.error(`Stažení selhalo: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('fetch-video.mjs')) {
  await main();
}
