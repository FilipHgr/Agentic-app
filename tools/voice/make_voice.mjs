/* global console, process, fetch, AbortController */
/**
 * Vytvoří nahrávky vět průvodce nastavením přes ElevenLabs (#50).
 * Spouští ho jen vlastník u sebe, nikdy CI, testy ani build.
 *
 * Spuštění:
 *   read -s ELEVENLABS_API_KEY && export ELEVENLABS_API_KEY && npm run voice
 * (klíč se tak neuloží do historie příkazů)
 *
 * - Klíč se čte jen z proměnné prostředí a nikam se nezapisuje.
 * - Hlas a jeho nastavení jsou v tools/voice/voice.config.json.
 * - Nahrávky se uloží do public/voice/guide/<id>.mp3 a otisky do
 *   tools/voice/fingerprints.json. Věty beze změny se znovu neplatí.
 *
 * Skript je v JavaScriptu, aby šel spustit bez další závislosti. Jádro
 * (voiceCore.ts) a scénář (src/logic/guideScript.ts) jsou v TypeScriptu,
 * proto je načte Vite, který už je v projektu.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createServer } from 'vite';

const OUTPUT_DIR = 'public/voice/guide';
const MANIFEST_PATH = 'tools/voice/fingerprints.json';
const CONFIG_PATH = 'tools/voice/voice.config.json';

/** Soubory na disku. Zápis jde přes dočasný soubor, takže přerušení nenechá půlku nahrávky. */
const diskFiles = {
  async readFile(path) {
    try {
      return new Uint8Array(await readFile(path));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  },
  async writeFile(path, data) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, path);
  },
  async deleteFile(path) {
    await rm(path, { force: true });
  },
  async listFiles(dir) {
    try {
      return await readdir(dir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  },
};

/** Dočasné soubory po tvrdém ukončení by build přibalil do hry, proto pryč. */
async function removeLeftoverTemporaryFiles() {
  for (const name of await diskFiles.listFiles(OUTPUT_DIR)) {
    if (name.endsWith('.tmp')) {
      await rm(`${OUTPUT_DIR}/${name}`, { force: true });
    }
  }
}

function isValidConfig(config) {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.voiceId === 'string' &&
    typeof config.modelId === 'string' &&
    typeof config.voiceSettings === 'object' &&
    config.voiceSettings !== null
  );
}

async function main() {
  await removeLeftoverTemporaryFiles();
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  if (!isValidConfig(config)) {
    console.error(`V ${CONFIG_PATH} musí být voiceId a modelId (text) a voiceSettings (objekt).`);
    process.exitCode = 1;
    return;
  }
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { makeVoice } = await vite.ssrLoadModule('/tools/voice/voiceCore.ts');
    const { voiceSentences } = await vite.ssrLoadModule('/src/logic/guideScript.ts');

    // Ctrl+C: rozpracovaná věta se zahodí, staré nahrávky i otisky zůstanou.
    const interrupt = new AbortController();
    process.once('SIGINT', () => interrupt.abort());

    const result = await makeVoice({
      sentences: voiceSentences(),
      config,
      env: process.env,
      fetch,
      files: diskFiles,
      outputDir: OUTPUT_DIR,
      manifestPath: MANIFEST_PATH,
      log: (line) => console.log(line),
      signal: interrupt.signal,
    });
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await vite.close();
  }
}

main().catch(() => {
  // Bez podrobností: chyba by mohla obsahovat klíč.
  console.error('Skript na nahrávky skončil chybou. Zkontroluj voice.config.json a připojení.');
  process.exitCode = 1;
});
