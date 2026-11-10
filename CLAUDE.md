# Agentic-app

Webová hra v prohlížeči na výuku matematiky pro děti.

## Produkt
- Primární zařízení: iPad Air, Safari (WebKit), na šířku, ovládání jen dotykem
  (ťuknutí, tažení). Žádný hover ani klávesnice.
- Dotykové plochy alespoň 64 × 64 px, mezi nimi dost místa pro dětské prsty.
- Hra je pochopitelná bez čtení návodu, má jednu hlavní mechaniku.
- Každá akce má okamžitou zpětnou vazbu (animace, zvuk). Chyba nikdy netrestá.
- Žádné prvky mimo zadání: menu, účty, obchod, reklamy, texty navíc.
  Výjimka: nastavení pro rodiče (rozsah, druh příkladů) za ozubeným kolečkem,
  které se otevře až po podržení, aby se tam dítě nedostalo omylem.
- Plynulost: cíl 60 fps i na levnějším tabletu, žádné zbytečně velké assety.
- Texty ve hře jsou jen v souborech jazyků (zatím jen čeština), nikdy natvrdo
  v kódu. Nový text se přidá do všech jazyků naráz. Názvy v kódu anglicky,
  komentáře a commity česky.

## Safari na iPadu
- Používej pointer události (Phaser input), ne mouse/hover.
- Zvuk se odemkne až po prvním dotyku hráče, s tím počítej při startu hry.
- Zakaž přibližování dvojitým ťuknutím a sevřením prstů (viewport, `touch-action`).
- Nové funkce ověř v náhledu na iPadu nebo ve WebKit emulaci, ne jen v Chrome.

## Soukromí dětí
- Žádná analytika, cookies, sledování ani požadavky na cizí servery
  (fonty, CDN, API). Vše, co hra potřebuje, je v repozitáři.
- Nastavení ukládej jen lokálně (`localStorage`), bez osobních údajů.
- Přezdívka profilu (nemusí být skutečné jméno) a barva jsou jen v zařízení
  a každá hra ukládá podle profilu.
- O odemčení her rozhoduje jen sdílená logika přístupu
  (`src/shared/logic/gameAccess.ts`), budoucí nákup bude jen za rodičovskou
  bránou a skutečné placení vyžaduje samostatné rozhodnutí vlastníka a změnu
  pravidel o soukromí.

## Technologie a příkazy
- Phaser, TypeScript (strict), Vite, Vitest, ESLint + Prettier.
  Verze viz `package.json`.
- Projekt má oddělené části:
  - `src/shared/` společné věci stránky (herní plocha podle okna, kolečko
    nastavení, společné barvy, úložiště, přehrávač tónů),
  - `src/games/<hra>/` jednotlivé hry (dnes `counting` = Počítání) se
    vstupem `index.ts` (scény hry, stahuje se až po ťuknutí v menu)
    a `meta.ts` (id, kategorie, symbol dlaždice, název z textů hry
    a obrázek dlaždice z importu `./tile.webp`, nic dalšího, žádný Phaser),
  - `src/menu/` úvodní menu s výběrem her (logika, scéna, texty).
  `src/main.ts` je vstup stránky a startuje menu. Seznam her je
  `src/gameList.ts`, registr (tvar záznamu, kategorie) je
  `src/shared/logic/gameRegistry.ts`. Hra se spouští jen přes
  `src/menu/ui/launchGame.ts`.
- Hra smí importovat jen sama sebe a `src/shared/`, sdílená část nic z her,
  menu ani `src/main.ts`. Zvenku se z hry importuje jen `index.ts`
  a `meta.ts`. Hlídá to `tests/shared/boundaries.test.ts`.
- Přidání hry:
  1. složka `src/games/<id>/` (id malými písmeny bez diakritiky) se vstupem
     `index.ts`, který vydává `scenes`, a s `meta.ts`,
  2. kategorie z `GAME_CATEGORIES`; nová kategorie potřebuje název
     v `src/menu/texts/<jazyk>.ts` a vlastní symbol bez emoji podoby,
  3. záznam v `src/gameList.ts` (`gameEntry(meta, () => import('./games/<id>'))`),
  4. název hry `title` v textech hry ve všech jazycích,
  5. obrázek dlaždice `tile.webp` ve složce hry (čtverec 512 px, bílé
     pozadí, nejvýš 8 192 B, původ v `public/licence.txt`),
  6. testy v `tests/games/<id>/` a skript `test:<id>` v `package.json`.
- Ve složkách `logic/` (`src/shared/logic/`, `src/games/<hra>/logic/`) je čistý
  TypeScript bez Phaseru (příklady, vyhodnocení, obtížnost, body), ve
  `scenes/` hry Phaser scény, které logiku jen volají. Testy jsou
  v `tests/shared/`, `tests/menu/` a `tests/games/<hra>/`.
- Texty jsou po jazycích, soubor jazyka se jmenuje podle kódu (`cs.ts`)
  a vrací slovník přes `export default { … } satisfies <typ>`:
  - `src/shared/texts/` seznam jazyků a výběr aktuálního jazyka
    (`languages.ts`) a sdílené texty stránky a jazyka (`<jazyk>.ts`,
    např. název stránky a jednopísmenné předložky; typ a přístup
    v `sharedTexts.ts`),
  - `src/games/<hra>/texts/` texty hry; každá hra má v textech `title`
    (název hry pro menu),
  - `src/menu/texts/` texty menu („Vše“ a názvy kategorií).
  Symboly (číslice, +, −, ✓ a podobně) nejsou texty jazyka a zůstávají
  v kódu. Nahrávky jsou v `public/voice/<jazyk>/<hra>/`.
- Přidání jazyka:
  1. soubor textů ve sdílené části, v menu a v každé hře (a jazyk
     v `titles` každého `meta.ts`),
  2. projdou testy textů (klíče, prázdné texty, vejde se do rozložení); běží
     pro každý jazyk se souborem textů, i mimo seznam, kontrola nahrávek jen
     pro jazyky ze seznamu,
  3. hlas jazyka (`voiceId`, `modelId`, `voiceSettings`) se zapíše do
     oddílu jazyka v `tools/voice/voice.config.json`, vlastník u sebe vytvoří
     nahrávky Počítání příkazem `npm run voice -- <jazyk>` (kód jazyka malými
     písmeny přesně podle souboru textů, např. `npm run voice -- cs`) a hlas
     doplní do `public/licence.txt`,
  4. jazyk se přidá do seznamu v `languages.ts` až s nahrávkami, v jednom
     commitu.
- `npm run dev` vývojový server
- `npm test` všechny testy
- `npm run test:shared` testy sdílené části, `npm run test:menu` testy menu
  a test hranic, `npm run test:<hra>` (např. `test:counting`) testy jedné
  hry a test hranic.
- `npm run test:recognition` pomalé testy rozpoznávání psaní (soubory
  `*.slow.test.ts`, `test:counting` je vynechává). Pouští se při změně
  rozpoznávání, jeho vzorů, sady vzorků nebo testů skupiny (`test:changed`
  ji pustí sám) a vždy v `npm test`, a tedy i v CI.
- `npm run test:whole` kontroly celku (test hranic, natvrdo napsaných textů
  a souborů obrázků dlaždic her).
- `npm run test:changed` testy částí změněných od posledního commitu
  a kontroly celku; změna mimo části pustí všechny testy. Při práci se
  pouští `npm run test:changed`, celé `npm test` běží před PR a v CI.
- `npm run lint` ESLint a kontrola formátování
- `npm run build` produkční build
- CI (GitHub Actions) volá jen tyto skripty, nemá vlastní příkazy
  (kvůli možné migraci na GitLab).

## Postup práce
- Úkoly navrhuje Claude jako GitHub issues, vlastník je jen schvaluje.
  Postup: skill `novy-ukol`.
- Po dokončení úkolu pošli odkaz na náhled, na konci sprintu otevři PR.
  Postup: skill `predani-ukolu`.
- Úkol je hotový, až když projde `npm run test:changed`, `npm run lint`
  i `npm run build`. Celé `npm test` běží před PR a v CI.
- Rozhodnutí vlastníka z chatu, která nejsou v issue ani tady, zapiš hned
  jedním řádkem do `docs/rozhodnuti.md` a commitni jako drobnost.
  Deník: @docs/rozhodnuti.md

## Git
- Jeden sprint = jedna větev `sprint-<číslo>` ze `staging` = jeden PR do `staging`.
- Každý schválený úkol je samostatný commit začínající `#<číslo issue>`.
- Drobnosti (dokumentace, nastavení) jako samostatný commit do aktuálního sprintu.
- Nikdy nepushuj do `main` ani `staging`, žádný force push, žádný deploy
  (`npm run deploy`, `wrangler deploy`). Nasazení dělá Cloudflare po sloučení do `main`.
- Nesouvisející refaktoring nedělej, navrhni ho jako nový úkol.

## Testování
- Každé akceptační kritérium má alespoň jeden test, pojmenovaný z pohledu
  hráče ("po správné odpovědi se přičte bod").
- Testuj chování, ne implementaci: přepis kódu se stejným chováním test nerozbije.
- Pokryj okrajové případy ze zadání (špatná odpověď, prázdný vstup, konec hry).

## Kód
- Čitelnost před stručností: jasné názvy, krátké funkce, žádné chytré triky.
- Hráč nikdy nevidí výjimku ani stack trace. Žádné prázdné `catch`.
- Linter a formátovač neobcházej (žádné `eslint-disable` bez zdůvodnění).
- Před PR si přečti vlastní diff (ladicí výpisy a nepoužité importy pryč).

## Bezpečnost
- Žádná tajemství v kódu, `.env` je v `.gitignore` a nečti ho.
- Nepoužívej `innerHTML`, `eval` ani spouštění kódu z řetězců.
- Novou závislost přidej jen když je nutná a zdůvodni ji v PR.
  `package-lock.json` patří do repa.
- Před PR spusť `npm audit`, vysoké a kritické nálezy uveď v PR.
- Nikdy nesnižuj ochrany, aby něco prošlo.

## Nejasnosti
- Když je zadání nejasné nebo chybí akceptační kritéria, zeptej se, neodhaduj.
- Pokud úkol vyžaduje porušit pravidla výše, napiš to do PR a nic neobcházej.
