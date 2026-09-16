#!/bin/bash
# What a web session needs before the tests can run, done at the start of it
# rather than discovered two tool calls in. A local session is left alone:
# whatever is installed there was installed on purpose.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"

# Playwright, at the version the lockfile says. Never `npm i playwright`:
# naming the package re-resolves it and rewrites package.json, which is how
# one session came to be holding a dependency bump nobody had asked for.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund >/dev/null 2>&1
if ! git diff --quiet -- package.json package-lock.json; then
  echo "session-start: npm install changed package.json or the lockfile; that was not meant to happen, check git diff"
fi

# The container has a Chromium already, under a versioned directory. Tell the
# tests where, and only if nobody has already.
if [ -z "${BUREAU_CHROME:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  chrome=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)
  [ -n "$chrome" ] && echo "export BUREAU_CHROME=\"$chrome\"" >> "$CLAUDE_ENV_FILE"
fi
echo "session-start: playwright installed; tests run with node test/smoke.mjs once scripts/serve.sh is up"
