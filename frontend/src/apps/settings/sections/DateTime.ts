import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import type {
    TimeSettings,
    TimezonesResponse,
    LocaleSettings,
    LocalesResponse,
} from '@/types/api';

/**
 * Date & Time section: system time zone, automatic time (NTP), manual clock,
 * and the system locale. Reads/writes via /api/system/* (timedatectl /
 * localectl on the host). Like Network, this needs the host agent — when it's
 * unavailable the section shows a clear message instead of empty controls.
 */
export function renderDateTime(container: Element, _ctx: SettingsContext): void {
    void load(container as HTMLElement);
}

async function load(body: HTMLElement): Promise<void> {
    body.innerHTML = `<p class="set-note">Loading…</p>`;

    const [time, tz, locale, locales] = await Promise.all([
        getJSON<TimeSettings>('/api/system/time'),
        getJSON<TimezonesResponse>('/api/system/timezones'),
        getJSON<LocaleSettings>('/api/system/locale'),
        getJSON<LocalesResponse>('/api/system/locales'),
    ]);

    if (!time.ok || !time.data) {
        body.innerHTML = unavailable(time.status, time.error);
        return;
    }
    const t = time.data;
    const zones = tz.data?.timezones ?? [];
    const localeList = locales.data?.locales ?? [];
    const currentLang = locale.data?.lang ?? '';

    const tzOptions = zones.map(z => `<option value="${escapeHtml(z)}"></option>`).join('');
    const localeOptions = localeList.map(l => `<option value="${escapeHtml(l)}"></option>`).join('');

    body.innerHTML =
        group('Time zone', `
            ${row('Current', `<span>${escapeHtml(t.timezone || '—')}</span>`)}
            ${row('Set time zone',
                `<span class="set-inline">
                    <input type="text" class="set-input dt-tz" list="dt-tz-list" value="${escapeHtml(t.timezone)}" placeholder="Region/City" />
                    <datalist id="dt-tz-list">${tzOptions}</datalist>
                    <button class="set-btn dt-tz-save">Apply</button>
                </span>`,
                zones.length ? `${zones.length} zones available` : undefined)}
        `) +
        group('Automatic date & time', `
            ${row('Network time (NTP)', toggle('dt-ntp', t.ntp),
                'Keep the clock synchronized over the network')}
            ${row('Synchronized', t.ntp_synced
                ? '<span class="net-pill net-online">Yes</span>'
                : '<span class="net-pill net-offline">No</span>')}
        `) +
        group('Current time', `
            ${row('System clock', `<span class="dt-clock">${escapeHtml(t.time || '—')}</span>`)}
            ${t.ntp ? '' : row('Set manually',
                `<span class="set-inline">
                    <input type="text" class="set-input dt-time" value="${escapeHtml(t.time)}" placeholder="YYYY-MM-DD HH:MM:SS" />
                    <button class="set-btn dt-time-save">Set</button>
                </span>`,
                'Only available while network time is off')}
        `) +
        group('Region & language', `
            ${row('Locale (LANG)', `<span>${escapeHtml(currentLang || '—')}</span>`)}
            ${row('Set locale',
                `<span class="set-inline">
                    <input type="text" class="set-input dt-locale" list="dt-locale-list" value="${escapeHtml(currentLang)}" placeholder="en_US.UTF-8" />
                    <datalist id="dt-locale-list">${localeOptions}</datalist>
                    <button class="set-btn dt-locale-save">Apply</button>
                </span>`,
                localeList.length ? `${localeList.length} locales available` : 'No generated locales found')}
        `);

    wire(body);
}

function wire(body: HTMLElement): void {
    const reload = () => void load(body);

    // Time zone.
    body.querySelector('.dt-tz-save')?.addEventListener('click', () => {
        const tz = body.querySelector<HTMLInputElement>('.dt-tz')!.value.trim();
        if (!tz) return;
        void postThenReload(body, '/api/system/timezone', { timezone: tz }, reload);
    });

    // NTP toggle.
    body.querySelector<HTMLInputElement>('#dt-ntp')?.addEventListener('change', e => {
        const enabled = (e.target as HTMLInputElement).checked;
        void postThenReload(body, '/api/system/ntp', { enabled }, reload);
    });

    // Manual time.
    body.querySelector('.dt-time-save')?.addEventListener('click', () => {
        const time = body.querySelector<HTMLInputElement>('.dt-time')!.value.trim();
        if (!time) return;
        void postThenReload(body, '/api/system/time', { time }, reload);
    });

    // Locale.
    body.querySelector('.dt-locale-save')?.addEventListener('click', () => {
        const lang = body.querySelector<HTMLInputElement>('.dt-locale')!.value.trim();
        if (!lang) return;
        void postThenReload(body, '/api/system/locale', { lang }, reload);
    });
}

async function postThenReload(
    body: HTMLElement,
    url: string,
    payload: Record<string, unknown>,
    reload: () => void,
): Promise<void> {
    try {
        const res = await fetch(url, {
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
    } catch {
        alert('Could not reach the server.');
        return;
    }
    reload();
}

// --- helpers (shared shape with the Network section) -----------------------

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
        msg = 'Host agent unavailable — start the agent (its status is in Settings ▸ System).';
    } else if (status === 404) {
        msg = 'Endpoint not found (404) — the backend is an older build without the time/locale API. Rebuild the backend container.';
    } else if (status === 0) {
        msg = 'No response from the server (network error).';
    } else if (status >= 500) {
        msg = `Server/agent error (${status})${error ? `: ${error}` : ''}. Check the host-agent log — are systemd-timedated and localectl available?`;
    } else {
        msg = `Could not read date/time settings (HTTP ${status})${error ? `: ${error}` : ''}.`;
    }
    return `<p class="set-note">${escapeHtml(msg)}</p>`;
}

function escapeHtml(text: string): string {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
