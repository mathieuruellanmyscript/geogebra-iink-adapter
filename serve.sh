#!/bin/sh
# Serves this directory on http://localhost:8090
# Classic <script src> and <link rel=stylesheet> loads need no CORS headers,
# so the stdlib server is enough.
dir="$(dirname "$0")"

# Dev-only key override: .env (gitignored) -> dev-keys.js (gitignored),
# which test.html loads and the adapter prefers over its DEFAULT_* keys.
rm -f "$dir/dev-keys.js"
if [ -f "$dir/.env" ]; then
  . "$dir/.env"
  cat > "$dir/dev-keys.js" <<EOJS
window.MYSCRIPT_DEV_KEYS = {
  applicationKey: '$MYSCRIPT_APPLICATION_KEY',
  hmacKey: '$MYSCRIPT_HMAC_KEY'
};
EOJS
  echo "dev-keys.js written from .env"
fi

exec python3 -m http.server 8090 --directory "$dir"
