#!/bin/sh
# hashpw.sh — generate or append a bcrypt user entry for the WebDesk users file.
#
# All cryptography is done by the backend binary's `hashpw` subcommand, so the
# hash is produced by the exact same library that verifies it at login (no
# $2y$ vs $2b$ prefix mismatch). This wrapper just prompts and writes the file.
#
# Usage:
#   tools/hashpw.sh <username>            # append entry to the users file
#   tools/hashpw.sh <username> --print    # print the entry, do not write
#
# Environment:
#   WEBDESK_BACKEND_BIN   path to the backend binary (default: looks in PATH,
#                         then ./backend/main, then ./main)
#   WEBDESK_USERS_FILE    users file to append to (default: /etc/webdesk/users)

set -eu

USERS_FILE="${WEBDESK_USERS_FILE:-/etc/webdesk/users}"

if [ "$#" -lt 1 ]; then
    echo "usage: $0 <username> [--print]" >&2
    exit 1
fi

USERNAME="$1"
PRINT_ONLY=""
[ "${2:-}" = "--print" ] && PRINT_ONLY="yes"

# Locate the backend binary.
BIN="${WEBDESK_BACKEND_BIN:-}"
if [ -z "$BIN" ]; then
    if command -v webdesk-backend >/dev/null 2>&1; then
        BIN="webdesk-backend"
    elif [ -x "./backend/main" ]; then
        BIN="./backend/main"
    elif [ -x "./main" ]; then
        BIN="./main"
    else
        echo "error: backend binary not found; set WEBDESK_BACKEND_BIN" >&2
        exit 1
    fi
fi

# Generate "username:$2a$..." (binary prompts for the password, hidden).
ENTRY="$("$BIN" hashpw "$USERNAME")"

if [ -n "$PRINT_ONLY" ]; then
    echo "$ENTRY"
    exit 0
fi

# Refuse to silently duplicate an existing user.
if [ -f "$USERS_FILE" ] && grep -q "^${USERNAME}:" "$USERS_FILE"; then
    echo "error: user '$USERNAME' already exists in $USERS_FILE" >&2
    echo "       remove the line first, or use --print and edit manually" >&2
    exit 1
fi

# Ensure the directory exists, then append.
DIR="$(dirname "$USERS_FILE")"
[ -d "$DIR" ] || mkdir -p "$DIR"
printf '%s\n' "$ENTRY" >> "$USERS_FILE"
chmod 600 "$USERS_FILE" 2>/dev/null || true

echo "Added user '$USERNAME' to $USERS_FILE"
