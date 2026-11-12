# Deník rozhodnutí

Rozhodnutí vlastníka z chatu, která nejsou zapsaná jinde (v issue, v `CLAUDE.md`
ani ve skills). Každá session ho čte přes `CLAUDE.md`. Nové rozhodnutí přidej
jako jeden řádek s datem a případně číslem issue, nic nemaž. Když rozhodnutí
změní starší, napiš nové a u starého doplň „(nahrazeno)“.

## Spolupráce

- 2026-11-02 Úkoly se nevedou v YouTracku, ale v GitHub issues. Navrhuje je
  Claude, vlastník je schvaluje „ok“ v chatu.
- 2026-11-02 Uzavření sprintu a otevření PR Claude nenavrhuje, dělá je jen na
  výslovný pokyn vlastníka.
- 2026-11-03 Odpovídej stručně.
- 2026-11-03 Vlastník hru zkouší i na telefonu (iPhone se Safari, Samsung
  s Chromem), nejen na iPadu.
- 2026-11-04 Noční práce: večer vlastník schválí 2–3 issues (u vzhledu po
  obrázcích), Claude je v noci udělá celé včetně kontrol, commitu a pushe do
  sprintu. Otázku, kterou musí rozhodnout vlastník, Claude neodhaduje, úkol
  odloží a pokračuje dalším. Ráno shrnutí s náhledem. Vlastník vstává v 7:00
  (čas Praha), shrnutí má být připravené do té doby.
- 2026-11-04 Číselník do 20 na telefonu na výšku je 5 × 5 (#56).

## Hra

- 2026-11-02 Odpověď se zadává číselníkem 0 až zvolený rozsah, ne výběrem ze
  tří čísel. Ze tří čísel šlo výsledek uhodnout (#30).
- 2026-11-02 Nápověda s tečkami se ukáže po 2. chybě. Tečky jsou velké, po pěti
  v řadě a každé číslo má svou barvu (#30).
- 2026-11-02 Hvězdička se dává za každý vyřešený příklad, i s nápovědou. Po
  deseti přijde oslava (#31).
- 2026-11-02 Sovička se ruší. Hlavní postavičky jsou Hvězdík, Robík
  a Plamínek, střídají se po každé oslavě a začíná Hvězdík (#33). (nahrazeno)
- 2026-11-03 Hra na celou obrazovku a rozložení na výšku: implementace se
  vlastníkovi nelíbila, vráceno a odloženo (#34). Znovu nenavrhovat bez
  upřesnění od vlastníka. (nahrazeno)
- 2026-11-03 Automatická obtížnost zamítnuta (#35). Místo ní je nastavení pro
  rodiče (#36).
- 2026-11-03 Nastavení pro rodiče: kolečko v pravém horním rohu celé
  obrazovky (mimo herní plochu), velikost 76 px, otevře se podržením 2 s (#36).
  (podržení 2 s nahrazeno)
- 2026-11-04 Kolečko nastavení se otevře podržením 1 s místo 2 s, 2 s byly
  pro rodiče moc dlouho (#36).
- 2026-11-04 Výjimka: při prvním spuštění (bez platného uloženého nastavení)
  se nastavení otevře samo s nápovědou pro rodiče, jinak jen podržením
  kolečka (#48).
- 2026-11-04 Nápověda dvěma texty vedle ✓ (#48) se vlastníkovi nelíbí. Místo
  ní interaktivní průvodce nastavením: nejdřív otázka, podle které průvodce
  nastavení předvyplní, pak krok za krokem projde řady s radami. Jen při
  prvním spuštění, automatické otevření z #48 zůstává. „Musí to být fakt
  dobré.“
- 2026-11-04 Průvodce schválen jako #49: otázka na třídu (ne věk), 5 kroků
  s radami pro rodiče, u 2. třídy a výš předvyplněná tužka (vědomě, i když
  rozpoznávání dětského písma zatím nikdo neměřil). (otázka na třídu nahrazena)
- 2026-11-04 Otázka na třídu v průvodci zrušena (vlastník: zbytečná). Průvodce
  má 4 kroky (tři řady a shrnutí), výchozí nastavení, jednu radu na řadu, bez
  Přeskočit. Scénář má 4 věty (#49, #50).
- 2026-11-04 Hlasový dabing průvodce nastavením: dospělý hlas (ne
  postavička), v průvodci nejde vypnout, texty se upraví pro mluvení.
  Nahrávky mp3 jsou předem v repozitáři, hra je nikde nestahuje. Všechny
  vytvoří najednou skript přes ElevenLabs, který vlastník spustí u sebe
  se svým klíčem.
- 2026-11-04 Dabing rozdělen na dva úkoly: nejdřív skript s texty pro
  mluvení, pak přehrávání. Nahrávky se mají načítat postupně (lazy loading),
  aby se stahování rozložilo v čase.
- 2026-11-04 Průvodce na 1. kroku zatím nemluví sám (Safari pustí zvuk až po
  dotyku). Vyřeší to budoucí úvodní menu s výběrem her: menu a hry musí být
  jedna stránka, aby ťuknutí v menu odemklo zvuk. Pak průvodce promluví hned
  (#51). Menu je výjimka z „žádné menu“ v CLAUDE.md, až ho vlastník zadá.
- 2026-11-04 Psaní prstem při rozsahu do 10 má dál dvě okénka (kvůli výsledku
  10), vlastník to nechává (#42).
- 2026-11-04 Nový vzhled celé hry „Apple style“: světlé pozadí #F5F5F7,
  systémové písmo (-apple-system), tmavý text #1D1D1F, šedý otazník,
  plné malé hvězdičky, tlačítka s čísly světle modrá #E5F0FF s okrajem
  #B8D6FF a modrými tučnými číslicemi #0062CC (varianta A3 z návrhů).
- 2026-11-04 Hra má jít dobře hrát i na mobilu, na šířku i na výšku, každé
  s vlastním rozložením. Na telefonu jsou dnes moc malé hvězdičky, moc velké
  kolečko nastavení a malá plocha na psaní. Tím se otevírá odložené #34.
- 2026-11-04 Na telefonu na šířku má číselník do 10 tvar 4 × 3 a tečky
  nápovědy zůstávají po pěti v řadě jako na iPadu (#54, #30). (číselník 4 × 3 nahrazen)
- 2026-11-04 Telefon na šířku podle návrhu V2: nahoře hvězdičky, uprostřed
  postavička s příkladem, dole přes šířku číselník (do 10 jako 6 + 5). Tečky
  nápovědy vedle příkladu, po pěti v řadě. Výjimka z 64 px: ťukací plocha
  tečky na telefonu smí mít 48 px, jinak se nevejde (#54, #43).
- 2026-11-04 Psaní do 5 na nejnižších telefonech: okénko smí mít 180 px místo
  200 px, rozložení zůstane jednotné (příklad pod hvězdičkami) (#54).
- 2026-11-04 Telefon na výšku podle návrhu P2: nahoře hvězdičky, postavička
  vedle příkladu, tečky nápovědy pod příkladem, dole číselník ve 3 sloupcích
  (velká tlačítka u palce), při psaní dvě okénka vedle sebe a pod nimi smazat a ✓.
- 2026-11-04 Nastavení a průvodce na telefonu podle obrázků S: na šířku řady
  vlevo s popisky, ✓ (u průvodce rada a tlačítka) vpravo; na výšku řady pod
  sebou jako na iPadu, ✓ nebo tlačítka průvodce dole u palce.
- 2026-11-03 Vracení příkladů, ve kterých se dítě spletlo, zamítnuto (návrh
  neprošel kontrolou, vlastník zvolil jiný úkol). Neopakovat.

- 2026-11-03 Psaní odpovědi prstem: bude to volba v nastavení pro rodiče
  (číselník zůstane), rozpoznané číslo dítě před vyhodnocením potvrdí nebo
  přepíše. Rozpoznávání jen v zařízení, bez cizích serverů.
- 2026-11-03 Sada tahů pro ověření rozpoznávání: nejdřív veřejná sada (např.
  UCI Pen-Based Digits, CC BY 4.0), vlastní tahy vlastníka později. Úkol psaní
  prstem zůstává vcelku (nedělit na rozpoznávání a psaní ve hře).

## Repozitář a prostředí

- 2026-11-03 Soubory agentů v `.claude/agents/` se neformátují Prettierem,
  zůstávají přesně v podobě od vlastníka (`.prettierignore`).
- 2026-11-03 V cloudu funguje `gh` jen na vyhledávání a adresy `*.workers.dev`
  jsou blokované. Issues se tam čtou přes GitHub nástroje a náhled ověřuje
  vlastník.
- 2026-11-04 Pravidla „ask“ v `.claude/settings.json` zrušena, vlastníka
  obtěžovaly dotazy na povolení. Pravidla „deny“ (hlavní větve, force push,
  deploy, `.env`) zůstávají.
- 2026-11-05 Vlastník nechává: na telefonu na výšku vyhrazené místo pro
  nápovědu i bez nápovědy (#56), čísla ve volbách nastavení netučná (#59)
  a okénko na psaní po výpadku stahování až od dalšího příkladu (#58).
- 2026-11-05 Rozšíření projektu: úvodní menu s výběrem her. Hry jsou
  samostatné části (vlastní kód i testy, navzájem se neovlivňují), společné
  věci ve sdílené části. Práce na menu nebo nové hře pouští jen její testy.
- 2026-11-05 Nastavení pro rodiče (kolečko) má každá hra vlastní, menu
  nastavení nemá. Dnešní hra se jmenuje „Počítání“. Rozšíření se dělá
  v novém sprintu 3, který se založí až po sloučení PR sprintu 2.
- 2026-11-05 Postavičky (Hvězdík, Robík, Plamínek) se z celého projektu
  odstraní. V Počítání místo nich nic, příklad se zvětší, oslava jen
  s konfetami. Nahrazuje rozhodnutí z #33 a pravidlo o postavičkách v CLAUDE.md.
  (zákaz postaviček v obrázcích nahrazen)
- 2026-11-05 Úvodní menu bude robustní a her bude hodně: výběr her, profily,
  jazyk a zatím neurčené další volby (v menu jen jako zástupné prvky).
- 2026-11-05 Profil dítěte: přezdívka (nemusí být skutečné jméno) a barva
  nebo obrázek, uložené jen v zařízení. Každý profil má vlastní postup
  a nastavení her.
- 2026-11-05 Víc jazyků: připravit prostředí, aby šlo snadno přidávat texty
  i nahrávky dalších jazyků. Výjimka z „texty ve hře česky“ v CLAUDE.md.
- 2026-11-05 Vlastník plánuje paywall a předplatné. Projekt se má připravit,
  aby šlo předplatné spravovat (které hry jsou odemčené). Skutečné placení
  zatím ne: potřebuje cizí službu a změnu pravidel o soukromí v CLAUDE.md,
  rozhodne se samostatně.
- 2026-11-05 Vzhled menu podle návrhu B: nahoře profil (barevné kolečko
  s písmenem a přezdívkou), vpravo jazyk a zástupná tlačítka, vlevo kategorie
  (na telefonu nahoře v řadě), vedle mřížka dlaždic her. Při startu výběr
  profilu (návrh P: velká barevná kolečka a +). (výběr při startu nahrazen) (řada na telefonu na výšku nahrazena)
- 2026-11-05 Z hry do menu se dítě vrátí domečkem vlevo nahoře podržením
  1 s, ťuknutí domeček jen zhoupne.
- 2026-11-05 (nahrazeno) Profil zakládá rodič: formulář se otevře podržením „+“ 1 s,
  přezdívka se píše systémovou klávesnicí jen v tomto poli. Výjimka
  z „žádná klávesnice“ v CLAUDE.md. (klávesnice nahrazena)
- 2026-11-05 Výběr profilu (P) se při startu ukáže jen při dvou a více
  profilech, s jedním se jde rovnou do menu.
- 2026-11-05 Počítání je v kategorii „Sčítání a odčítání“, první kategorie
  je „Vše“, název stránky v menu „Matematika“, ve hře název hry.
- 2026-11-05 Systémová klávesnice se nepoužívá vůbec, všechno dotykem.
  Přezdívka profilu se ťuká vlastní mřížkou velkých písmen A–Ž (64 px)
  se smazáním. Na PC jde psát i fyzickou klávesnicí.
- 2026-11-05 Obrázky k menu schválené podle doporučení (#67–#73): hvězdičky
  na telefonu na výšku ve 2 řadách po 5 mezi domečkem a kolečkem, menu na
  šířku s kategoriemi vlevo, paleta 8 barev s kontrastem aspoň 3 : 1,
  výběr profilu na šířku v 1 řadě a na výšku ve 2 sloupcích, mřížka písmen
  ve 2 vrstvách, 2. krok formuláře barva s košem jen při úpravě, plné „CS“
  i na výběru profilu, potvrzení smazání se „Zpět“ na místě ✓.
- 2026-11-05 Telefon na šířku s domečkem podle návrhu C (#68): nahoře pás
  s příkladem, tečkami nápovědy hned vedle a hvězdičkami 2 × 5 u kolečka,
  dole číselník přes celou šířku (do 20 ve 3 řadách po 7, do 10 jako 6 + 5).
  Tečky jdou souvisle po pěti v řadě (druhé číslo pokračuje v řadě prvního).
  Dřívější rozložení s tečkami nahoře daleko od příkladu vlastník zamítl.
- 2026-11-06 Zrychlení testů rozpoznávání psaní zamítnuto: bez zmenšení
  vzorků jde ušetřit jen pár procent. Neopakovat bez nového nápadu.
- 2026-11-06 Návrhy z review kódu (#75–#78) podle doporučení: u dvou panelů
  jen bez ztráty dat (zobrazení víc než 6 profilů samostatně), u přidání na
  plochu bez iPadu na výšku, obnovení stránky jen při nestažené hře
  s odpovídajícím serverem.
- 2026-11-06 Testování se zjednoduší: při práci se pouští jen testy dotčené
  části (sdílená část, menu, hra) a vždy kontroly celku, celé `npm test` jen
  v CI a před PR. Pomalé testy rozpoznávání psaní do vlastní skupiny, testy
  rozložení jako pravidla v cyklu místo snapshotů a testy zdrojového textu
  přepsat na chování. Ochrany se nesnižují, žádný test chování se nesmaže bez
  náhrady. Hooky v `.claude/` mění vlastník sám (nahrazeno). Úkoly #79–#83 před #78.
- 2026-11-06 Ikona aplikace na plochu: varianta A, modré „+ −“ na #F5F5F7 (#78).
- 2026-11-06 Testy sharpCanvas z #77 patří do #81. Všechny nové testy rovnou
  jako pravidla v cyklu (jeden test na pravidlo, popis případu v `expect`),
  ne parametry po jednom oknu.
- 2026-11-07 Testy rozložení menu: posouvaný obsah se smí dotknout lišty,
  druhé posouvané plochy a spodního okraje (0 px, nic se nepřekrývá), jak je
  v dnešním rozložení. Úprava rozložení na 8 px se nedělá (#82, varianta A).
- 2026-11-07 Zrcadlově napsané číslo hra jen přijme, ukázání správného tvaru
  je samostatný úkol (#85, #86).
- 2026-11-07 Tlačítko nápovědy (#84) schváleno, symbol je modrý otazník „?“
  v tlačítku místo barevných teček. Na telefonu na šířku rozložení
  s nápovědou hned od začátku (menší příklad), po ťuknutí se nic neposune.
  (symbol nahrazen)
- 2026-11-07 iPad z plochy (#78): vlastník nechal na Claudovi, zvolena
  varianta A, malá úprava rozložení nastavení a průvodce na iPadu tak, aby
  respektovalo stavový řádek a lištu domů.
- 2026-11-07 Tlačítko nápovědy (#84) nesmí vypadat jako tlačítka čísel: kulaté
  se žárovkou (varianta C). Výjimka z 64 px: v okně iPadu 932 × 500 u číselníku
  do 20 smí mít tlačítko asi 60 px (59,8 px), mezera 8 px od číselníku zůstává.
- 2026-11-07 Hra Omalovánky: prototyp s jednou testovací omalovánkou a sadou
  kreslicích nástrojů, rozdělený na víc úkolů. Barví se jen tahy prstem nebo
  tužkou, žádná automatická výplň. Tah je ořezaný do oblasti, kde začal,
  přetažení mimo ni nic nezabarví.
- 2026-11-07 Kategorie v menu na telefonu na výšku: když se nevejdou (od 3.
  kategorie Kreslení, #88), řada se dočasně posouvá prstem. Vlastník chce
  místo toho rozbalovací výběr kategorií, navrhne se jako samostatný úkol
  s obrázky.
- 2026-11-07 Omalovánky si po návratu pamatují naposledy vybranou barvu
  v paletě, i když se jí ještě nemalovalo (#92).
- 2026-11-07 Noční úkoly Omalovánek schváleny podle doporučení (#96–#104 a
  úpravy #90, #91, #93 kvůli panelu): obrázek přes celou obrazovku, panel
  L-A (pruh vlevo) a na výšku P-A (úchyt dole uprostřed), paleta 12 barev
  varianta A (navíc růžová, tělová, šedá, světle modrá). Pořadí #96, #90,
  #93, #91, #97, #98, #99, #100, #101, #102, #103, #104.
- 2026-11-08 Omalovánky: panel nejdřív ukáže jen nástroje, barvy až po
  ťuknutí na nástroj. Každý nástroj má vlastní sadu barev, i vícebarevné,
  tříštivé a duhové. Navrhne se jako nové úkoly.
- 2026-11-08 Kroužek podržení 1 s je jen ve hře u kolečka nastavení
  a domečku. V hlavním menu tlačítka reagují hned (oprava jako nový úkol).
- 2026-11-08 Ikony nástrojů v Omalovánkách jsou nesrozumitelné a složité.
  Musí být na první pohled jasné, co je to za nástroj (nový úkol s obrázky).
- 2026-11-08 Schváleno podle doporučení: #106 ikony ve stylu B „Stopa
  nástroje“, #105 panel ve dvou krocích. Pořadí #106, #105.
- 2026-11-08 Výběr profilu bez podržení: úprava profilu tužkou, „+“
  a kolečko profilu reagují ťuknutím. Smazání profilu zůstane za podržením
  1 s u „Smazat“ v potvrzení (výjimka z kroužku jen ve hře). Tím je
  nahrazeno „Profil zakládá rodič“ z 2026-11-05.
- 2026-11-08 Panel ve dvou krocích podle obrázků schválen (#105). Ikony
  stylu B (#106) se vlastníkovi nelíbí: převzít osvědčené řešení z jiných
  kreslicích aplikací pro děti, nový návrh ukázat na obrázcích.
- 2026-11-08 Ikony nástrojů ve stylu D „skutečné nástroje šikmo“ (podle
  dětských kreslicích aplikací), vybraná barva na hrotu, fixy se liší
  hrotem (#106).
- 2026-11-08 Tužka u profilu (#107) vpravo od kolečka. 6 profilů na iPadu
  a telefonu na šířku ve 2 řadách po 3, na menších telefonech se kolečka
  zmenší. Kroužek podržení u „Smazat“ je bílý (#108).
- 2026-11-08 Hranice testů ikon pro styl D (#106): ikony se stejným tělem
  (fixy, štětec a duhový štětec) se liší aspoň o 10 % včetně barvy, ostatní
  o 25 %. Ikona má kromě obrysu nejvýš 3 barvy a 10 částí.
- 2026-11-08 Ikony stylu D se vlastníkovi pořád nelíbí. Ikony nekreslit
  vlastní, převzít hotovou sadu (s licencí, uloženou v repozitáři) a vybrat
  ji podle obrázků (#106).
- 2026-11-08 Každý nástroj v Omalovánkách si pamatuje vlastní naposledy
  zvolenou barvu (nový úkol).
- 2026-11-08 Ikony nástrojů z hotové sady Google Noto Emoji (Apache-2.0),
  vybraná barva jako barevné kolečko v rohu úchytu místo tečky velikosti.
  Puntíkový fix bubliny, proužkový fix sloupek s pruhy, sprej skvrna (#106).
- 2026-11-08 #110 (každý nástroj si pamatuje svou barvu) schválen podle
  doporučení.
- 2026-11-08 Barvu nástroje v kroku nástrojů panelu ukazuje stejné barevné
  kolečko vpravo dole u ikony jako v úchytu (#110).
- 2026-11-08 Vlastník: „Udělej tvoje doporučení“. #95 (rozbalovací výběr
  kategorií na telefonu na výšku) schválen podle doporučení, obrázky D1–D5
  ukázat. Navrhnout úkoly: větší mezera mezi kolečkem profilu a tužkou,
  kolečko barvy nepřekrývá okraj vybraného nástroje a duhu, vlastní sady
  barev nástrojů a vícebarevné barvy.
- 2026-11-08 Přepínač tloušťky čáry (#91) vlastník vůbec nepoznal. Udělat
  ho jinak, aby bylo na první pohled jasné, že jde o tloušťku (nový úkol
  s obrázky).
- 2026-11-08 Omalovánka má být přes celou výšku mezi horní a spodní lištou.
  Na výšku se obrázek otočí o 90°, aby vyplnil výšku (nový úkol s obrázky).
  (otočení nahrazeno)
- 2026-11-09 Výběr kategorií na telefonu na výšku je rozbalovací seznam
  (#95): symboly Vše ▦, Sčítání a odčítání „+ −“, Kreslení ✎, bez ztmavení.
- 2026-11-09 Vlastní sady barev: každý z 8 nástrojů má vlastní sadu
  (varianta B, 44 barev). Nejdřív samostatný úkol na úspornější ukládání
  obrázku, pak sady.
- 2026-11-09 Postup práce zrychlit (#117): Claude smí upravit hooky
  v `.claude/` sám („klidně oprav hooky“). Testy při konci odpovědi se
  nepouští, před commitem jen `test:changed`, dokumentace testy nespouští.
  Celé `npm test` dál v CI a před PR.
- 2026-11-09 Sady barev (#116): podle doporučení výraznější odstíny puntíkového
  fixu a fixu (víc odlišné od štětce) a modřejší stříbrná třpytek. Nové
  obrázky ukázat před implementací.
- 2026-11-09 Odstíny sad v2 schváleny (#116): fix tmavé inkoustové, puntíkový
  6 jasných vlastních barev (výchozí #FF039F), stříbrná #8D9FC3. Celkem 46 barev.
- 2026-11-10 Sprint 3 sloučen do staging a main, sprint 4 založen ze staging.
  Design se bude dělat přes napojení na ElevenLabs. Hotové soubory budou
  uložené v repozitáři a hra nic nestahuje z cizích serverů.
- 2026-11-10 Design přes ElevenLabs začíná obrázky (dlaždice her atd.). Před
  každým generováním Claude vlastníkovi napíše cenu v kreditech. Obrázky ve hře
  mají být malé soubory, aby se rychle stahovaly.
- 2026-11-10 Zákaz postaviček z 2026-11-05 neplatí pro nový design obrázků
  (dlaždice her atd.), postavičky na obrázcích smí být.
- 2026-11-10 Claude smí stahovat vygenerované obrázky z ElevenLabs (do
  dočasné složky, do hry jen vybrané a zmenšené). Návrhy ukazovat rovnou tak,
  jak by vypadaly ve hře. Styl dlaždic minimalistický a čistý, model GPT
  Image 2.5 (první zkouška Recraft byla nepřehledná).
- 2026-11-10 Vlastník: „ok výjimka“. Zákaz `curl`/`wget` zůstává, stahuje se
  jen nástrojem `tools/design/fetch-image.mjs` (HTTPS, jen
  elevenlabsusercontent.com, jen obrázky). Osobní cloudové prostředí
  „Agentic-app“ povoluje jen tento server navíc.
- 2026-11-10 Dlaždice her: vybrána sada 2 (C2 „+ −“, D2 pastelka s delší
  čárou), pozadí obrázků vybělené do bílé dlaždice. Připravit úkol.
- 2026-11-10 Omalovánky: sada obrázků na výběr a ukládání hotových obrázků
  do alba. Nejdřív funkce (s dnešní testovací omalovánkou), obrázky se
  vytvoří společně potom.
- 2026-11-10 #118 obrázky schváleny („ok 118“): třpytky u nejtenčí malují
  stejně jako u malé (jako puntíkový a proužkový fix), nejtenčí vlnka na
  tlačítku má 1,5 px.
- 2026-11-10 Backend zatím ne. Album Omalovánek v IndexedDB jen v zařízení,
  doporučit přidání hry na plochu (Safari maže data webu po 7 dnech bez
  návštěvy). Backend až s předplatným jako samostatné rozhodnutí.
- 2026-11-10 Obrázky výběru omalovánky schváleny („ok 124“): bez prázdných
  míst (jen skutečné omalovánky), na telefonu na výšku náhledy asi 171 px,
  obrázek vyplní celou dlaždici a zaoblené rohy ho ořežou.
- 2026-11-10 Skutečné omalovánky: kočka, pejsek, auto, motýl, rybka (plus
  domek), GPT Image 2.5, každý obrázek jen v 1 variantě, generuje se po 5
  obrázcích (asi 73 kreditů za obrázek).
- 2026-11-10 Sada 5 omalovánek (kočka, pejsek, auto, motýl, rybka) schválena
  tak, jak je. Na telefonu na výšku se omalovánky s postavičkami neotáčí
  (menší obrázek přes šířku). Nahrazuje otočení o 90° z 2026-11-08.
- 2026-11-10 #125 schváleno podle doporučení (vývojová závislost
  `fake-indexeddb` jen pro testy). Úkol B (fotoaparát a kniha) založit
  s upřesněním „cvaku“ podle doporučení.
- 2026-11-10 #126, #127 a #128 schváleny podle doporučení. Na výšku se
  neotáčí žádná omalovánka, ani domek (rozšíření rozhodnutí o postavičkách,
  domek bude na výšku asi o 44 % menší). Obrysy omalovánek jako PNG, limit
  sady 131 072 B. Pořadí: #125, #126, #127, #128.
- 2026-11-10 Obrázky #126 schváleny podle doporučení: ikony 📷 (fotoaparát)
  a 📔 (album), na telefonu na šířku kniha 8 px od náhledů výběru (16 px se
  nevejde), animace cvak, zmenšení a odlet do fotoaparátu.
- 2026-11-10 Obrázky #127 schváleny („Ok 127“): na výšku obrázek rovně přes šířku (390 × 844 → 374 × 280,5 px, 360 × 620 → 344 × 258 px).
- 2026-11-10 Obrázky #128 schváleny („Ok 128“): výběr se 6 omalovánkami a malování kočky, obrysy PNG s 16 úrovněmi průhlednosti podle doporučení.
- 2026-11-10 #129 (velký obrázek z alba a smazání) schválen podle doporučení: koš s kroužkem podržení 1 s je nová výjimka z pravidla o kroužku jen u kolečka a domečku. Malovat dál bude samostatný úkol B ve sprintu 4.
- 2026-11-10 Obrázky #129 schváleny („Ok“): koš 🗑️ na místě fotoaparátu, velký obrázek velký jako v malování (na šířku posun doprava kvůli 16 px od koše), bílý kroužek podržení.
- 2026-11-10 Zrychlení postupu: obrázky před schválením jen u úkolů, které mění vzhled (drobné úpravy ukázat až po implementaci), a víc úkolů (2–3) se navrhuje a schvaluje najednou jedním „ok“, Claude je pak dělá za sebou bez čekání. Testy předem a pomalé testy při commitu zůstávají.
- 2026-11-11 #130, #131 a #132 schváleny podle doporučení (pořadí #130, #131, #132). Druhá sada omalovánek: moře, mořská panna, duha, vánoční baňka, jednorožec (365 kreditů). U #132 kvóta localStorage: teď přijmout, změřit a při překročení poloviny kvóty založit úkol na přesun stránek do IndexedDB ještě v tomto sprintu.
- 2026-11-11 #130: panel nástrojů Omalovánek začíná po každém otevření zavřený, i při úplně prvním otevření v profilu. Nahrazuje automatické otevření panelu při prvním otevření z #96 AC2 a #105 AC1.
- 2026-11-11 Obrázky #131 schváleny („ok“): tlačítko malovat dál se štětcem 🖌️, na šířku 16 px nad košem, na výšku 16 px vlevo od koše.
- 2026-11-11 Obrázky #132 schváleny („ok“): výběr 11 omalovánek v mřížce alba (4 sloupce na šířku, 3 na výšku), moře zjednodušené o 4 malé bublinky (obrys 32 036 B).
- 2026-11-11 Nová mapa postupu v Počítání: #133 (3 kroky, 5 map se střídají), #134 (obrázky z ElevenLabs, asi 730 kreditů, nejdřív zkouška 1 mapy za 146), #135 (animace cesty a cíle), #136 (pohyby prostředí) schváleny podle doporučení, pořadí po #132.
- 2026-11-12 Obrázky #135 schváleny („ok“): zlatá stopa za značkou, rozsvícení zastávky září kolem značky s jiskřičkami, cíl zvětšený 1,3× se zlatou září a konfetami; cíl se na mapě posune doleva, aby se zvětšený vešel celý.
- 2026-11-12 #137 a #138 schváleny („ok 137 138“). Nahrávky jazyků vytváří Claude automaticky přes napojení ElevenLabs (MCP) místo skriptu u vlastníka; nahrazuje „vytvoří najednou skript … který vlastník spustí u sebe“ z 2026-11-04. Podmínka: každý jazyk má pořád stejný hlas (hlas jazyka je pevně v `tools/voice/voice.config.json` a nemění se). Stažení nahrávky do repa jen úzkou výjimkou jako u obrázků (HTTPS, jen elevenlabsusercontent.com, jen mp3).
- 2026-11-12 V nabídce jazyků v menu bude u každého jazyka vlajka (součást #138). Vlajky jako SVG ze sady Noto Emoji uložené v repozitáři (systémové emoji vlajek se na Windows nezobrazí).
