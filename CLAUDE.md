# Agentic-app

Webová hra v prohlížeči na výuku matematiky pro děti.
- Primární zařízení je iPad Air v Safari (WebKit), na šířku, ovládání jen
  dotykem (ťuknutí, tažení). Žádný hover, klávesnice ani malé ovládací prvky.

## Produkt
- Primární zařízení je tablet na šířku, ovládání jen dotykem (ťuknutí, tažení).
  Žádný hover, klávesnice ani malé ovládací prvky.
- Hra musí být pochopitelná bez čtení návodu, jedna hlavní mechanika.
- Každá akce má okamžitou zpětnou vazbu (animace, zvuk). Chyba nikdy netrestá.
- Žádné prvky, které nejsou v zadání: menu, účty, obchod, reklamy, texty navíc.
- Hra musí běžet plynule i na levnějším tabletu.
- 
## Technologie a příkazy
- Phaser (hra, animace, dotyk), TypeScript (strict), Vite, Vitest,
  ESLint + Prettier. Verze viz `package.json`.
- Struktura: `src/logic/` čistý TypeScript bez Phaseru (příklady, vyhodnocení,
  obtížnost, body), `src/scenes/` Phaser scény, které logiku jen volají.
  Testy logiky jsou v `tests/`.
- `npm run dev` – vývojový server
- `npm test` – testy (Vitest)
- `npm run lint` – ESLint a kontrola formátování
- `npm run build` – produkční build
- Testy, lint a build spouštěj vždy přes tyto skripty, ne přímo
  v nastavení GitHub Actions (kvůli případné migraci na GitLab).

## Git workflow
- Větev vytvoř ze `staging`: `APP-123-kratky-popis` (ID úkolu z YouTracku).
- PR otevírej do `staging`, nikdy do `main`.
- Nepushuj přímo do `staging` ani `main`, nepoužívej force push.
- Jeden úkol = jedna větev = jeden malý PR. Nesouvisející změny (refaktoring,
  úklid) nedělej, navrhni je v PR jako nový úkol.
- V popisu PR uveď ID úkolu, co se změnilo, jak to otestovat a které
  akceptační kritérium pokrývá který test.

## Testování
- Testy ověřují splnění zadání (user story a akceptační kritéria), ne to,
  jak je kód uvnitř napsaný.
- Každé akceptační kritérium má alespoň jeden test. Název testu popisuje
  chování z pohledu hráče ("po správné odpovědi se přičte bod").
- Testuj chování, ne implementaci: test se nesmí rozbít, když se kód přepíše
  a chování zůstane stejné.
- Zahrň okrajové případy ze zadání (špatná odpověď, prázdný vstup, konec hry).
- Úkol je hotový, až když projdou testy funkcionality.

## Kód
- Čitelnost má přednost před stručností: jasné názvy, krátké funkce, žádné
  chytré triky.
- Logiku hry odděl od uživatelského rozhraní, aby šla testovat bez prohlížeče.
- Ošetři chybné vstupy a stavy, hráč nikdy nevidí výjimku. Žádné prázdné
  `catch`.
- Formátování a styl hlídá automatický linter/formátovač, neobcházej ho.
- Před otevřením PR si přečti vlastní diff (ladicí výpisy, nepoužité importy
  pryč), spusť lint i testy.

## Bezpečnost
- Žádná tajemství v kódu (hesla, klíče, tokeny). Používej proměnné prostředí,
  `.env` je v `.gitignore`.
- Veškerý uživatelský vstup validuj. Nevkládej ho do stránky přes `innerHTML`,
  nepoužívej `eval` ani spouštění kódu z řetězců.
- Hráč nikdy nevidí interní chyby ani stack trace, logy neobsahují osobní údaje.
- Žádné vlastní řešení přihlášení ani šifrování, použij ověřenou knihovnu.
- Novou závislost přidej jen když je nutná a zdůvodni ji v PR.
  `package-lock.json` patří do repa.
- Před PR spusť `npm audit`. Vysoké a kritické nálezy nahlas v PR.
- Při bezpečnostní nejistotě se zeptej. Nikdy nesnižuj ochrany, aby něco prošlo.

## Nejasnosti
- Když je zadání nejasné nebo chybí akceptační kritéria, zeptej se, neodhaduj.
- Pokud úkol vyžaduje porušit pravidla výše, napiš to do PR a nic neobcházej.