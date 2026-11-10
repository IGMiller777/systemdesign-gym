#!/bin/zsh
# Double-click in Finder: opens Terminal, starts web + api, opens the browser.
# Ctrl+C (or closing the window) stops both.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$(realpath "$0")")/.." || exit 1

free() { ! lsof -iTCP:$1 -sTCP:LISTEN -t >/dev/null 2>&1 }
# First free pair of neighbouring ports in 5800-5810 (only these are forwarded).
for p in 5800 5802 5804 5806 5808; do
  if free $p && free $((p + 1)); then export WEB_PORT=$p API_PORT=$((p + 1)); break; fi
done
if [[ -z $WEB_PORT ]]; then
  echo "Все порты 5800-5810 заняты:"; lsof -iTCP:5800-5810 -sTCP:LISTEN
  read -k1 "?Нажми любую клавишу..."; exit 1
fi

echo "sysdesign-gym: http://localhost:$WEB_PORT (api :$API_PORT). Остановить: Ctrl+C"
(sleep 4 && open "http://localhost:$WEB_PORT") &
pnpm dev
