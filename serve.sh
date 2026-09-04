#!/bin/sh
# Serves this directory on http://localhost:8090
# Classic <script src> and <link rel=stylesheet> loads need no CORS headers,
# so the stdlib server is enough.
exec python3 -m http.server 8090 --directory "$(dirname "$0")"
