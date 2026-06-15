import { group, row } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import type {
    NetworkStatus,
    NetworkInterface,
    NetworkInterfacesResponse,
    RouteEntry,
    RoutesResponse,
} from '@/types/api';

type Tab = 'status' | 'interfaces' | 'routing';

const POLL_MS = 3000;
const REVERT_SECONDS = 60;

/**
 * Network section. Reads via /api/system/network/*; writes are the hostname
 * (Status) and interface IPv4 config (Interfaces). Interface changes apply with
 * a safe-apply window: the agent reverts after REVERT_SECONDS unless the user
 * confirms — so changing the IP you are connected through can't lock you out.
 */
export function renderNetwork(container: Element, _ctx: SettingsContext): () => void {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let modalOpen = false;
    let interfaces: NetworkInterface[] = [];
    let status: NetworkStatus | null = null;
    const lastSample = new Map<string, { rx: number; tx: number; t: number }>();

    container.innerHTML = `
        <div class="net-tabs">
            <button class="net-tab active" data-tab="status">Status</button>
            <button class="net-tab" data-tab="interfaces">Interfaces</button>
            <button class="net-tab" data-tab="routing">Routing</button>
        </div>
        <div class="net-body"></div>
    `;

    const body = container.querySelector<HTMLElement>('.net-body')!;
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('.net-tab'));

    const stopPoll = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    const refreshInterfaces = async () => {
        const res = await getJSON<NetworkInterfacesResponse>('/api/system/network/interfaces');
        if (!res.ok || !res.data) {
            body.innerHTML = unavailable(res.status, res.error);
            interfaces = [];
            return;
        }
        interfaces = res.data.interfaces;
        const now = Date.now();
        body.innerHTML = `<div class="net-iface-list">${
            interfaces.map(i => renderInterfaceCard(i, lastSample, now)).join('')
        }</div>`;
        body.querySelectorAll<HTMLElement>('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.edit!));
        });
    };

    const show = (tab: Tab) => {
        stopPoll();
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        if (tab === 'status') {
            void renderStatus(body);
        } else if (tab === 'interfaces') {
            void refreshInterfaces();
            pollTimer = setInterval(() => {
                if (!modalOpen) void refreshInterfaces();
            }, POLL_MS);
        } else {
            void renderRouting(body);
        }
    };

    const openEditModal = async (name: string) => {
        const iface = interfaces.find(i => i.name === name);
        if (!iface) return;
        modalOpen = true;
        if (!status) {
            const s = await getJSON<NetworkStatus>('/api/system/network/status');
            status = s.data ?? null;
        }

        const ipv4 = iface.addresses.find(a => a.family === 'ipv4');
        const overlay = modal(`
            <h3>Configure ${escapeHtml(iface.name)}</h3>
            <label>Method</label>
            <select class="net-f-method">
                <option value="auto">Automatic (DHCP)</option>
                <option value="manual" selected>Manual (static)</option>
            </select>
            <div class="net-manual">
                <label>IP address</label>
                <input type="text" class="net-f-address" value="${escapeHtml(ipv4?.address ?? '')}" placeholder="192.168.1.50" />
                <label>Prefix length</label>
                <input type="text" class="net-f-prefix" value="${ipv4?.prefixlen ?? 24}" placeholder="24" />
                <label>Gateway</label>
                <input type="text" class="net-f-gateway" value="${escapeHtml(status?.gateway ?? '')}" placeholder="192.168.1.1" />
            </div>
            <label>DNS servers (space or comma separated)</label>
            <input type="text" class="net-f-dns" value="${escapeHtml((status?.dns ?? []).join(' '))}" placeholder="1.1.1.1 8.8.8.8" />
            <p class="set-note">Applied with a ${REVERT_SECONDS}s safety timer — if this is the interface you're connected through, the connection may drop and the change will revert automatically.</p>
            <div class="net-modal-actions">
                <button class="set-btn net-cancel">Cancel</button>
                <button class="set-btn net-apply" style="background:var(--accent);color:#fff;border-color:var(--accent)">Apply</button>
            </div>
        `);

        const methodSel = overlay.querySelector<HTMLSelectElement>('.net-f-method')!;
        const manualBox = overlay.querySelector<HTMLElement>('.net-manual')!;
        const syncManual = () => { manualBox.style.display = methodSel.value === 'manual' ? '' : 'none'; };
        methodSel.addEventListener('change', syncManual);
        syncManual();

        const close = () => { overlay.remove(); modalOpen = false; };
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.net-cancel')?.addEventListener('click', close);
        overlay.querySelector('.net-apply')?.addEventListener('click', async () => {
            const method = methodSel.value;
            const dnsRaw = overlay.querySelector<HTMLInputElement>('.net-f-dns')!.value.trim();
            const dns = dnsRaw ? dnsRaw.split(/[\s,]+/).filter(Boolean) : [];
            const payload: Record<string, unknown> = {
                iface: name,
                method,
                dns,
                revert_seconds: REVERT_SECONDS,
            };
            if (method === 'manual') {
                payload.address = overlay.querySelector<HTMLInputElement>('.net-f-address')!.value.trim();
                payload.prefixlen = parseInt(overlay.querySelector<HTMLInputElement>('.net-f-prefix')!.value, 10) || 24;
                const gw = overlay.querySelector<HTMLInputElement>('.net-f-gateway')!.value.trim();
                payload.gateway = gw;
            }
            close();
            await applyConfig(payload);
            status = null; // gateway/dns may have changed
            void refreshInterfaces();
        });
    };

    const applyConfig = async (payload: Record<string, unknown>) => {
        try {
            const res = await fetch('/api/system/network/interface', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                alert(`Could not apply: ${err.error ?? res.status}`);
                return;
            }
            const data = await res.json() as { token: string | null; revert_seconds: number };
            if (data.token) {
                showRevertCountdown(data.token, data.revert_seconds);
            }
        } catch {
            alert('Could not apply network configuration.');
        }
    };

    const showRevertCountdown = (token: string, seconds: number) => {
        modalOpen = true;
        let remaining = seconds;
        const overlay = modal(`
            <h3>Keep these settings?</h3>
            <p>Network settings were applied. They will revert automatically if not confirmed.</p>
            <p class="net-countdown">Reverting in <strong>${remaining}s</strong>…</p>
            <p class="set-note">If your connection dropped, you can't confirm here — wait for the automatic revert, then reconnect.</p>
            <div class="net-modal-actions">
                <button class="set-btn net-keep" style="background:var(--accent);color:#fff;border-color:var(--accent)">Keep changes</button>
            </div>
        `);
        const countEl = overlay.querySelector<HTMLElement>('.net-countdown strong')!;
        const finish = () => { clearInterval(timer); overlay.remove(); modalOpen = false; };

        const timer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                finish();
                void refreshInterfaces();
                return;
            }
            countEl.textContent = `${remaining}s`;
        }, 1000);

        overlay.querySelector('.net-keep')?.addEventListener('click', async () => {
            try {
                await fetch('/api/system/network/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ token }),
                });
            } catch {
                /* if this fails the agent will auto-revert */
            }
            finish();
            void refreshInterfaces();
        });
    };

    tabs.forEach(t => t.addEventListener('click', () => show((t.dataset.tab as Tab) ?? 'status')));
    show('status');

    return stopPoll;
}

// --- shared helpers --------------------------------------------------------

async function getJSON<T>(url: string): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
            let error: string | undefined;
            try {
                const body = await res.json() as { error?: string };
                error = body.error;
            } catch {
                /* non-JSON error body (e.g. 404 HTML) */
            }
            return { ok: false, status: res.status, error };
        }
        return { ok: true, status: res.status, data: (await res.json()) as T };
    } catch {
        return { ok: false, status: 0 };
    }
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
        msg = 'Host agent unavailable — start the agent (its status is in Settings ▸ System).';
    } else if (status === 404) {
        msg = 'Endpoint not found (404) — the backend is an older build without the network API. Rebuild the backend container.';
    } else if (status === 0) {
        msg = 'No response from the server (network error).';
    } else if (status >= 500) {
        msg = `Server/agent error (${status})${error ? `: ${error}` : ''}. Check the host-agent log — is iproute2 (and NetworkManager) installed?`;
    } else {
        msg = `Could not read network information (HTTP ${status})${error ? `: ${error}` : ''}.`;
    }
    return `<p class="set-note">${escapeHtml(msg)}</p>`;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(1)} ${units[i]}`;
}

// --- Status tab ------------------------------------------------------------

async function renderStatus(body: HTMLElement): Promise<void> {
    const res = await getJSON<NetworkStatus>('/api/system/network/status');
    if (!res.ok || !res.data) {
        body.innerHTML = unavailable(res.status, res.error);
        return;
    }
    const s = res.data;

    body.innerHTML =
        group('General', `
            ${row('Hostname',
                `<span class="net-host-edit">
                    <input type="text" class="net-host-input" value="${escapeHtml(s.hostname)}" />
                    <button class="set-btn net-host-save">Save</button>
                </span>`)}
            ${row('Connectivity', s.online
                ? '<span class="net-pill net-online">Online</span>'
                : '<span class="net-pill net-offline">No gateway</span>')}
            ${row('Default gateway', escapeHtml(s.gateway ?? '—'))}
            ${row('DNS servers', s.dns.length ? s.dns.map(escapeHtml).join('<br>') : '—')}
        `);

    const input = body.querySelector<HTMLInputElement>('.net-host-input');
    const saveBtn = body.querySelector<HTMLButtonElement>('.net-host-save');
    saveBtn?.addEventListener('click', async () => {
        const name = input?.value.trim() ?? '';
        if (!name) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        try {
            const res = await fetch('/api/system/network/hostname', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                alert(`Could not change hostname: ${err.error ?? res.status}`);
            } else {
                void renderStatus(body);
                return;
            }
        } catch {
            alert('Could not change hostname.');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    });
}

// --- Interfaces tab --------------------------------------------------------

function renderInterfaceCard(
    iface: NetworkInterface,
    lastSample: Map<string, { rx: number; tx: number; t: number }>,
    now: number
): string {
    const prev = lastSample.get(iface.name);
    let rate = '';
    if (prev) {
        const dt = (now - prev.t) / 1000;
        if (dt > 0) {
            const down = (iface.rx_bytes - prev.rx) / dt;
            const up = (iface.tx_bytes - prev.tx) / dt;
            rate = `<span class="net-rate">↓ ${formatBytes(Math.max(0, down))}/s · ↑ ${formatBytes(Math.max(0, up))}/s</span>`;
        }
    }
    lastSample.set(iface.name, { rx: iface.rx_bytes, tx: iface.tx_bytes, t: now });

    const ipv4 = iface.addresses.filter(a => a.family === 'ipv4');
    const ipv6 = iface.addresses.filter(a => a.family === 'ipv6');
    const addrLine = (label: string, list: typeof ipv4) =>
        list.length
            ? `<div class="net-iface-row"><span>${label}</span><span>${list.map(a => `${escapeHtml(a.address)}/${a.prefixlen}`).join(', ')}</span></div>`
            : '';

    const stateClass = iface.state === 'up' ? 'net-online' : 'net-offline';
    const editable = iface.kind === 'ethernet' || iface.kind === 'wifi';

    return `
        <div class="net-iface">
            <div class="net-iface-head">
                <span class="net-iface-name">${escapeHtml(iface.name)}</span>
                <span class="net-iface-kind">${escapeHtml(iface.kind)}</span>
                <span class="net-pill ${stateClass}">${escapeHtml(iface.state)}</span>
                <span class="net-iface-spacer"></span>
                ${editable ? `<button class="set-btn net-iface-edit" data-edit="${escapeHtml(iface.name)}">Configure</button>` : ''}
            </div>
            ${addrLine('IPv4', ipv4)}
            ${addrLine('IPv6', ipv6)}
            ${iface.mac ? `<div class="net-iface-row"><span>MAC</span><span>${escapeHtml(iface.mac)}</span></div>` : ''}
            ${iface.speed_mbps ? `<div class="net-iface-row"><span>Link</span><span>${iface.speed_mbps} Mbps</span></div>` : ''}
            <div class="net-iface-row">
                <span>Traffic</span>
                <span>↓ ${formatBytes(iface.rx_bytes)} · ↑ ${formatBytes(iface.tx_bytes)} ${rate}</span>
            </div>
        </div>
    `;
}

// --- Routing tab -----------------------------------------------------------

async function renderRouting(body: HTMLElement): Promise<void> {
    const res = await getJSON<RoutesResponse>('/api/system/network/routes');
    if (!res.ok || !res.data) {
        body.innerHTML = unavailable(res.status, res.error);
        return;
    }

    if (res.data.routes.length === 0) {
        body.innerHTML = `<p class="set-note">No routes.</p>`;
        return;
    }

    const rows = res.data.routes.map((r: RouteEntry) => `
        <tr>
            <td>${escapeHtml(r.dst)}</td>
            <td>${escapeHtml(r.gateway ?? '—')}</td>
            <td>${escapeHtml(r.dev)}</td>
            <td>${escapeHtml(r.protocol ?? '—')}</td>
        </tr>
    `).join('');

    body.innerHTML = `
        <table class="net-routes">
            <thead>
                <tr><th>Destination</th><th>Gateway</th><th>Interface</th><th>Protocol</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}
