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
- Texty ve hře česky. Názvy v kódu anglicky, komentáře a commity česky.

## Safari na iPadu
- Používej pointer události (Phaser input), ne mouse/hover.
- Zvuk se odemkne až po prvním dotyku hráče, s tím počítej při startu hry.
- Zakaž přibližování dvojitým ťuknutím a sevřením prstů (viewport, `touch-action`).
- Nové funkce ověř v náhledu na iPadu nebo ve WebKit emulaci, ne jen v Chrome.

## Soukromí dětí
- Žádná analytika, cookies, sledování ani požadavky na cizí servery
  (fonty, CDN, API). Vše, co hra potřebuje, je v repozitáři.
- Nastavení ukládej jen lokálně (`localStorage`), bez osobních údajů.

## Technologie a příkazy
- Phaser, TypeScript (strict), Vite, Vitest, ESLint + Prettier.
  Verze viz `package.json`.
- `src/logic/` čistý TypeScript bez Phaseru (příklady, vyhodnocení,
  obtížnost, body). `src/scenes/` Phaser scény, které logiku jen volají.
  Testy logiky jsou v `tests/`.
- `npm run dev` vývojový server
- `npm test` testy
- `npm run lint` ESLint a kontrola formátování
- `npm run build` produkční build
- CI (GitHub Actions) volá jen tyto skripty, nemá vlastní příkazy
  (kvůli možné migraci na GitLab).

## Postup práce
- Úkoly navrhuje Claude jako GitHub issues, vlastník je jen schvaluje.
  Postup: skill `novy-ukol`.
- Po dokončení úkolu pošli odkaz na náhled, na konci sprintu otevři PR.
  Postup: skill `predani-ukolu`.
- Úkol je hotový, až když projde `npm test`, `npm run lint` i `npm run build`.
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
