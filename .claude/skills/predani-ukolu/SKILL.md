---
name: predani-ukolu
description: Předání hotového úkolu vlastníkovi – push, odkaz na náhled na Cloudflare a PR na konci sprintu. Použij vždy, když je úkol ze sprintu hotový a commitnutý, nebo když se sprint uzavírá.
---

# Předání úkolu

Kontroly kódu (testy, review, bezpečnost, UX) proběhly už před commitem
ve skillu `novy-ukol`. Tady se jen předává. Výsledky agentů ber vždy
z komentářů v issue (`gh issue view <číslo> --comments`), ne z paměti.

## 1. Push a náhled

1. Ověř `npm run build`. Musí projít.
2. Pushni větev sprintu: `git push -u origin sprint-<číslo>`.
3. Cloudflare Workers Builds po pushi postaví náhled sám. Nikdy nespouštěj
   `npm run deploy`, `wrangler deploy` ani `wrangler preview`.
4. Pošli vlastníkovi:
   - odkaz na náhled
     `https://sprint-<číslo>-agentic-app.hegerfilip027.workers.dev`
     (název větve malými písmeny),
   - co je hotové (číslo a název issue),
   - tabulku: akceptační kritérium → test (z výstupu `test-writer`),
   - co má zkontrolovat na iPadu: RUČNÍ KONTROLA od `test-writer`
     a RUČNĚ OVĚŘIT NA IPADU od `ux-checker`,
   - nevyřešená DOPORUČENÍ od kontrolních agentů, každé jednou větou.
5. Pokud kontrola „Workers Builds“ selže nebo náhled nejde ověřit, řekni
   to na rovinu.
6. Změň štítek issue z „rozpracováno“ na „předáno“
   (`gh issue edit <číslo> --remove-label rozpracováno --add-label předáno`).

## 2. Konec sprintu a PR

Sprint končí jen tehdy, když to výslovně řekne vlastník. Uzavření sprintu
ani PR sám nenavrhuj, ani když jsou všechny úkoly hotové. Po pokynu
vlastníka:

1. Zavolej subagenta `security-auditor` nad celým sprintem
   (`git diff origin/staging...HEAD`). Blokující nálezy oprav jako
   samostatný commit ve větvi sprintu, nebo je vlastníkovi nahlas.
2. Otevři PR z `sprint-<číslo>` do `staging`, nikdy do `main`.
   Build před otevřením PR kontroluje hook.
3. Vyplň šablonu `.github/pull_request_template.md`: `Closes #…` pro každý
   úkol, co se změnilo, odkaz na náhled, tabulka kritérií a testů, nové
   závislosti a výsledek `npm audit` (z výstupu `security-auditor`)
   a drobnosti mimo úkoly.
4. Pošli vlastníkovi odkaz na PR. Slučuje vlastník.
5. Po otevření PR přidá bot Cloudflare do PR komentář s výsledkem
   nasazení náhledu. Zkontroluj, že je tam „Success“, a jinak to řekni.

## 3. Po sloučení

`Closes #…` zavírá issue jen při sloučení do `main`, ne do `staging`.
Až vlastník napíše, že PR sloučil:

1. Ověř, že PR je opravdu sloučený.
2. Zavři issues sprintu ručně jako dokončené.
