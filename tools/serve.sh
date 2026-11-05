#!/usr/bin/env bash
# 本地预览：./tools/serve.sh [端口]   停止：./tools/serve.sh stop
set -e
cd "$(dirname "$0")/.."
PID=/tmp/collage-http.pid
if [ "$1" = "stop" ]; then
  [ -f "$PID" ] && kill "$(cat $PID)" 2>/dev/null || true
  rm -f "$PID"; echo "已停止"; exit 0
fi
PORT="${1:-8080}"
[ -f "$PID" ] && kill "$(cat $PID)" 2>/dev/null || true
nohup python3 -m http.server "$PORT" --bind 0.0.0.0 >/tmp/collage-http.log 2>&1 &
echo $! > "$PID"
sleep 1
echo "预览地址：http://127.0.0.1:$PORT  （同局域网可用 http://$(hostname -I | awk '{print $NF}'):$PORT）"
