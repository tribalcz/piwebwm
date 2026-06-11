# WebDesk OS

A modern web-based desktop environment designed for headless Linux systems, particularly Raspberry Pi.

## Features
- 🖥️ Full window management system
- 📁 File explorer with drag & drop
- 💻 Terminal emulation
- 📊 System monitoring
- 🚀 Lightweight and fast
- 🔒 Secure remote access
- 📱 Responsive design

## Quick Start
```bash
git clone https://github.com/[username]/webdesk-os.git
cd webdesk-os
docker-compose up -d
```

## Authentication

The API is protected by a login (session cookie). Credentials come from one of
two sources, checked in order:

1. **Users file** (preferred). One `username:bcrypt-hash` entry per line.
   Default path `/etc/webdesk/users`, overridable via `WEBDESK_USERS_FILE`.
   Generate entries with the helper (it never stores plaintext):

   ```bash
   # build the backend once, then:
   tools/hashpw.sh alice                 # prompts for password, appends entry
   tools/hashpw.sh alice --print         # just print "alice:$2a$..."
   ```

2. **Environment fallback** (used when no users file exists), e.g. in
   `docker-compose.yml`: `WEBDESK_USER` / `WEBDESK_PASSWORD`.

If neither is configured the backend refuses to start (fail-closed) — it never
runs unauthenticated.

> This file/env scheme is temporary. The intended end state is logging in with
> real system accounts (PAM). When deploying over the network, terminate TLS in
> front of the backend and set `WEBDESK_SECURE_COOKIE=1`.
