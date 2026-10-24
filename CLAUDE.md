# Agentic-app

Webová hra v prohlížeči na výuku angličtiny pro děti.

## Příkazy
- (doplnit po výběru stacku, např. `npm run dev`, `npm test`, `npm run lint`, `npm run build`)
- Testy, lint a build spouštěj vždy přes tyto skripty v repu, ne přímo
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