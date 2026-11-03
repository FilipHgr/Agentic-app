#!/bin/bash
# SessionStart hook: běží na začátku session, po /clear i po komprimaci kontextu.
# Co se vypíše na stdout, dostane Claude jako kontext.

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Závislosti (hlavně v cloudu, kde se začíná načisto)
if [ ! -d node_modules ]; then
  if ! npm ci > /dev/null 2>&1; then
    echo "Pozor: npm ci selhalo, závislosti nejsou nainstalované."
  fi
fi

echo "Aktuální větev: $(git branch --show-current)"

# Rozpracovaný úkol: číslo issue zapisuje skill novy-ukol
state_file=".claude/state/aktualni-ukol"
if [ ! -s "$state_file" ]; then
  exit 0
fi

issue=$(tr -dc '0-9' < "$state_file")
if [ -z "$issue" ]; then
  exit 0
fi

echo ""
echo "ROZPRACOVANÝ ÚKOL: #$issue"
echo "Pokračuj podle skillu novy-ukol (sekce 3) a predani-ukolu."
echo "Výsledky agentů, které už proběhly, jsou v komentářích níže, neopakuj je."
echo ""

if issue_text=$(gh issue view "$issue" --comments 2>/dev/null); then
  echo "$issue_text" | tail -n 200
else
  echo "Issue se nepodařilo načíst, spusť: gh issue view $issue --comments"
fi

exit 0
