import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import type {
    SshStatus,
    SshSessionsResponse,
    SshUsersResponse,
    SshKeysResponse,
    SshKey,
    FirewallStatus,
    FirewallRule,
    WireguardResponse,
    WgInterface,
} from '@/types/api';

const FW_REVERT_SECONDS = 60;

/**
 * Remote access & security: SSH daemon (status + hardening), the ufw firewall
 * (rules, with lockout protection), and WireGuard VPN. All changes go through
 * the host agent; the firewall enable applies with a safety timer that reverts
 * unless confirmed.
 */
export function renderRemote(container: Element, _ctx: SettingsContext): void {
    void load(container as HTMLElement);
}

async function load(body: HTMLElement): Promise<void> {
    body.innerHTML = `<p class="set-note">Loading…</p>`;

    const [ssh, fw, wg, users] = await Promise.all([
        getJSON<SshStatus>('/api/system/ssh'),
        getJSON<FirewallStatus>('/api/system/firewall'),
        getJSON<WireguardResponse>('/api/system/wireguard'),
        getJSON<SshUsersResponse>('/api/system/ssh/users'),
    ]);

    // If the agent is down, every call fails the same way — show one message.
    if (!ssh.ok && (ssh.status === 503 || ssh.status === 0 || ssh.status === 404)) {
        body.innerHTML = unavailable(ssh.status, ssh.error);
        return;
    }

    const reload = () => void load(body);
    const sshInstalled = ssh.data?.installed === true;

    body.innerHTML =
        renderSsh(ssh.data, ssh.ok ? undefined : (ssh.error ?? `HTTP ${ssh.status}`)) +
        (sshInstalled ? renderKeysGroup(users.data?.users ?? []) : '') +
        renderFirewall(fw.data, fw.ok ? undefined : (fw.error ?? `HTTP ${fw.status}`)) +
        renderWireguard(wg.data?.interfaces, wg.ok ? undefined : (wg.error ?? `HTTP ${wg.status}`));

    wireSsh(body, ssh.data, reload);
    if (sshInstalled) wireKeys(body, users.data?.users ?? []);
    wireFirewall(body, fw.data, reload);
    wireWireguard(body, reload);
}

// --- SSH -------------------------------------------------------------------

function renderSsh(s: SshStatus | undefined, err?: string): string {
    if (err) return group('SSH', `<p class="set-note">${escapeHtml(err)}</p>`);
    if (!s || !s.installed) {
        return group('SSH', `<p class="set-note">OpenSSH server is not installed.</p>`);
    }
    return group('SSH', `
        ${row('Service', `${toggle('rm-ssh-enabled', s.active)} <span class="rm-state">${s.active ? 'active' : 'stopped'}${s.enabled ? '' : ' · not enabled at boot'}</span>`)}
        ${row('Password authentication', `${toggle('rm-ssh-pwauth', s.password_auth)}`,
            s.password_auth ? 'Consider key-only auth for better security' : 'Key-only (passwords disabled)')}
        ${row('Port',
            `<span class="set-inline">
                <input type="text" class="set-input rm-ssh-port" value="${s.port}" style="min-width:90px" />
                <button class="set-btn rm-ssh-port-save">Apply</button>
            </span>`,
            'Changing the port needs a matching firewall rule and a reconnect')}
        <div class="set-row rm-sessions-toggle" role="button" tabindex="0">
            <div class="set-row-text"><span class="set-row-label">Active sessions</span></div>
            <div class="set-row-control"><span class="rm-state">${s.sessions}</span> <span class="rm-chevron">▸</span></div>
        </div>
        <div class="rm-sessions-panel" hidden></div>
    `);
}

function wireSsh(body: HTMLElement, s: SshStatus | undefined, reload: () => void): void {
    if (!s) return;
    body.querySelector<HTMLInputElement>('#rm-ssh-enabled')?.addEventListener('change', e => {
        const enabled = (e.target as HTMLInputElement).checked;
        if (!enabled && !confirm('Stop and disable the SSH service? Existing remote sessions may be lost.')) {
            reload();
            return;
        }
        void post('/api/system/ssh/enabled', { enabled }, reload);
    });
    body.querySelector<HTMLInputElement>('#rm-ssh-pwauth')?.addEventListener('change', e => {
        const enabled = (e.target as HTMLInputElement).checked;
        void post('/api/system/ssh/password-auth', { enabled }, reload);
    });
    body.querySelector('.rm-ssh-port-save')?.addEventListener('click', () => {
        const val = body.querySelector<HTMLInputElement>('.rm-ssh-port')!.value.trim();
        const port = parseInt(val, 10);
        if (!port || port < 1 || port > 65535) { alert('Enter a port between 1 and 65535.'); return; }
        if (!confirm(`Change the SSH port to ${port}? Make sure a firewall rule allows it, then reconnect on the new port.`)) return;
        void post('/api/system/ssh/port', { port }, reload);
    });

    // Expandable active-sessions list (fetched lazily on first open).
    const toggleEl = body.querySelector<HTMLElement>('.rm-sessions-toggle');
    const panel = body.querySelector<HTMLElement>('.rm-sessions-panel');
    let loaded = false;
    const expand = async () => {
        if (!panel || !toggleEl) return;
        const chev = toggleEl.querySelector('.rm-chevron');
        const open = panel.hasAttribute('hidden');
        if (open) {
            panel.removeAttribute('hidden');
            if (chev) chev.textContent = '▾';
            if (!loaded) {
                loaded = true;
                panel.innerHTML = `<p class="set-note">Loading…</p>`;
                const res = await getJSON<SshSessionsResponse>('/api/system/ssh/sessions');
                panel.innerHTML = renderSessions(res.ok ? (res.data?.sessions ?? []) : null);
            }
        } else {
            panel.setAttribute('hidden', '');
            if (chev) chev.textContent = '▸';
        }
    };
    toggleEl?.addEventListener('click', () => void expand());
    toggleEl?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void expand(); }
    });
}

function renderSessions(sessions: SshSessionsResponse['sessions'] | null): string {
    if (sessions === null) return `<p class="set-note">Could not read sessions.</p>`;
    if (sessions.length === 0) return `<p class="set-note">No active remote sessions.</p>`;
    const rows = sessions.map(s => `
        <div class="rm-session">
            <span class="rm-session-user">${escapeHtml(s.user)}</span>
            <span class="rm-session-from">${escapeHtml(s.from)}</span>
            <span class="rm-session-tty">${escapeHtml(s.tty)}</span>
            <span class="net-iface-spacer"></span>
            <span class="rm-session-since">${escapeHtml(s.since)}</span>
        </div>
    `).join('');
    return `<div class="rm-sessions">${rows}</div>`;
}

// --- SSH keys (authorized_keys) --------------------------------------------

function renderKeysGroup(users: string[]): string {
    const options = users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
    const userControl = users.length
        ? `<select class="set-select rm-keys-user">${options}</select>`
        : `<span class="set-note">No login users found.</span>`;
    return group('SSH keys (authorized_keys)', `
        ${row('User', userControl, 'Public keys allowed to log in as this user')}
        <div class="rm-keys-head">
            <span class="set-row-label">Keys</span>
            <button class="set-btn rm-key-add"${users.length ? '' : ' disabled'}>Add key</button>
        </div>
        <div class="rm-keys"><p class="set-note">Loading…</p></div>
    `);
}

function wireKeys(body: HTMLElement, users: string[]): void {
    if (users.length === 0) return;
    const userSel = body.querySelector<HTMLSelectElement>('.rm-keys-user');
    const keysEl = body.querySelector<HTMLElement>('.rm-keys');
    if (!userSel || !keysEl) return;

    const refresh = async () => {
        const user = userSel.value;
        keysEl.innerHTML = `<p class="set-note">Loading…</p>`;
        const res = await getJSON<SshKeysResponse>(`/api/system/ssh/keys?user=${encodeURIComponent(user)}`);
        keysEl.innerHTML = renderKeys(res.ok ? (res.data?.keys ?? []) : null);
        keysEl.querySelectorAll<HTMLElement>('[data-key-del]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.keyDel!, 10);
                if (!confirm(`Remove this key for ${user}? That login will no longer be possible with it.`)) return;
                void post('/api/system/ssh/keys', { user, index }, refresh, 'DELETE');
            });
        });
    };

    userSel.addEventListener('change', () => void refresh());
    body.querySelector('.rm-key-add')?.addEventListener('click', () => openKeyModal(userSel.value, refresh));
    void refresh();
}

function renderKeys(keys: SshKey[] | null): string {
    if (keys === null) return `<p class="set-note">Could not read keys.</p>`;
    if (keys.length === 0) return `<p class="set-note">No authorized keys.</p>`;
    return keys.map(k => `
        <div class="rm-key">
            <span class="rm-key-kind">${escapeHtml(k.kind)}</span>
            <span class="rm-key-comment">${escapeHtml(k.comment || '(no comment)')}</span>
            <span class="rm-key-preview">${escapeHtml(k.preview)}</span>
            <span class="net-iface-spacer"></span>
            <button class="set-btn net-route-del" data-key-del="${k.index}">Remove</button>
        </div>
    `).join('');
}

function openKeyModal(user: string, reload: () => void): void {
    const overlay = modal(`
        <h3>Add SSH key for ${escapeHtml(user)}</h3>
        <label>Public key</label>
        <textarea class="rm-key-in" rows="4" placeholder="ssh-ed25519 AAAA... user@host"></textarea>
        <p class="set-note">Paste a single OpenSSH public key line (.pub).</p>
        <div class="net-modal-actions">
            <button class="set-btn rm-cancel">Cancel</button>
            <button class="set-btn rm-add" style="background:var(--accent);color:#fff;border-color:var(--accent)">Add</button>
        </div>
    `);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.rm-cancel')?.addEventListener('click', close);
    overlay.querySelector('.rm-add')?.addEventListener('click', () => {
        const key = overlay.querySelector<HTMLTextAreaElement>('.rm-key-in')!.value.trim();
        if (!key) { alert('Paste a public key.'); return; }
        close();
        void post('/api/system/ssh/keys', { user, key }, reload);
    });
}

// --- Firewall --------------------------------------------------------------

function renderFirewall(s: FirewallStatus | undefined, err?: string): string {
    if (err) return group('Firewall (ufw)', `<p class="set-note">${escapeHtml(err)}</p>`);
    if (!s || !s.installed) {
        return group('Firewall (ufw)', `<p class="set-note">ufw is not installed.</p>`);
    }

    const defaults = s.active
        ? row('Default policy', `<span>in: ${escapeHtml(s.default_incoming || '—')} · out: ${escapeHtml(s.default_outgoing || '—')}</span>`)
        : '';

    const rules = s.active
        ? (s.rules.length
            ? s.rules.map(renderRule).join('')
            : `<p class="set-note">No rules.</p>`)
        : '';

    const rulesBlock = s.active
        ? `<div class="rm-rules-head">
               <span class="set-row-label">Rules</span>
               <button class="set-btn rm-fw-add">Add rule</button>
           </div>
           <div class="rm-rules">${rules}</div>`
        : '';

    return group('Firewall (ufw)', `
        ${row('Status', `${toggle('rm-fw-enabled', s.active)} <span class="rm-state">${s.active ? 'active' : 'inactive'}</span>`,
            'Enabling keeps the web and SSH ports open automatically')}
        ${defaults}
        ${rulesBlock}
    `);
}

function renderRule(r: FirewallRule): string {
    const cls = r.action.startsWith('ALLOW') ? 'net-online' : 'net-offline';
    return `
        <div class="rm-rule">
            <span class="rm-rule-to">${escapeHtml(r.to)}</span>
            <span class="net-pill ${cls}">${escapeHtml(r.action)}</span>
            <span class="rm-rule-from">${escapeHtml(r.from)}</span>
            <span class="net-iface-spacer"></span>
            <button class="set-btn net-route-del" data-fw-del="${r.number}">Delete</button>
        </div>
    `;
}

function wireFirewall(body: HTMLElement, s: FirewallStatus | undefined, reload: () => void): void {
    if (!s) return;

    body.querySelector<HTMLInputElement>('#rm-fw-enabled')?.addEventListener('change', e => {
        const enabled = (e.target as HTMLInputElement).checked;
        if (!enabled) {
            void post('/api/system/firewall/enabled', { enabled: false, revert_seconds: 0 }, reload);
            return;
        }
        void enableFirewall(reload);
    });

    body.querySelector('.rm-fw-add')?.addEventListener('click', () => openRuleModal(reload));

    body.querySelectorAll<HTMLElement>('[data-fw-del]').forEach(btn => {
        btn.addEventListener('click', () => {
            const number = parseInt(btn.dataset.fwDel!, 10);
            if (!confirm('Delete this firewall rule?')) return;
            void post('/api/system/firewall/rule', { number }, reload, 'DELETE');
        });
    });
}

async function enableFirewall(reload: () => void): Promise<void> {
    try {
        const res = await fetch('/api/system/firewall/enabled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ enabled: true, revert_seconds: FW_REVERT_SECONDS }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            alert(`Could not enable firewall: ${err.error ?? res.status}`);
            reload();
            return;
        }
        const data = await res.json() as { token: string | null; revert_seconds: number };
        if (data.token) {
            showFirewallCountdown(data.token, data.revert_seconds, reload);
        } else {
            reload();
        }
    } catch {
        alert('Could not reach the server.');
        reload();
    }
}

function showFirewallCountdown(token: string, seconds: number, reload: () => void): void {
    let remaining = seconds;
    const overlay = modal(`
        <h3>Keep firewall enabled?</h3>
        <p>The firewall is on, with the web port and SSH allowed. If you can still
        use WebDesk, confirm to keep it.</p>
        <p class="net-countdown">Reverting in <strong>${remaining}s</strong>…</p>
        <p class="set-note">If you got locked out, do nothing — it reverts automatically.</p>
        <div class="net-modal-actions">
            <button class="set-btn rm-fw-keep" style="background:var(--accent);color:#fff;border-color:var(--accent)">Keep enabled</button>
        </div>
    `);
    const countEl = overlay.querySelector<HTMLElement>('.net-countdown strong')!;
    const finish = () => { clearInterval(timer); overlay.remove(); reload(); };
    const timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) { finish(); return; }
        countEl.textContent = `${remaining}s`;
    }, 1000);
    overlay.querySelector('.rm-fw-keep')?.addEventListener('click', async () => {
        try {
            await fetch('/api/system/firewall/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ token }),
            });
        } catch {
            /* if this fails the agent auto-reverts */
        }
        finish();
    });
}

function openRuleModal(reload: () => void): void {
    const overlay = modal(`
        <h3>Add firewall rule</h3>
        <label>Action</label>
        <select class="rm-r-action">
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
            <option value="reject">Reject</option>
        </select>
        <label>Port</label>
        <input type="text" class="rm-r-port" placeholder="8443" />
        <label>Protocol</label>
        <select class="rm-r-proto">
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="any">Any</option>
        </select>
        <label>From (optional)</label>
        <input type="text" class="rm-r-from" placeholder="Anywhere or 192.168.1.0/24" />
        <div class="net-modal-actions">
            <button class="set-btn rm-cancel">Cancel</button>
            <button class="set-btn rm-add" style="background:var(--accent);color:#fff;border-color:var(--accent)">Add</button>
        </div>
    `);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.rm-cancel')?.addEventListener('click', close);
    overlay.querySelector('.rm-add')?.addEventListener('click', () => {
        const action = overlay.querySelector<HTMLSelectElement>('.rm-r-action')!.value;
        const port = parseInt(overlay.querySelector<HTMLInputElement>('.rm-r-port')!.value, 10);
        const proto = overlay.querySelector<HTMLSelectElement>('.rm-r-proto')!.value;
        const from = overlay.querySelector<HTMLInputElement>('.rm-r-from')!.value.trim();
        if (!port || port < 1 || port > 65535) { alert('Enter a port between 1 and 65535.'); return; }
        close();
        void post('/api/system/firewall/rule', { action, port, proto, from: from || undefined }, reload);
    });
}

// --- WireGuard -------------------------------------------------------------

function renderWireguard(ifaces: WgInterface[] | undefined, err?: string): string {
    if (err) return group('WireGuard VPN', `<p class="set-note">${escapeHtml(err)}</p>`);

    const list = (ifaces && ifaces.length)
        ? ifaces.map(renderWgInterface).join('')
        : `<p class="set-note">No WireGuard interfaces configured.</p>`;

    return group('WireGuard VPN', `
        <div class="rm-rules-head">
            <span class="set-row-label">Interfaces</span>
            <button class="set-btn rm-wg-import">Import config</button>
        </div>
        <div class="rm-wg-list">${list}</div>
    `);
}

function renderWgInterface(i: WgInterface): string {
    const peerLine = i.peers.length
        ? i.peers.map(p => {
            const hs = p.latest_handshake > 0 ? `handshake ${timeAgo(p.latest_handshake)}` : 'no handshake';
            return `↓ ${formatBytes(p.rx)} · ↑ ${formatBytes(p.tx)} · ${hs}`;
        }).join('<br>')
        : 'no peers';
    return `
        <div class="rm-wg">
            <div class="rm-wg-head">
                ${toggle(`rm-wg-${escapeAttr(i.name)}`, i.up)}
                <span class="rm-wg-name">${escapeHtml(i.name)}</span>
                <span class="net-pill ${i.up ? 'net-online' : 'net-offline'}">${i.up ? 'up' : 'down'}</span>
                <span class="net-iface-spacer"></span>
                <button class="set-btn net-route-del" data-wg-remove="${escapeAttr(i.name)}">Remove</button>
            </div>
            <div class="rm-wg-peers">${peerLine}</div>
        </div>
    `;
}

function wireWireguard(body: HTMLElement, reload: () => void): void {
    body.querySelector('.rm-wg-import')?.addEventListener('click', () => openWgImport(reload));

    body.querySelectorAll<HTMLInputElement>('[id^="rm-wg-"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const iface = cb.id.replace(/^rm-wg-/, '');
            void post('/api/system/wireguard/interface', { iface, up: cb.checked }, reload);
        });
    });

    body.querySelectorAll<HTMLElement>('[data-wg-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.wgRemove!;
            if (!confirm(`Remove WireGuard interface "${name}"? It will be brought down and its config deleted.`)) return;
            void post('/api/system/wireguard/config', { name }, reload, 'DELETE');
        });
    });
}

function openWgImport(reload: () => void): void {
    const overlay = modal(`
        <h3>Import WireGuard config</h3>
        <label>Interface name</label>
        <input type="text" class="rm-wg-name-in" placeholder="wg0" />
        <label>Configuration</label>
        <textarea class="rm-wg-config" rows="8" placeholder="[Interface]\nPrivateKey = ...\nAddress = ...\n\n[Peer]\n..."></textarea>
        <div class="net-modal-actions">
            <button class="set-btn rm-cancel">Cancel</button>
            <button class="set-btn rm-import" style="background:var(--accent);color:#fff;border-color:var(--accent)">Import</button>
        </div>
    `);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.rm-cancel')?.addEventListener('click', close);
    overlay.querySelector('.rm-import')?.addEventListener('click', () => {
        const name = overlay.querySelector<HTMLInputElement>('.rm-wg-name-in')!.value.trim();
        const config = overlay.querySelector<HTMLTextAreaElement>('.rm-wg-config')!.value;
        if (!name) { alert('Enter an interface name.'); return; }
        if (!config.includes('[Interface]')) { alert('That does not look like a WireGuard config.'); return; }
        close();
        void post('/api/system/wireguard/config', { name, config }, reload);
    });
}

// --- helpers ---------------------------------------------------------------

async function getJSON<T>(url: string): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
            let error: string | undefined;
            try {
                error = (await res.json() as { error?: string }).error;
            } catch {
                /* non-JSON error body */
            }
            return { ok: false, status: res.status, error };
        }
        return { ok: true, status: res.status, data: (await res.json()) as T };
    } catch {
        return { ok: false, status: 0 };
    }
}

async function post(
    url: string,
    payload: Record<string, unknown>,
    reload: () => void,
    method: 'POST' | 'DELETE' = 'POST',
): Promise<void> {
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            alert(`Operation failed: ${err.error ?? res.status}`);
        }
    } catch {
        alert('Could not reach the server.');
    }
    reload();
}

function modal(innerHtml: string): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'net-modal-overlay';
    overlay.innerHTML = `<div class="net-modal">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function unavailable(status: number, error?: string): string {
    let msg: string;
    if (status === 503) {
        msg = 'Host agent unavailable — start the agent to manage remote access.';
    } else if (status === 404) {
        msg = 'Endpoint not found (404) — the backend is an older build. Rebuild it (./install.sh --update).';
    } else if (status === 0) {
        msg = 'No response from the server (network error).';
    } else {
        msg = `Could not read remote-access settings (HTTP ${status})${error ? `: ${error}` : ''}.`;
    }
    return `<p class="set-note">${escapeHtml(msg)}</p>`;
}

function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function timeAgo(unixSecs: number): string {
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSecs);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text: string): string {
    return text.replace(/[^a-zA-Z0-9_-]/g, '');
}
