#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/setup_split_chrome_devtools.mjs"
echo
echo "작업이 끝났습니다. 이 창을 닫으려면 Enter를 누르세요."
read -r _
