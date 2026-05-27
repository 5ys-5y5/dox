#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/audit_chrome_devtools_processes.mjs" "$@"
echo
echo "감사가 끝났습니다. 이 창을 닫으려면 Enter를 누르세요."
read -r _
