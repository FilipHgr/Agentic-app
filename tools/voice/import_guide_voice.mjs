/* global console, process */
/**
 * Uloží nahrávky vět průvodce jedné hry v jednom jazyce (#182, dnes jen
 * Porovnávání: otázky „kde je víc“ a „kde je míň“) a zapíše jejich otisky
 * do oddílu `guide:<hra>` v tools/voice/fingerprints.json. Nahrávky
 * vytvoří Claude přes napojení ElevenLabs hlasem jazyka z voice.config.json
 * (stejným jako průvodce Počítání), stáhne je nástrojem fetch-voice.mjs
 * a převede na mono 44,1 kHz 64 kb/s. Server ElevenLabs skript nevolá.
 *
 * Spuštění (např. pro češtinu):
 *   npm run voice:guide -- cs compare <složka s nahrávkami>
 * Ve složce je pro každou větu soubor `<id>.mp3`, např. `questionMore.mp3`.
 * Věty jsou v textech hry pod klíčem `guideLines`
 * (src/games/compare/texts/<jazyk>.ts).
 *
 * Jádro je ve voiceCore.ts (TypeScript), proto ho načte Vite jako make_voice.mjs.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const CONFIG_PATH = 'tools/voice/voice.config.json';

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
  const [language, game, sourceDir, ...rest] = process.argv.slice(2);
  if (language === undefined || game === undefined || sourceDir === undefined || rest.length > 0) {
    console.error('Použití: npm run voice:guide -- <jazyk> <hra> <složka s nahrávkami>');
    process.exitCode = 1;
    return;
  }
  const voices = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const core = await vite.ssrLoadModule('/tools/voice/voiceCore.ts');
    if (!core.GUIDE_GAMES.includes(game)) {
      console.error(`Hra „${game}“ nemá věty průvodce. Hry: ${core.GUIDE_GAMES.join(', ')}.`);
      process.exitCode = 1;
      return;
    }
    const dir = core.GUIDE_TEXTS_DIRS[game];
    const textFiles = await diskFiles.listFiles(dir);
    const lines =
      /^[a-z]+$/.test(language) && textFiles.includes(`${language}.ts`)
        ? core.guideLinesOf((await vite.ssrLoadModule(`/${dir}/${language}.ts`)).default)
        : [];
    const result = await core.importGuideVoice({
      game,
      language,
      lines,
      voices,
      source: (line) => diskFiles.readFile(join(sourceDir, `${line.id}.mp3`)),
      files: diskFiles,
      log: (line) => console.log(line),
    });
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await vite.close();
  }
}

main().catch((error) => {
  console.error(`Skript na nahrávky průvodce skončil chybou: ${String(error)}`);
  process.exitCode = 1;
});
