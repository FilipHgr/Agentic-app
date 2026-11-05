/* global console, process, fetch, AbortController */
/**
 * Vytvoří nahrávky vět průvodce nastavením Počítání přes ElevenLabs (#50),
 * vždy pro jeden zvolený jazyk (#66). Spouští ho jen vlastník u sebe,
 * nikdy CI, testy ani build.
 *
 * Spuštění (např. pro češtinu jazyk cs):
 *   read -s ELEVENLABS_API_KEY && export ELEVENLABS_API_KEY && npm run voice -- <jazyk>
 * (klíč se tak neuloží do historie příkazů)
 *
 * - Klíč se čte jen z proměnné prostředí a nikam se nezapisuje.
 * - Jazyk je kód z malých písmen přesně podle souboru textů
 *   src/games/counting/texts/<jazyk>.ts, nemusí být v seznamu jazyků hry.
 * - Hlas jazyka a jeho nastavení jsou v tools/voice/voice.config.json
 *   v oddílu jazyka.
 * - Nahrávky se uloží do public/voice/<jazyk>/counting/guide/<id>.mp3 a otisky
 *   do oddílu jazyka v tools/voice/fingerprints.json. Věty beze změny se
 *   znovu neplatí, ostatní jazyky zůstanou netknuté.
 *
 * Skript je v JavaScriptu, aby šel spustit bez další závislosti. Jádro
 * (voiceCore.ts) a scénář (src/games/counting/logic/guideScript.ts, věty
 * z textů src/games/counting/texts/) jsou v TypeScriptu, proto je načte Vite,
 * který už je v projektu.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createServer } from 'vite';

// Cesty musí sedět s CONFIG_PATH a TEXTS_DIR ve voiceCore.ts.
const CONFIG_PATH = 'tools/voice/voice.config.json';
const TEXTS_DIR = 'src/games/counting/texts';

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

async function main() {
  const voices = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const textFiles = await diskFiles.listFiles(TEXTS_DIR);
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { runVoiceCommand } = await vite.ssrLoadModule('/tools/voice/voiceCore.ts');
    const { voiceSentences } = await vite.ssrLoadModule('/src/games/counting/logic/guideScript.ts');

    // Ctrl+C: rozpracovaná věta se zahodí, staré nahrávky i otisky zůstanou.
    const interrupt = new AbortController();
    process.once('SIGINT', () => interrupt.abort());

    const result = await runVoiceCommand({
      args: process.argv.slice(2),
      textFiles,
      voices,
      // Jazyk je už ověřený proti názvům souborů v TEXTS_DIR.
      loadSentences: async (language) => {
        const texts = await vite.ssrLoadModule(`/${TEXTS_DIR}/${language}.ts`);
        return voiceSentences(texts.default);
      },
      env: process.env,
      fetch,
      files: diskFiles,
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
