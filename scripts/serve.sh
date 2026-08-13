#!/usr/bin/env bash
# Serve the app over http so the service worker registers.
# Opening web/index.html as a file:// URL will NOT work.
#
# `no-store` is a development-only header. python3's http.server sends no
# Cache-Control at all, so the browser invents a freshness lifetime and a just-
# edited module keeps being served from its own cache — you bump CACHE in sw.js,
# reload, and still get the old file. Nothing here ships; GitHub Pages sets its
# own headers.
cd "$(dirname "$0")/../web" || exit 1
exec python3 - "${1:-8000}" <<'PY'
import sys, functools, http.server, socketserver

class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

port = int(sys.argv[1])
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), NoStore) as srv:
    print(f'Bureau on http://localhost:{port}  (no-store, dev only)')
    srv.serve_forever()
PY
