import { group, row } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import { createHostsProvider } from './hostsProvider';
import type {
    NetworkStatus,
    NetworkInterface,
    NetworkInterfacesResponse,
    RouteEntry,
    RoutesResponse,
    WifiNetwork,
    WifiScanResponse,
    DiagnosticResponse,
} from '@/types/api';

type Tab = 'status' | 'interfaces' | 'wifi' | 'routing' | 'diagnostics';

const POLL_MS = 3000;
const REVERT_SECONDS = 60;

/**
 * Network section. Reads via /api/system/network/*; writes are the hostname
 * (Status) and interface IPv4 config (Interfaces). Interface changes apply with
 * a safe-apply window: the agent reverts after REVERT_SECONDS unless the user
 * confirms — so changing the IP you are connected through can't lock you out.
 */
export function renderNetwork(container: Element, ctx: SettingsContext): () => void {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let modalOpen = false;
    let interfaces: NetworkInterface[] = [];
    let status: NetworkStatus | null = null;
    const lastSample = new Map<string, { rx: number; tx: number; t: number }>();
    // Recent combined throughput (bytes/s) per interface, for the sparkline.
    const history = new Map<string, number[]>();

    container.innerHTML = `
        <div class="net-tabs">
            <button class="net-tab active" data-tab="status">Status</button>
            <button class="net-tab" data-tab="interfaces">Interfaces</button>
            <button class="net-tab" data-tab="wifi">Wi-Fi</button>
            <button class="net-tab" data-tab="routing">Routing</button>
            <button class="net-tab" data-tab="diagnostics">Diagnostics</button>
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
            interfaces.map(i => renderInterfaceCard(i, lastSample, history, now)).join('')
        }</div>`;
        body.querySelectorAll<HTMLElement>('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.edit!));
        });
        body.querySelectorAll<HTMLElement>('[data-lease]').forEach(btn => {
            btn.addEventListener('click', () => void openLeaseModal(btn.dataset.lease!));
        });
        body.querySelectorAll<HTMLElement>('[data-toggle]').forEach(btn => {
            btn.addEventListener('click', () => void toggleInterface(btn.dataset.toggle!, btn.dataset.up === 'true'));
        });
        body.querySelectorAll<HTMLElement>('[data-mtu]').forEach(btn => {
            btn.addEventListener('click', () => openMtuModal(btn.dataset.mtu!));
        });
    };

    const show = (tab: Tab) => {
        stopPoll();
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        if (tab === 'status') {
            void renderStatus(body, ctx);
        } else if (tab === 'interfaces') {
            void refreshInterfaces();
            pollTimer = setInterval(() => {
                if (!modalOpen) void refreshInterfaces();
            }, POLL_MS);
        } else if (tab === 'wifi') {
            void renderWifi();
        } else if (tab === 'diagnostics') {
            renderDiagnostics();
        } else {
            void renderRouting();
        }
    };

    const toggleInterface = async (name: string, currentlyUp: boolean) => {
        const up = !currentlyUp;
        if (!up && !confirm(`Disable ${name}? If this is the interface you're connected through, you may lose access until it is re-enabled on the device.`)) {
            return;
        }
        try {
            const res = await fetch('/api/system/network/interface/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ iface: name, up }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                alert(`Could not change interface state: ${err.error ?? res.status}`);
            }
        } catch {
            alert('Could not change interface state.');
        }
        void refreshInterfaces();
    };

    const openLeaseModal = async (name: string) => {
        modalOpen = true;
        const overlay = modal(`
            <h3>DHCP lease — ${escapeHtml(name)}</h3>
            <pre class="net-diag-out">Loading…</pre>
            <div class="net-modal-actions">
                <button class="set-btn net-cancel">Close</button>
            </div>
        `);
        const close = () => { overlay.remove(); modalOpen = false; };
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.net-cancel')?.addEventListener('click', close);
        const out = overlay.querySelector<HTMLElement>('.net-diag-out')!;
        const res = await getJSON<{ output: string }>(`/api/system/network/interface/lease?iface=${encodeURIComponent(name)}`);
        out.textContent = res.ok && res.data ? (res.data.output || '(no lease data)') : `Error: ${res.error ?? res.status}`;
    };

    const openMtuModal = (name: string) => {
        const iface = interfaces.find(i => i.name === name);
        if (!iface) return;
        modalOpen = true;
        const overlay = modal(`
            <h3>Set MTU for ${escapeHtml(name)}</h3>
            <label>MTU (bytes, 576–9216)</label>
            <input type="text" class="net-mtu-val" value="${iface.mtu || 1500}" />
            <p class="set-note">Lowering MTU below the path maximum is safe; raising it requires the link and peers to support jumbo frames.</p>
            <div class="net-modal-actions">
                <button class="set-btn net-cancel">Cancel</button>
                <button class="set-btn net-mtu-apply" style="background:var(--accent);color:#fff;border-color:var(--accent)">Apply</button>
            </div>
        `);
        const close = () => { overlay.remove(); modalOpen = false; };
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.net-cancel')?.addEventListener('click', close);
        overlay.querySelector('.net-mtu-apply')?.addEventListener('click', async () => {
            const mtu = parseInt(overlay.querySelector<HTMLInputElement>('.net-mtu-val')!.value, 10);
            if (!mtu || mtu < 576 || mtu > 9216) { alert('MTU must be between 576 and 9216.'); return; }
            close();
            try {
                const res = await fetch('/api/system/network/interface/mtu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ iface: name, mtu }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({})) as { error?: string };
                    alert(`Could not set MTU: ${err.error ?? res.status}`);
                }
            } catch {
                alert('Could not set MTU.');
            }
            void refreshInterfaces();
        });
    };

    const renderRouting = async () => {
        const res = await getJSON<RoutesResponse>('/api/system/network/routes');
        if (!res.ok || !res.data) {
            body.innerHTML = unavailable(res.status, res.error);
            return;
        }

        const rows = res.data.routes.map((r: RouteEntry) => `
            <tr>
                <td>${escapeHtml(r.dst)}</td>
                <td>${escapeHtml(r.gateway ?? '—')}</td>
                <td>${escapeHtml(r.dev)}</td>
                <td>${escapeHtml(r.protocol ?? '—')}</td>
                <td class="net-route-actions">${
                    r.protocol === 'static' || r.protocol == null || r.protocol === 'boot'
                        ? `<button class="set-btn net-route-del" data-dst="${escapeHtml(r.dst)}" data-dev="${escapeHtml(r.dev)}" data-gw="${escapeHtml(r.gateway ?? '')}">Delete</button>`
                        : ''
                }</td>
            </tr>
        `).join('');

        body.innerHTML = `
            <div class="net-routes-head">
                <button class="set-btn net-route-add" style="background:var(--accent);color:#fff;border-color:var(--accent)">Add route</button>
            </div>
            ${res.data.routes.length === 0
                ? `<p class="set-note">No routes.</p>`
                : `<table class="net-routes">
                    <thead>
                        <tr><th>Destination</th><th>Gateway</th><th>Interface</th><th>Protocol</th><th></th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`}
        `;

        body.querySelector('.net-route-add')?.addEventListener('click', () => void openRouteModal());
        body.querySelectorAll<HTMLElement>('.net-route-del').forEach(btn => {
            btn.addEventListener('click', () => void deleteRoute(
                btn.dataset.dev!, btn.dataset.dst!, btn.dataset.gw || undefined,
            ));
        });
    };

    const openRouteModal = async () => {
        // The add-route form needs the interface list to bind the route to a
        // connection; fetch it if the Interfaces tab hasn't loaded yet.
        if (interfaces.length === 0) {
            const res = await getJSON<NetworkInterfacesResponse>('/api/system/network/interfaces');
            if (res.ok && res.data) interfaces = res.data.interfaces;
        }
        const usable = interfaces.filter(i => i.kind === 'ethernet' || i.kind === 'wifi');
        if (usable.length === 0) {
            alert('No configurable interfaces available to attach a route to.');
            return;
        }

        modalOpen = true;
        const overlay = modal(`
            <h3>Add route</h3>
            <label>Destination (CIDR)</label>
            <input type="text" class="net-r-dst" placeholder="10.0.0.0/24" />
            <label>Gateway (optional)</label>
            <input type="text" class="net-r-gw" placeholder="192.168.1.1" />
            <label>Interface</label>
            <select class="net-r-iface">
                ${usable.map(i => `<option value="${escapeHtml(i.name)}">${escapeHtml(i.name)}</option>`).join('')}
            </select>
            <div class="net-modal-actions">
                <button class="set-btn net-cancel">Cancel</button>
                <button class="set-btn net-add" style="background:var(--accent);color:#fff;border-color:var(--accent)">Add</button>
            </div>
        `);
        const close = () => { overlay.remove(); modalOpen = false; };
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.net-cancel')?.addEventListener('click', close);
        overlay.querySelector('.net-add')?.addEventListener('click', async () => {
            const dst = overlay.querySelector<HTMLInputElement>('.net-r-dst')!.value.trim();
            const gw = overlay.querySelector<HTMLInputElement>('.net-r-gw')!.value.trim();
            const iface = overlay.querySelector<HTMLSelectElement>('.net-r-iface')!.value;
            if (!dst) { alert('Destination is required.'); return; }
            close();
            await routeRequest('POST', { iface, dst, gateway: gw || undefined });
            void renderRouting();
        });
    };

    const deleteRoute = async (dev: string, dst: string, gateway?: string) => {
        if (!confirm(`Delete route ${dst}${gateway ? ` via ${gateway}` : ''} on ${dev}?`)) return;
        await routeRequest('DELETE', { iface: dev, dst, gateway });
        void renderRouting();
    };

    const routeRequest = async (method: 'POST' | 'DELETE', payload: Record<string, unknown>) => {
        try {
            const res = await fetch('/api/system/network/route', {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                alert(`Route operation failed: ${err.error ?? res.status}`);
            }
        } catch {
            alert('Route operation failed.');
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
        const ipv6 = iface.addresses.find(a => a.family === 'ipv6' && !a.address.startsWith('fe80'));
        const overlay = modal(`
            <h3>Configure ${escapeHtml(iface.name)}</h3>
            <label>IPv4 method</label>
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
            <label>IPv6 method</label>
            <select class="net-f-ip6method">
                <option value="" selected>Leave unchanged</option>
                <option value="auto">Automatic (SLAAC/DHCPv6)</option>
                <option value="manual">Manual (static)</option>
                <option value="disabled">Disabled</option>
                <option value="ignore">Ignore</option>
            </select>
            <div class="net-manual6" style="display:none">
                <label>IPv6 address</label>
                <input type="text" class="net-f-ip6address" value="${escapeHtml(ipv6?.address ?? '')}" placeholder="2001:db8::50" />
                <label>IPv6 prefix length</label>
                <input type="text" class="net-f-ip6prefix" value="${ipv6?.prefixlen ?? 64}" placeholder="64" />
                <label>IPv6 gateway</label>
                <input type="text" class="net-f-ip6gateway" value="" placeholder="2001:db8::1" />
            </div>
            <label>DNS servers (IPv4 and/or IPv6, space or comma separated)</label>
            <input type="text" class="net-f-dns" value="${escapeHtml((status?.dns ?? []).join(' '))}" placeholder="1.1.1.1 2606:4700:4700::1111" />
            <label>DNS search domains (optional, space or comma separated)</label>
            <input type="text" class="net-f-search" value="" placeholder="example.lan corp.internal" />
            <p class="set-note">Leave search domains blank to keep the existing ones. Applied with a ${REVERT_SECONDS}s safety timer — if this is the interface you're connected through, the connection may drop and the change will revert automatically.</p>
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

        const ip6Sel = overlay.querySelector<HTMLSelectElement>('.net-f-ip6method')!;
        const manual6Box = overlay.querySelector<HTMLElement>('.net-manual6')!;
        const syncManual6 = () => { manual6Box.style.display = ip6Sel.value === 'manual' ? '' : 'none'; };
        ip6Sel.addEventListener('change', syncManual6);
        syncManual6();

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
            // Only send dns_search when filled in; an empty field means
            // "leave existing search domains unchanged" (agent treats
            // null as no-op, [] as clear).
            const searchRaw = overlay.querySelector<HTMLInputElement>('.net-f-search')!.value.trim();
            if (searchRaw) {
                payload.dns_search = searchRaw.split(/[\s,]+/).filter(Boolean);
            }
            if (method === 'manual') {
                payload.address = overlay.querySelector<HTMLInputElement>('.net-f-address')!.value.trim();
                payload.prefixlen = parseInt(overlay.querySelector<HTMLInputElement>('.net-f-prefix')!.value, 10) || 24;
                const gw = overlay.querySelector<HTMLInputElement>('.net-f-gateway')!.value.trim();
                payload.gateway = gw;
            }
            // IPv6 is left untouched unless a method is chosen.
            const ip6Method = ip6Sel.value;
            if (ip6Method) {
                payload.ipv6_method = ip6Method;
                if (ip6Method === 'manual') {
                    payload.ipv6_address = overlay.querySelector<HTMLInputElement>('.net-f-ip6address')!.value.trim();
                    payload.ipv6_prefixlen = parseInt(overlay.querySelector<HTMLInputElement>('.net-f-ip6prefix')!.value, 10) || 64;
                    payload.ipv6_gateway = overlay.querySelector<HTMLInputElement>('.net-f-ip6gateway')!.value.trim();
                }
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

    // --- Wi-Fi tab ---------------------------------------------------------

    const renderWifi = async () => {
        if (interfaces.length === 0) {
            const r = await getJSON<NetworkInterfacesResponse>('/api/system/network/interfaces');
            if (r.ok && r.data) interfaces = r.data.interfaces;
        }
        const wifiIfaces = interfaces.filter(i => i.kind === 'wifi');
        if (wifiIfaces.length === 0) {
            body.innerHTML = `<p class="set-note">No Wi-Fi interfaces detected.</p>`;
            return;
        }
        const iface = wifiIfaces[0].name;

        body.innerHTML = `
            <div class="net-routes-head">
                <span class="net-wifi-iface">Adapter: <strong>${escapeHtml(iface)}</strong></span>
                <button class="set-btn net-wifi-scan" style="background:var(--accent);color:#fff;border-color:var(--accent)">Scan</button>
            </div>
            <div class="net-wifi-list"><p class="set-note">Scanning…</p></div>
        `;
        const listEl = body.querySelector<HTMLElement>('.net-wifi-list')!;
        const scanBtn = body.querySelector<HTMLButtonElement>('.net-wifi-scan')!;

        const doScan = async () => {
            scanBtn.disabled = true;
            scanBtn.textContent = 'Scanning…';
            const res = await getJSON<WifiScanResponse>(`/api/system/network/wifi/scan?iface=${encodeURIComponent(iface)}`);
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan';
            if (!res.ok || !res.data) {
                listEl.innerHTML = unavailable(res.status, res.error);
                return;
            }
            // Strongest signal first; de-duplicate by SSID.
            const seen = new Set<string>();
            const nets = res.data.networks
                .sort((a, b) => b.signal - a.signal)
                .filter(n => (seen.has(n.ssid) ? false : (seen.add(n.ssid), true)));
            if (nets.length === 0) {
                listEl.innerHTML = `<p class="set-note">No networks found.</p>`;
                return;
            }
            listEl.innerHTML = nets.map(n => renderWifiRow(n)).join('');
            listEl.querySelectorAll<HTMLElement>('[data-connect]').forEach(btn => {
                btn.addEventListener('click', () => openWifiConnect(iface, btn.dataset.connect!, btn.dataset.secured === 'true'));
            });
            listEl.querySelectorAll<HTMLElement>('[data-forget]').forEach(btn => {
                btn.addEventListener('click', () => void forgetWifi(btn.dataset.forget!, doScan));
            });
        };

        scanBtn.addEventListener('click', () => void doScan());
        void doScan();
    };

    const openWifiConnect = (iface: string, ssid: string, secured: boolean) => {
        modalOpen = true;
        const overlay = modal(`
            <h3>Connect to ${escapeHtml(ssid)}</h3>
            ${secured
                ? `<label>Password</label>
                   <input type="password" class="net-wifi-pw" placeholder="Network password" />`
                : `<p class="set-note">This is an open network (no password).</p>`}
            <div class="net-modal-actions">
                <button class="set-btn net-cancel">Cancel</button>
                <button class="set-btn net-wifi-go" style="background:var(--accent);color:#fff;border-color:var(--accent)">Connect</button>
            </div>
        `);
        const close = () => { overlay.remove(); modalOpen = false; };
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.net-cancel')?.addEventListener('click', close);
        overlay.querySelector('.net-wifi-go')?.addEventListener('click', async () => {
            const pwEl = overlay.querySelector<HTMLInputElement>('.net-wifi-pw');
            const password = pwEl ? pwEl.value : '';
            close();
            try {
                const res = await fetch('/api/system/network/wifi/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ iface, ssid, password: password || undefined }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({})) as { error?: string };
                    alert(`Could not connect: ${err.error ?? res.status}`);
                }
            } catch {
                alert('Could not connect to the network.');
            }
            void renderWifi();
        });
    };

    const forgetWifi = async (ssid: string, after: () => Promise<void>) => {
        if (!confirm(`Forget saved network "${ssid}"?`)) return;
        try {
            const res = await fetch('/api/system/network/wifi/forget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ ssid }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                alert(`Could not forget network: ${err.error ?? res.status}`);
            }
        } catch {
            alert('Could not forget the network.');
        }
        await after();
    };

    // --- Diagnostics tab ---------------------------------------------------

    const renderDiagnostics = () => {
        body.innerHTML = `
            <div class="net-diag-form">
                <select class="net-diag-tool">
                    <option value="ping">Ping</option>
                    <option value="traceroute">Traceroute</option>
                    <option value="dns">DNS lookup</option>
                </select>
                <input type="text" class="net-diag-host" placeholder="example.com or 1.1.1.1" />
                <button class="set-btn net-diag-run" style="background:var(--accent);color:#fff;border-color:var(--accent)">Run</button>
            </div>
            <pre class="net-diag-out">Choose a tool, enter a host, and run.</pre>
        `;
        const toolSel = body.querySelector<HTMLSelectElement>('.net-diag-tool')!;
        const hostEl = body.querySelector<HTMLInputElement>('.net-diag-host')!;
        const runBtn = body.querySelector<HTMLButtonElement>('.net-diag-run')!;
        const out = body.querySelector<HTMLElement>('.net-diag-out')!;

        const run = async () => {
            const host = hostEl.value.trim();
            if (!host) { hostEl.focus(); return; }
            runBtn.disabled = true;
            const prev = runBtn.textContent;
            runBtn.textContent = 'Running…';
            out.textContent = 'Running…';
            try {
                const res = await fetch('/api/system/network/diagnostic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ tool: toolSel.value, host }),
                });
                const data = await res.json().catch(() => ({})) as DiagnosticResponse & { error?: string };
                out.textContent = res.ok ? (data.output || '(no output)') : `Error: ${data.error ?? res.status}`;
            } catch {
                out.textContent = 'Request failed.';
            }
            runBtn.disabled = false;
            runBtn.textContent = prev;
        };

        runBtn.addEventListener('click', () => void run());
        hostEl.addEventListener('keydown', e => { if (e.key === 'Enter') void run(); });
    };

    tabs.forEach(t => t.addEventListener('click', () => show((t.dataset.tab as Tab) ?? 'status')));
    show('status');

    return stopPoll;
}

function renderWifiRow(n: WifiNetwork): string {
    const bars = Math.round(n.signal / 25); // 0–4
    const signalIcon = '▂▄▆█'.slice(0, Math.max(1, bars));
    const locked = n.security && n.security !== 'open' && n.security !== '--';
    return `
        <div class="net-wifi-row${n.in_use ? ' net-wifi-active' : ''}">
            <span class="net-wifi-signal" title="${n.signal}%">${signalIcon}</span>
            <span class="net-wifi-ssid">${escapeHtml(n.ssid)}${n.in_use ? ' <span class="net-pill net-online">connected</span>' : ''}</span>
            <span class="net-wifi-sec">${locked ? escapeHtml(n.security) : 'open'}</span>
            <span class="net-iface-spacer"></span>
            <button class="set-btn" data-connect="${escapeHtml(n.ssid)}" data-secured="${locked ? 'true' : 'false'}">Connect</button>
            <button class="set-btn net-route-del" data-forget="${escapeHtml(n.ssid)}">Forget</button>
        </div>
    `;
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

async function renderStatus(body: HTMLElement, ctx: SettingsContext): Promise<void> {
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
        `) +
        group('Name resolution', `
            ${row('Static hosts (/etc/hosts)',
                `<button class="set-btn net-hosts-edit">Edit hosts file</button>`)}
        `);

    body.querySelector<HTMLButtonElement>('.net-hosts-edit')?.addEventListener('click', () => {
        if (!ctx.appManager) {
            alert('Cannot open the editor: application manager unavailable.');
            return;
        }
        ctx.appManager.launch('atol', { args: { provider: createHostsProvider() } })
            .catch(err => alert(`Could not open hosts editor: ${err instanceof Error ? err.message : String(err)}`));
    });

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
                void renderStatus(body, ctx);
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

const HISTORY_LEN = 24;

function renderInterfaceCard(
    iface: NetworkInterface,
    lastSample: Map<string, { rx: number; tx: number; t: number }>,
    history: Map<string, number[]>,
    now: number
): string {
    const prev = lastSample.get(iface.name);
    let rate = '';
    let throughput = 0;
    if (prev) {
        const dt = (now - prev.t) / 1000;
        if (dt > 0) {
            const down = Math.max(0, (iface.rx_bytes - prev.rx) / dt);
            const up = Math.max(0, (iface.tx_bytes - prev.tx) / dt);
            throughput = down + up;
            rate = `<span class="net-rate">↓ ${formatBytes(down)}/s · ↑ ${formatBytes(up)}/s</span>`;
        }
    }
    lastSample.set(iface.name, { rx: iface.rx_bytes, tx: iface.tx_bytes, t: now });

    // Append to throughput history (skip the very first sample, which has no rate).
    if (prev) {
        const hist = history.get(iface.name) ?? [];
        hist.push(throughput);
        while (hist.length > HISTORY_LEN) hist.shift();
        history.set(iface.name, hist);
    }
    const spark = sparkline(history.get(iface.name) ?? []);

    const ipv4 = iface.addresses.filter(a => a.family === 'ipv4');
    const ipv6 = iface.addresses.filter(a => a.family === 'ipv6');
    const addrLine = (label: string, list: typeof ipv4) =>
        list.length
            ? `<div class="net-iface-row"><span>${label}</span><span>${list.map(a => `${escapeHtml(a.address)}/${a.prefixlen}`).join(', ')}</span></div>`
            : '';

    const stateClass = iface.state === 'up' ? 'net-online' : 'net-offline';
    const controllable = iface.kind === 'ethernet' || iface.kind === 'wifi';
    const isUp = iface.state === 'up';
    const errors = iface.rx_errors + iface.tx_errors;
    const dropped = iface.rx_dropped + iface.tx_dropped;
    const name = escapeHtml(iface.name);
    // DHCP lease only applies when the interface got an address dynamically; we
    // can't tell the method from the address list alone, so offer Lease on any
    // controllable interface that currently has an IPv4 address.
    const hasIpv4 = ipv4.length > 0;

    return `
        <div class="net-iface">
            <div class="net-iface-head">
                <span class="net-iface-name">${name}</span>
                <span class="net-iface-kind">${escapeHtml(iface.kind)}</span>
                <span class="net-pill ${stateClass}">${escapeHtml(iface.state)}</span>
                <span class="net-iface-spacer"></span>
                ${controllable ? `
                    <button class="set-btn" data-toggle="${name}" data-up="${isUp}">${isUp ? 'Disable' : 'Enable'}</button>
                    <button class="set-btn" data-mtu="${name}">MTU</button>
                    ${hasIpv4 ? `<button class="set-btn" data-lease="${name}">Lease</button>` : ''}
                    <button class="set-btn net-iface-edit" data-edit="${name}">Configure</button>
                ` : ''}
            </div>
            ${addrLine('IPv4', ipv4)}
            ${addrLine('IPv6', ipv6)}
            ${iface.mac ? `<div class="net-iface-row"><span>MAC</span><span>${escapeHtml(iface.mac)}</span></div>` : ''}
            <div class="net-iface-row"><span>MTU</span><span>${iface.mtu || '—'}</span></div>
            ${iface.speed_mbps ? `<div class="net-iface-row"><span>Link</span><span>${iface.speed_mbps} Mbps</span></div>` : ''}
            <div class="net-iface-row">
                <span>Traffic</span>
                <span>↓ ${formatBytes(iface.rx_bytes)} · ↑ ${formatBytes(iface.tx_bytes)} ${rate}</span>
            </div>
            ${spark ? `<div class="net-iface-row"><span>Throughput</span><span class="net-spark">${spark}</span></div>` : ''}
            ${(errors > 0 || dropped > 0)
                ? `<div class="net-iface-row"><span>Errors / dropped</span><span class="net-warn">${errors} / ${dropped}</span></div>`
                : ''}
        </div>
    `;
}

/// Renders an inline SVG sparkline from throughput samples (auto-scaled).
function sparkline(values: number[]): string {
    if (values.length < 2) return '';
    const w = 96;
    const h = 22;
    const max = Math.max(...values, 1);
    const step = w / (HISTORY_LEN - 1);
    const pts = values.map((v, i) => {
        const x = i * step;
        const y = h - (v / max) * (h - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="net-spark-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" />
    </svg>`;
}

