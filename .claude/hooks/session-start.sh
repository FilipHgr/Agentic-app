#!/bin/bash
# SessionStart hook: připraví prostředí (hlavně v cloudu, kde se začíná načisto).
# Co se vypíše na stdout, dostane Claude jako kontext.

cd "$CLAUDE_PROJECT_DIR" || exit 0

if [ ! -d node_modules ]; then
  if ! npm ci > /dev/null 2>&1; then
    echo "Pozor: npm ci selhalo, závislosti nejsou nainstalované."
  fi
fi

echo "Aktuální větev: $(git branch --show-current)"
exit 0
