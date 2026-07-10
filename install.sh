#!/bin/sh
# install.sh — preflight check for running WebDesk OS via Docker.
#
# Verifies the prerequisites needed to bring the stack up (Docker daemon,
# Compose, free ports, config files) and reports each as [ OK ] / [WARN] /
# [FAIL]. It only inspects the system — nothing is installed or changed —
# unless you pass --start, which brings the stack up after all hard checks
# pass.
#
# Usage:
#   ./install.sh            # run checks only
#   ./install.sh --start    # run checks, then `compose up -d --build`
#   ./install.sh --update   # rebuild the host-agent + backend (no full preflight)
#   ./install.sh --help
#
# Exit status: 0 if no [FAIL], 1 otherwise.

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# Host ports published by docker-compose.yml.
BACKEND_PORT=8090
FRONTEND_PORT=3000
# Host-agent control socket (bind-mounted into the backend container).
AGENT_SOCKET="/var/run/webdesk.sock"

DO_START=0
DO_UPDATE=0

# --- output helpers ---------------------------------------------------------

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
    GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1); BOLD=$(tput bold); RESET=$(tput sgr0)
else
    GREEN=''; YELLOW=''; RED=''; BOLD=''; RESET=''
fi

FAIL_COUNT=0
WARN_COUNT=0

pass() { printf '%s[ OK ]%s %s\n' "$GREEN" "$RESET" "$1"; }
warn() { printf '%s[WARN]%s %s\n' "$YELLOW" "$RESET" "$1"; WARN_COUNT=$((WARN_COUNT + 1)); }
fail() { printf '%s[FAIL]%s %s\n' "$RED" "$RESET" "$1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
hint() { printf '       %s\n' "$1"; }
section() { printf '\n%s%s%s\n' "$BOLD" "$1" "$RESET"; }

usage() {
    cat <<EOF
WebDesk OS preflight check

Usage: $0 [--start | --update] [--help]

  --start    After all checks pass, run the stack (compose up -d --build).
  --update   Rebuild the Rust host-agent and the Go backend, then recreate
             the backend container. Skips the full preflight (the stack is
             already running). The frontend hot-reloads from a bind mount.
  --help     Show this help.
EOF
}

# --- argument parsing -------------------------------------------------------

for arg in "$@"; do
    case "$arg" in
        --start) DO_START=1 ;;
        --update) DO_UPDATE=1 ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n\n' "$arg" >&2; usage >&2; exit 2 ;;
    esac
done

# --- helpers ----------------------------------------------------------------

# port_in_use PORT -> 0 if a listener is bound, 1 if free, 2 if undetectable.
port_in_use() {
    _p=$1
    if command -v ss >/dev/null 2>&1; then
        ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${_p}\$" && return 0 || return 1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${_p}\$" && return 0 || return 1
    fi
    return 2
}

COMPOSE=""
detect_compose() {
    if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; return 0; fi
    if command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"; return 0; fi
    return 1
}

# --- update mode ------------------------------------------------------------
# Rebuild the privileged Rust host-agent and the Go backend image, then recreate
# the backend container. This intentionally skips the full preflight: the stack
# is normally already running during an update, so the port-availability checks
# would misfire. The frontend serves from a bind mount with hot reload, so it
# needs no rebuild here.
if [ "$DO_UPDATE" -eq 1 ]; then
    printf '%s=== WebDesk OS update ===%s\n' "$BOLD" "$RESET"

    section "Host agent (Rust)"
    if command -v cargo >/dev/null 2>&1; then
        printf 'Building: cargo build --release (in host-agent)\n'
        if ( cd "$SCRIPT_DIR/host-agent" && cargo build --release ); then
            pass "host-agent rebuilt → host-agent/target/release/host-agent"
            hint "Restart the running agent to pick up the new binary, e.g."
            hint "'sudo systemctl restart webdesk-agent' or however you launched it."
        else
            fail "cargo build failed (see output above)"
        fi
    else
        fail "cargo not found — install the Rust toolchain (https://rustup.rs)"
    fi

    section "Backend (Go, Docker)"
    if [ ! -f "$COMPOSE_FILE" ]; then
        fail "docker-compose.yml not found at $COMPOSE_FILE"
        hint "Run this script from inside the cloned repository."
    elif command -v docker >/dev/null 2>&1 && detect_compose; then
        printf 'Running: %s up -d --build backend\n' "$COMPOSE"
        # shellcheck disable=SC2086
        if $COMPOSE -f "$COMPOSE_FILE" up -d --build backend; then
            pass "backend image rebuilt and container recreated"
        else
            fail "backend rebuild failed (see output above)"
        fi
    else
        fail "docker / compose unavailable — cannot rebuild the backend"
        hint "Install Docker + Compose, or rebuild manually with your toolchain."
    fi

    section "Summary"
    printf '%d step(s) failed, %d warning(s).\n' "$FAIL_COUNT" "$WARN_COUNT"
    if [ "$FAIL_COUNT" -gt 0 ]; then
        printf '%sUpdate incomplete — resolve the [FAIL] items above.%s\n' "$RED" "$RESET"
        exit 1
    fi
    printf '%sUpdate complete.%s\n' "$GREEN" "$RESET"
    printf 'Frontend runs from a bind mount (hot reload) — no rebuild needed.\n'
    exit 0
fi

printf '%s=== WebDesk OS preflight ===%s\n' "$BOLD" "$RESET"

# --- 1. Docker engine -------------------------------------------------------

section "Docker"
DOCKER_OK=0
if command -v docker >/dev/null 2>&1; then
    pass "docker found ($(docker --version 2>/dev/null | head -1))"
    if docker info >/dev/null 2>&1; then
        pass "docker daemon is running and reachable"
        DOCKER_OK=1
    else
        fail "docker daemon is not reachable"
        hint "Start it (e.g. 'sudo systemctl start docker') or, if this is a"
        hint "permission error, add your user to the 'docker' group and re-login."
    fi
else
    fail "docker is not installed"
    hint "Install Docker Engine: https://docs.docker.com/engine/install/"
fi

# --- 2. Docker Compose ------------------------------------------------------

section "Docker Compose"
if [ "$DOCKER_OK" -eq 1 ] || command -v docker >/dev/null 2>&1; then
    if detect_compose; then
        pass "compose available via '$COMPOSE'"
    else
        fail "neither 'docker compose' plugin nor 'docker-compose' found"
        hint "Install the Compose plugin: https://docs.docker.com/compose/install/"
    fi
else
    warn "skipping compose check (docker missing)"
fi

# --- 3. Project files -------------------------------------------------------

section "Project files"
if [ -f "$COMPOSE_FILE" ]; then
    pass "docker-compose.yml present"
    if [ -n "$COMPOSE" ] && ! $COMPOSE -f "$COMPOSE_FILE" config >/dev/null 2>&1; then
        fail "docker-compose.yml failed validation ('$COMPOSE config')"
    fi
else
    fail "docker-compose.yml not found at $COMPOSE_FILE"
    hint "Run this script from inside the cloned repository."
fi

# --- 4. Ports ---------------------------------------------------------------

section "Ports"
for entry in "backend:$BACKEND_PORT" "frontend:$FRONTEND_PORT"; do
    name=${entry%%:*}
    port=${entry##*:}
    port_in_use "$port"
    case $? in
        0) fail "port $port ($name) is already in use"
           hint "Free it or change the published port in docker-compose.yml." ;;
        1) pass "port $port ($name) is free" ;;
        2) warn "cannot check port $port ($name): no 'ss' or 'netstat' available" ;;
    esac
done

# --- 5. Authentication (warn-only) ------------------------------------------

section "Authentication"
USERS_FILE=${WEBDESK_USERS_FILE:-/etc/webdesk/users}
if [ -f "$USERS_FILE" ]; then
    pass "users file present at $USERS_FILE"
elif [ -n "${WEBDESK_USER:-}" ] && [ -n "${WEBDESK_PASSWORD:-}" ]; then
    pass "credentials configured via WEBDESK_USER / WEBDESK_PASSWORD"
else
    warn "no users file and no WEBDESK_USER/WEBDESK_PASSWORD in this shell"
    hint "docker-compose.yml falls back to a default admin/changeme — fine for a"
    hint "first run, but change it before exposing the service. Create real"
    hint "credentials with: tools/hashpw.sh <username>"
fi

# --- 6. Host agent socket (warn-only) ---------------------------------------

section "Host agent"
if [ -S "$AGENT_SOCKET" ]; then
    pass "host-agent socket present at $AGENT_SOCKET"
elif [ -e "$AGENT_SOCKET" ]; then
    warn "$AGENT_SOCKET exists but is not a socket"
    hint "A leftover file/directory here will break the bind mount. Remove it and"
    hint "start the Rust host-agent so it can create the socket."
else
    warn "host-agent socket $AGENT_SOCKET not found"
    hint "The backend will run in MOCK mode (no real filesystem access). Start the"
    hint "Rust host-agent first, or Docker will create a directory at this path"
    hint "for the bind mount — remove that directory if it appears."
fi

# --- 7. Disk space (warn-only) ----------------------------------------------

section "Resources"
if command -v df >/dev/null 2>&1; then
    avail_kb=$(df -Pk "$SCRIPT_DIR" 2>/dev/null | awk 'NR==2 {print $4}')
    if [ -n "${avail_kb:-}" ]; then
        avail_mb=$((avail_kb / 1024))
        if [ "$avail_mb" -lt 1024 ]; then
            warn "only ${avail_mb} MB free on the project filesystem"
            hint "Building the images needs roughly 1 GB; free some space."
        else
            pass "disk space looks sufficient (${avail_mb} MB free)"
        fi
    fi
fi

# --- summary ----------------------------------------------------------------

section "Summary"
printf '%d check(s) failed, %d warning(s).\n' "$FAIL_COUNT" "$WARN_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
    printf '%sPrerequisites not met — resolve the [FAIL] items above.%s\n' "$RED" "$RESET"
    exit 1
fi

printf '%sAll prerequisites satisfied.%s\n' "$GREEN" "$RESET"

if [ "$DO_START" -eq 1 ]; then
    section "Starting stack"
    printf 'Running: %s up -d --build\n' "$COMPOSE"
    # shellcheck disable=SC2086
    exec $COMPOSE -f "$COMPOSE_FILE" up -d --build
fi

printf '\nRun with --start to bring the stack up, or: %s up -d --build\n' "${COMPOSE:-docker compose}"
exit 0
