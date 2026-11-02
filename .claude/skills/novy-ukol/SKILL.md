---
name: novy-ukol
description: Navržení nového úkolu do hry jako GitHub issue (user story a akceptační kritéria ke schválení) a zahájení práce na schváleném úkolu. Použij, když vlastník chce nový úkol, další návrhy, nebo napíše, že issue schválil.
---

# Nový úkol

Úkoly vymýšlí Claude, vlastník je jen schvaluje nebo upravuje. Nic z toho
nepiš do chatu jako hotové zadání, zadání žije v GitHub issue.

## 1. Návrh

1. Podívej se, co hra už umí (`src/`, `tests/`) a co je v otevřených
   issues, ať se nic nezdvojí.
2. Vyber nejmenší další krok, který hru znatelně posune. Drž se pravidel
   z `CLAUDE.md` (jedna hlavní mechanika, dotyk, chyba netrestá, nic navíc).
3. Založ issue podle šablony `.github/ISSUE_TEMPLATE/user-story.md`
   se štítkem „ke schválení“:
   - user story „Jako … chci …, abych …“,
   - 3–7 akceptačních kritérií (AC1, AC2, …) z pohledu hráče, každé
     ověřitelné testem, včetně okrajových případů,
   - co je mimo rozsah,
   - otevřené otázky, u každé doporučená odpověď.
4. Najednou navrhni jeden úkol, pokud vlastník nechce víc.
5. Pošli vlastníkovi odkaz na issue a v jedné větě, o čem je.

## 2. Schválení

Claude nesleduje issues sám, o schválení se dozví jen z chatu. Vlastník
nemusí psát „ok“ na dvě místa:

- „ok“ (nebo „ok #číslo“) v chatu = schváleno bez připomínek,
- připomínky v chatu = zapracuj je do těla issue,
- „připomínky v issue“ v chatu = přečti si komentáře v issue
  a zapracuj je do těla issue.

Po schválení:

1. Nezodpovězená otevřená otázka znamená, že platí doporučení. Napiš
   to vlastníkovi.
2. Do issue přidej komentář, že vlastník úkol schválil v chatu, a co
   z připomínek bylo zapracováno.
3. Změň štítek na „schváleno“.

## 3. Zahájení práce

1. Pokud běží sprint (větev `sprint-<číslo>` ještě není sloučená),
   pokračuj v ní. Jinak vytvoř novou větev `sprint-<další číslo>`
   ze `staging`.
2. Úkol udělej jako vlastní commit, zpráva začíná `#<číslo issue>`.
3. Každé akceptační kritérium musí mít aspoň jeden test (viz sekce
   Testování v `CLAUDE.md`).
4. Po dokončení pokračuj skillem `predani-ukolu`.
