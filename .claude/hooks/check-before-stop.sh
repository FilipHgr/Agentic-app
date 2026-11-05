#!/bin/bash
# Stop hook: když jsou v repu neuložené změny, Claude neskončí, dokud neprojdou testy.
# Exit kód 2 = Claude pokračuje v práci a dostane výstup testů.

active=$(node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(data.stop_hook_active ? "true" : "false");
')

# Pojistka proti nekonečné smyčce: druhý pokus o konec už pustíme
if [ "$active" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Žádné změny = není co kontrolovat (třeba Claude jen odpovídal na otázku)
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

if ! output=$(npm test --silent 2>&1); then
  echo "Testy neprošly, oprav je, než skončíš:" >&2
  echo "$output" | tail -n 40 >&2
  exit 2
fi

exit 0
