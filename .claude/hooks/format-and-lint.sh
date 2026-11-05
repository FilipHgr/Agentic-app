#!/bin/bash
# PostToolUse hook po úpravě souboru: naformátuje ho a zkontroluje ESLintem.
# Exit kód 2 = Claude dostane chyby a opraví je (úprava už proběhla).

file=$(node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(data.tool_input.file_path || "");
')

# Kontrolujeme jen soubory, kterým rozumí Prettier a ESLint
case "$file" in
  *.ts | *.js | *.json | *.css | *.html) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Formátování: chyby nejsou blokující
npx prettier --write "$file" > /dev/null 2>&1

# ESLint jen pro kód
case "$file" in
  *.ts | *.js)
    if ! output=$(npx eslint "$file" 2>&1); then
      echo "ESLint našel chyby v $file, oprav je:" >&2
      echo "$output" | tail -n 40 >&2
      exit 2
    fi
    ;;
esac

exit 0
