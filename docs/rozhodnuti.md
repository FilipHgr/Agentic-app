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
  profilu (návrh P: velká barevná kolečka a +). (výběr při startu nahrazen)
- 2026-11-05 Z hry do menu se dítě vrátí domečkem vlevo nahoře podržením
  1 s, ťuknutí domeček jen zhoupne.
- 2026-11-05 Profil zakládá rodič: formulář se otevře podržením „+“ 1 s,
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
  náhrady. Hooky v `.claude/` mění vlastník sám. Úkoly #79–#83 před #78.
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
- 2026-11-07 iPad z plochy (#78): vlastník nechal na Claudovi, zvolena
  varianta A, malá úprava rozložení nastavení a průvodce na iPadu tak, aby
  respektovalo stavový řádek a lištu domů.
