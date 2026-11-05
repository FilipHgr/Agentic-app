#!/bin/bash
# PreToolUse hook pro Bash: zkontroluje příkaz dřív, než se spustí.
# Exit kód 2 = příkaz se nespustí a Claude dostane důvod (text na stderr).

command=$(node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(data.tool_input.command || "");
')

block() {
  echo "ZABLOKOVÁNO: $1" >&2
  exit 2
}

# 1) Push: žádný force push, nic do main ani staging
if echo "$command" | grep -Eq 'git[[:space:]]+push'; then
  if echo "$command" | grep -Eq '(--force|[[:space:]]-f([[:space:]]|$))'; then
    block "force push je zakázaný."
  fi
  if echo "$command" | grep -Eq '(^|[^a-zA-Z0-9-])(main|staging)([^a-zA-Z0-9-]|$)'; then
    block "push do main nebo staging je zakázaný. Pushni sprintovou větev a otevři PR."
  fi
fi

# 2) Deploy dělá Cloudflare po sloučení do main
if echo "$command" | grep -Eq 'wrangler|npm[[:space:]]+run[[:space:]]+deploy'; then
  block "deploy je zakázaný, nasazení dělá Cloudflare po sloučení do main."
fi

# 3) Slučování PR dělá jen vlastník
if echo "$command" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+merge'; then
  block "PR slučuje jen vlastník."
fi

# 4) Soubory .env (zachytí i cat, head, cp a podobně)
if echo "$command" | grep -Eq "(^|[[:space:]/=\"'])\\.env"; then
  block "práce se soubory .env je zakázaná."
fi

# 5) Před každým commitem musí projít testy a lint
if echo "$command" | grep -Eq 'git[[:space:]]+commit'; then
  cd "$CLAUDE_PROJECT_DIR" || exit 0

  if ! output=$(npm test --silent 2>&1); then
    echo "Commit zablokován, testy neprošly:" >&2
    echo "$output" | tail -n 40 >&2
    exit 2
  fi

  if ! output=$(npm run lint --silent 2>&1); then
    echo "Commit zablokován, lint neprošel:" >&2
    echo "$output" | tail -n 40 >&2
    exit 2
  fi
fi

# 6) Před otevřením PR musí projít build
if echo "$command" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+create'; then
  cd "$CLAUDE_PROJECT_DIR" || exit 0

  if ! output=$(npm run build --silent 2>&1); then
    echo "PR zablokován, build neprošel:" >&2
    echo "$output" | tail -n 40 >&2
    exit 2
  fi
fi

exit 0
