#!/usr/bin/env bash
# Generate a Bcrypt hash for the shared app password (the value of APP_PASSWORD_HASH).
#
# Usage:
#   scripts/hash-password.sh 'your-shared-password'
#
# Copy the printed line into your .env as:
#   APP_PASSWORD_HASH=<printed hash>
#
# Uses `htpasswd` (ships with macOS). The hash is a standard Bcrypt `$2y$` string,
# which Vapor's Bcrypt.verify accepts (verified against this app's /api/login).
set -euo pipefail

if [ $# -lt 1 ] || [ -z "${1:-}" ]; then
  echo "usage: $0 'your-shared-password'" >&2
  exit 1
fi

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "htpasswd not found. On macOS it lives at /usr/sbin/htpasswd (part of Apache)." >&2
  exit 1
fi

# htpasswd -B = bcrypt, -C 10 = cost, -n = print to stdout, -b = password on cmdline,
# with an empty username it prints ":$2y$...", so we take the part after the colon.
htpasswd -bnBC 10 "" "$1" | tr -d '\n' | cut -d: -f2
echo
