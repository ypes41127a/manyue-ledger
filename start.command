#!/bin/sh
# 雙擊啟動本機預覽（關閉這個視窗即停止）
cd "$(dirname "$0")" || exit 1
PATH="$PWD/.tools/node/bin:$PATH" npm start
