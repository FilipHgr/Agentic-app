/* global console, process, fetch, AbortController, setTimeout, clearTimeout, URL */
/**
 * Stáhne jednu nahrávku vygenerovanou v ElevenLabs (napojení MCP) do zvolené
 * složky, aby šla zkontrolovat a převést do formátu průvodce (rozhodnutí
 * 2026-11-12, #138). Úzká výjimka ze zákazu `curl` a `wget` stejně jako
 * `tools/design/fetch-image.mjs`: jen HTTPS ze serveru
 * elevenlabsusercontent.com, jen mp3 a jen do 5 MB. Hra sama nic nestahuje.
 *
 * Spuštění:
 *   node tools/voice/fetch-voice.mjs <adresa nahrávky> <cílový soubor .mp3>
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';

const ALLOWED_HOST = 'elevenlabsusercontent.com';
const ALLOWED_TYPES = new Set(['audio/mpeg', 'audio/mp3']);
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

/** Adresa smí vést jen na HTTPS server ElevenLabs s vygenerovaným obsahem. */
export function isAllowedVoiceUrl(text) {
  let url;
  try {
    url = new URL(text);
  } catch (error) {
    console.warn(`Neplatná adresa: ${error.message}`);
    return false;
  }
  return url.protocol === 'https:' && url.hostname === ALLOWED_HOST && url.port === '';
}

/** Cílový soubor musí být mp3 podle přípony. */
export function isAllowedVoiceTarget(path) {
  return extname(path).toLowerCase() === '.mp3';
}

/** Odpověď serveru musí být zvuk mp3. */
export function isAllowedVoiceType(contentType) {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  return ALLOWED_TYPES.has(type);
}

async function download(url, target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) {
      throw new Error(`server vrátil ${response.status}`);
    }
    const type = response.headers.get('content-type');
    if (!isAllowedVoiceType(type)) {
      throw new Error(`odpověď není mp3 (${type ?? 'bez typu'})`);
    }
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) {
      throw new Error(`nahrávka je větší než ${MAX_BYTES} bajtů`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error(`nahrávka je větší než ${MAX_BYTES} bajtů`);
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
    console.error('Použití: node tools/voice/fetch-voice.mjs <adresa> <cílový soubor .mp3>');
    process.exit(1);
  }
  if (!isAllowedVoiceUrl(url)) {
    console.error(`Stahovat jde jen přes HTTPS z ${ALLOWED_HOST}.`);
    process.exit(1);
  }
  if (!isAllowedVoiceTarget(target)) {
    console.error('Cílový soubor musí mít příponu .mp3.');
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

if (process.argv[1] && process.argv[1].endsWith('fetch-voice.mjs')) {
  await main();
}
