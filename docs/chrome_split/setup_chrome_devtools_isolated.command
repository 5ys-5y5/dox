#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/setup_chrome_devtools_isolated.mjs"
echo
echo "작업이 끝났습니다. 이 Codex 창만 닫고 다시 열어주세요."
echo "기존 다른 LLM 창은 닫지 마세요."
echo
echo "창을 닫으려면 Enter를 누르세요."
read -r _
