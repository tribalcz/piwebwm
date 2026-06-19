import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import { fetchCurrentUser, logout } from '@core/AuthGate';
import type { HealthResponse, SystemOverview, Resources, DiskUsage } from '@/types/api';

const DEV_LOG_KEY = 'settings.developer.logEvents';
const POLL_MS = 2000;

/**
 * System section: a static device/OS overview, live resource meters
 * (CPU/memory/swap/disks), backend + account info, and a developer toggle.
 * Resources poll on an interval; CPU % is derived from /proc/stat deltas
 * between polls. Returns a cleanup function that stops the polling.
 */
export function renderSystem(container: Element, ctx: SettingsContext): () => void {
    const devLog = ctx.store?.get<boolean>(DEV_LOG_KEY, false) ?? false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    // Previous CPU counters, to compute utilisation between polls.
    let lastCpu: { total: number; idle: number } | null = null;

    container.innerHTML = `
        ${group('Overview', `<div id="sys-overview"><p class="set-note">Loading…</p></div>`)}
        ${group('Resources', `<div id="sys-resources"><p class="set-note">Loading…</p></div>`)}
        ${group('Backend', `
            ${row('Status', '<span id="set-health">Checking…</span>')}
            ${row('Host agent', '<span id="set-hostmode">Checking…</span>')}
        `)}
        ${group('Account', `
            ${row('Signed in as', '<span id="set-user">…</span>')}
            ${row('Session', '<button class="set-btn-danger" id="set-logout">Log out</button>')}
        `)}
        ${group('Developer', `
            ${row(
                'Log events to console',
                toggle('set-devlog', devLog),
                'Print every EventBus event to the browser console'
            )}
        `)}
    `;

    const overviewEl = container.querySelector<HTMLElement>('#sys-overview')!;
    const resourcesEl = container.querySelector<HTMLElement>('#sys-resources')!;

    // Static overview (load once).
    void (async () => {
        const res = await getJSON<SystemOverview>('/api/system/overview');
        overviewEl.innerHTML = res.ok && res.data
            ? renderOverview(res.data)
            : unavailable(res.status, res.error);
    })();

    // Live resources.
    const refreshResources = async () => {
        const res = await getJSON<Resources>('/api/system/resources');
        if (!res.ok || !res.data) {
            resourcesEl.innerHTML = unavailable(res.status, res.error);
            return;
        }
        const r = res.data;
        let cpuPct: number | null = null;
        if (lastCpu) {
            const dt = r.cpu_total - lastCpu.total;
            const di = r.cpu_idle - lastCpu.idle;
            if (dt > 0) cpuPct = clamp((1 - di / dt) * 100);
        }
        lastCpu = { total: r.cpu_total, idle: r.cpu_idle };
        resourcesEl.innerHTML = renderResources(r, cpuPct);
    };
    void refreshResources();
    pollTimer = setInterval(() => void refreshResources(), POLL_MS);

    // Backend health.
    void (async () => {
        const healthEl = container.querySelector('#set-health');
        const hostEl = container.querySelector('#set-hostmode');
        try {
            const res = await fetch('/health');
            const health = await res.json() as HealthResponse;
            if (healthEl) healthEl.textContent = res.ok ? `OK (${health.backend})` : 'Unreachable';
            if (hostEl) {
                hostEl.textContent = health.host_mode ? 'Connected' : 'Not connected (mock data)';
            }
        } catch {
            if (healthEl) healthEl.textContent = 'Unreachable';
            if (hostEl) hostEl.textContent = 'Unknown';
        }
    })();

    // Current user.
    void (async () => {
        const userEl = container.querySelector('#set-user');
        const user = await fetchCurrentUser();
        if (userEl) userEl.textContent = user ? user.username : 'Not signed in';
    })();

    container.querySelector('#set-logout')?.addEventListener('click', () => {
        if (confirm('Log out and return to the login screen?')) {
            void logout().finally(() => {
                localStorage.clear();
                location.reload();
            });
        }
    });

    const devCb = container.querySelector<HTMLInputElement>('#set-devlog');
    devCb?.addEventListener('change', () => {
        ctx.store?.set(DEV_LOG_KEY, devCb.checked);
    });

    return () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    };
}

// --- Overview --------------------------------------------------------------

function renderOverview(o: SystemOverview): string {
    const temp = o.cpu_temp_c != null ? `${o.cpu_temp_c.toFixed(1)} °C` : '—';
    const cpu = `${escapeHtml(o.cpu_model)}${o.cpu_cores ? ` · ${o.cpu_cores} cores` : ''}`;
    return [
        row('Device', escapeHtml(o.device || '—')),
        row('OS', escapeHtml(o.os || '—')),
        row('Kernel', `${escapeHtml(o.kernel || '—')}${o.arch ? ` (${escapeHtml(o.arch)})` : ''}`),
        row('CPU', cpu),
        row('Hostname', escapeHtml(o.hostname || '—')),
        row('Uptime', formatUptime(o.uptime_secs)),
        row('CPU temperature', temp),
    ].join('');
}

// --- Resources -------------------------------------------------------------

function renderResources(r: Resources, cpuPct: number | null): string {
    const cpuLabel = cpuPct != null ? `${cpuPct.toFixed(0)} %` : 'measuring…';
    const loadLine = `load ${r.load1.toFixed(2)} · ${r.load5.toFixed(2)} · ${r.load15.toFixed(2)}`
        + (r.cpu_cores ? ` · ${r.cpu_cores} cores` : '');

    const memPct = r.mem_total ? (r.mem_used / r.mem_total) * 100 : 0;
    const swapPct = r.swap_total ? (r.swap_used / r.swap_total) * 100 : 0;

    const disks = r.disks.map((d: DiskUsage) => {
        const pct = d.total ? (d.used / d.total) * 100 : 0;
        return meterRow(escapeHtml(d.mount), pct, `${fmtSize(d.used)} / ${fmtSize(d.total)}`);
    }).join('');

    return `
        ${meterRow('CPU', cpuPct ?? 0, cpuLabel, cpuPct == null)}
        <div class="sys-subline">${escapeHtml(loadLine)}</div>
        ${meterRow('Memory', memPct, `${fmtSize(r.mem_used)} / ${fmtSize(r.mem_total)}`)}
        ${r.swap_total ? meterRow('Swap', swapPct, `${fmtSize(r.swap_used)} / ${fmtSize(r.swap_total)}`) : ''}
        ${disks ? `<div class="sys-subline sys-storage-label">Storage</div>${disks}` : ''}
    `;
}

/** A labelled meter row: label, bar, and a value caption. */
function meterRow(label: string, pct: number, caption: string, muted = false): string {
    const width = clamp(pct);
    const hot = width >= 90 ? ' sys-meter-hot' : '';
    return `
        <div class="sys-res-row">
            <span class="sys-res-label">${label}</span>
            <span class="sys-meter${muted ? ' sys-meter-muted' : ''}">
                <span class="sys-meter-fill${hot}" style="width:${width.toFixed(1)}%"></span>
            </span>
            <span class="sys-res-value">${caption}</span>
        </div>
    `;
}

// --- helpers ---------------------------------------------------------------

function clamp(n: number): number {
    return Math.max(0, Math.min(100, n));
}

function fmtSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatUptime(secs: number): string {
    if (!secs) return '—';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    if (d > 0) return `${d} day${d === 1 ? '' : 's'}, ${hh}:${mm}`;
    const ss = String(Math.floor(secs % 60)).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

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

function unavailable(status: number, error?: string): string {
    let msg: string;
    if (status === 503) {
        msg = 'Host agent unavailable — start the agent to see live system info.';
    } else if (status === 404) {
        msg = 'Endpoint not found (404) — the backend is an older build. Rebuild it (./install.sh --update).';
    } else if (status === 0) {
        msg = 'No response from the server (network error).';
    } else {
        msg = `Could not read system info (HTTP ${status})${error ? `: ${error}` : ''}.`;
    }
    return `<p class="set-note">${escapeHtml(msg)}</p>`;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
