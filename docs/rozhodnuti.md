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

## Hra

- 2026-11-02 Odpověď se zadává číselníkem 0 až zvolený rozsah, ne výběrem ze
  tří čísel. Ze tří čísel šlo výsledek uhodnout (#30).
- 2026-11-02 Nápověda s tečkami se ukáže po 2. chybě. Tečky jsou velké, po pěti
  v řadě a každé číslo má svou barvu (#30).
- 2026-11-02 Hvězdička se dává za každý vyřešený příklad, i s nápovědou. Po
  deseti přijde oslava (#31).
- 2026-11-02 Sovička se ruší. Hlavní postavičky jsou Hvězdík, Robík
  a Plamínek, střídají se po každé oslavě a začíná Hvězdík (#33).
- 2026-11-03 Hra na celou obrazovku a rozložení na výšku: implementace se
  vlastníkovi nelíbila, vráceno a odloženo (#34). Znovu nenavrhovat bez
  upřesnění od vlastníka.
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
  rozpoznávání dětského písma zatím nikdo neměřil).
- 2026-11-04 Hlasový dabing průvodce nastavením: dospělý hlas (ne
  postavička), v průvodci nejde vypnout, texty se upraví pro mluvení.
  Nahrávky mp3 jsou předem v repozitáři, hra je nikde nestahuje. Všechny
  vytvoří najednou skript přes ElevenLabs, který vlastník spustí u sebe
  se svým klíčem.
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
