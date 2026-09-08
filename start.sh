#!/bin/zsh
set -e
cd "$(dirname "$0")"
APP_VENV=".venv-py313"
export UV_CACHE_DIR="${PWD}/.uv-cache"
export PADDLE_PDX_CACHE_HOME="${PWD}/output/.paddlex"
if [ ! -x "${APP_VENV}/bin/python" ]; then
  if command -v python3.13 >/dev/null 2>&1; then
    python3.13 -m venv "${APP_VENV}"
  elif command -v uv >/dev/null 2>&1; then
    uv venv --python 3.13 "${APP_VENV}"
  else
    echo "PaddleOCR-VL richiede Python 3.9-3.13. Installa Python 3.13 o uv." >&2
    exit 1
  fi
fi
if ! "${APP_VENV}/bin/python" -m pip --version >/dev/null 2>&1; then
  "${APP_VENV}/bin/python" -m ensurepip --upgrade
fi
if ! "${APP_VENV}/bin/python" -c 'import paddle' >/dev/null 2>&1; then
  "${APP_VENV}/bin/python" -m pip install paddlepaddle==3.2.1 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
fi
"${APP_VENV}/bin/python" -m pip install -q -r requirements.txt
"${APP_VENV}/bin/python" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
cd ui
if [ ! -d node_modules ]; then
  npm install
fi
echo
echo "Controllo contabile  http://127.0.0.1:5173"
echo
npm run dev
