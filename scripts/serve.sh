#!/usr/bin/env bash
# Serve the app over http so the service worker registers.
# Opening web/index.html as a file:// URL will NOT work.
cd "$(dirname "$0")/../web" && exec python3 -m http.server "${1:-8000}"
