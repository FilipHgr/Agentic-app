# Agentic-app

Webová hra na výuku matematiky pro děti. Cílové zařízení je iPad na šířku,
ovládání jen dotykem.

## Vývoj

```
nvm use          # Node LTS podle .nvmrc
npm install
npm run dev      # otevři vypsanou adresu „Network:“ na iPadu
```

| Příkaz          | K čemu                                     |
| --------------- | ------------------------------------------ |
| `npm run dev`   | vývojový server, dostupný i z iPadu v síti |
| `npm test`      | testy herní logiky (Vitest)                |
| `npm run lint`  | ESLint a kontrola formátování              |
| `npm run build` | produkční build do `dist/`                 |

## Struktura

- `src/logic/` – herní logika v čistém TypeScriptu, bez Phaseru, testovatelná
  bez prohlížeče
- `src/scenes/` – Phaser scény, které logiku jen volají
- `tests/` – testy logiky

## Nasazení na Cloudflare Workers

Hra běží jako Worker `agentic-app`, který servíruje statické soubory z `dist`.

### Náhled větve

Každá větev si může nasadit vlastní náhled, nezávislý na produkci:

```
npm run deploy:preview
```

Náhled se pojmenuje podle aktuální git větve a vypíše adresu ve tvaru
`https://<větev>-agentic-app.<subdomena>.workers.dev`. Stejný náhled vzniká
automaticky při pushi do větve, pokud je zapnuté Cloudflare Workers Builds.

Po domergování větve náhled zruš:

```
npm run deploy:preview:delete
```

### Produkce

Ze `staging` nebo `main`, nikdy z feature větve:

```
npm run deploy
```

Nasazení vyžaduje přihlášení přes `npx wrangler login`.
