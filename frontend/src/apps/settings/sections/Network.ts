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

/**
 * Network section. Reads everything from the host agent via /api/system/network/*;
 * the only write is the hostname. The Interfaces tab polls for live throughput
 * while it is open — the returned cleanup stops the timer when the section is
 * left or Settings is closed.
 */
export function renderNetwork(container: Element, _ctx: SettingsContext): () => void {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
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

    const show = (tab: Tab) => {
        stopPoll();
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        if (tab === 'status') {
            void renderStatus(body);
        } else if (tab === 'interfaces') {
            void renderInterfaces(body, lastSample);
            pollTimer = setInterval(() => void renderInterfaces(body, lastSample), POLL_MS);
        } else {
            void renderRouting(body);
        }
    };

    tabs.forEach(t => t.addEventListener('click', () => show((t.dataset.tab as Tab) ?? 'status')));
    show('status');

    return stopPoll;
}

// --- helpers ---------------------------------------------------------------

async function getJSON<T>(url: string): Promise<{ ok: boolean; status: number; data?: T }> {
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return { ok: false, status: res.status };
        return { ok: true, status: res.status, data: (await res.json()) as T };
    } catch {
        return { ok: false, status: 0 };
    }
}

function unavailable(status: number): string {
    const msg = status === 503
        ? 'Host agent unavailable — start the agent to see network details.'
        : 'Could not read network information.';
    return `<p class="set-note">${msg}</p>`;
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
        body.innerHTML = unavailable(res.status);
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

async function renderInterfaces(
    body: HTMLElement,
    lastSample: Map<string, { rx: number; tx: number; t: number }>
): Promise<void> {
    const res = await getJSON<NetworkInterfacesResponse>('/api/system/network/interfaces');
    if (!res.ok || !res.data) {
        body.innerHTML = unavailable(res.status);
        return;
    }

    const now = Date.now();
    const cards = res.data.interfaces.map(i => renderInterfaceCard(i, lastSample, now)).join('');
    body.innerHTML = `<div class="net-iface-list">${cards}</div>`;
}

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

    return `
        <div class="net-iface">
            <div class="net-iface-head">
                <span class="net-iface-name">${escapeHtml(iface.name)}</span>
                <span class="net-iface-kind">${escapeHtml(iface.kind)}</span>
                <span class="net-pill ${stateClass}">${escapeHtml(iface.state)}</span>
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
        body.innerHTML = unavailable(res.status);
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
