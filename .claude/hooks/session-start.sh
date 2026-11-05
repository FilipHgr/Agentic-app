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

# Sprintové větve na GitHubu (nová session začíná na výchozí větvi)
git fetch --quiet origin 2> /dev/null
sprint_branches=$(git branch -r --list 'origin/sprint-*' 2> /dev/null | tr -d ' ')
if [ -n "$sprint_branches" ]; then
  echo "Sprintové větve: $sprint_branches"
fi

# Rozpracovaný úkol = otevřené issue se štítkem „rozpracováno“
if ! issue=$(gh issue list --label "rozpracováno" --state open --json number --jq '.[0].number' 2> /dev/null); then
  echo "Nepodařilo se zjistit rozpracovaný úkol přes gh."
  echo "Když gh nefunguje (třeba v cloudu), najdi GitHub nástroji otevřené issue"
  echo "se štítkem „rozpracováno“ a načti jeho komentáře, než budeš pokračovat."
  exit 0
fi

if [ -z "$issue" ]; then
  exit 0
fi

echo ""
echo "ROZPRACOVANÝ ÚKOL: #$issue"
echo "Přepni se do jeho sprintové větve a pokračuj podle skillu novy-ukol"
echo "(sekce 3) a predani-ukolu. Výsledky agentů, které už proběhly, jsou"
echo "v komentářích níže, neopakuj je."
echo ""

if issue_text=$(gh issue view "$issue" --comments 2> /dev/null); then
  echo "$issue_text" | tail -n 200
else
  echo "Issue se nepodařilo načíst přes gh, načti #$issue i s komentáři GitHub nástroji."
fi

exit 0
