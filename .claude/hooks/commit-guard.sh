#!/bin/bash
# PreToolUse hook on Bash. A commit that touches web/ without the cache and
# version bump is refused, and the reason is handed back so the fix is one
# edit rather than a deploy that did not take. Anything that is not a git
# commit passes straight through; the check itself is test/version.mjs and
# can be run by hand at any time.
set -uo pipefail
input=$(cat)
case "$input" in *"git commit"*) ;; *) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}" || exit 0
# No node means no check, which is a pass-through rather than a refusal:
# the hook must never be the thing that stops a commit on a machine it
# cannot run on.
command -v node >/dev/null 2>&1 || exit 0
out=$(node test/version.mjs 2>&1); code=$?
[ "$code" -eq 0 ] && exit 0
python3 -c 'import json,sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
  "permissionDecisionReason": "test/version.mjs refused the commit:\n" + sys.stdin.read()}}))' <<<"$out"
exit 0
