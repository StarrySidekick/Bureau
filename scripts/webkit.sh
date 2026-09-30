#!/bin/bash
# Safari's engine for the tests (2026-09-30). Timothy designs Bureau almost
# entirely on his iPhone, in the installed Safari PWA, so WebKit is the engine
# a change is checked against first; the container only ships Chromium.
#
# Playwright's WebKit is downloaded into its own directory (never over the
# container's /opt/pw-browsers, which the Chromium tests use), and the system
# libraries it needs come from apt. Both steps are skipped when already done,
# so this is safe to run at the start of every session and again by hand.
#
#   scripts/webkit.sh            # install if missing, print the executable
#   node test/safari.mjs         # then check the app in it
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
DIR="${BUREAU_WEBKIT_DIR:-$HOME/.cache/bureau-webkit}"
LOG="$DIR/install.log"
mkdir -p "$DIR"

find_run(){ ls -d "$DIR"/webkit-*/pw_run.sh 2>/dev/null | head -1; }

if [ -z "$(find_run)" ]; then
  echo "webkit: downloading into $DIR" >&2
  PLAYWRIGHT_BROWSERS_PATH="$DIR" PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD= \
    npx playwright install webkit >>"$LOG" 2>&1 || true
fi
RUN="$(find_run)"
if [ -z "$RUN" ]; then echo "webkit: download failed, see $LOG" >&2; exit 1; fi

# The libraries: a launch that fails for want of one is the test.
if [ ! -f "$DIR/.deps-ok" ]; then
  if ! node -e "
    process.env.PLAYWRIGHT_BROWSERS_PATH='$DIR';
    import('$PWD/node_modules/playwright/index.mjs').then(async ({webkit})=>{
      const b = await webkit.launch(); await b.close(); }).catch(()=>process.exit(1));
  " >>"$LOG" 2>&1; then
    echo "webkit: installing system libraries (apt)" >&2
    npx playwright install-deps webkit >>"$LOG" 2>&1 || { echo "webkit: install-deps failed, see $LOG" >&2; exit 1; }
  fi
  touch "$DIR/.deps-ok"
fi
echo "$RUN"
