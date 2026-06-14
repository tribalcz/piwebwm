import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import { fetchCurrentUser, logout } from '@core/AuthGate';
import type { HealthResponse } from '@/types/api';

const DEV_LOG_KEY = 'settings.developer.logEvents';

export function renderSystem(container: Element, ctx: SettingsContext): void {
    const devLog = ctx.store?.get<boolean>(DEV_LOG_KEY, false) ?? false;

    container.innerHTML = `
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

    // Backend health (async fill-in).
    void (async () => {
        const healthEl = container.querySelector('#set-health');
        const hostEl = container.querySelector('#set-hostmode');
        try {
            const res = await fetch('/health');
            const health = await res.json() as HealthResponse;
            if (healthEl) healthEl.textContent = res.ok ? `OK (${health.backend})` : 'Unreachable';
            if (hostEl) {
                hostEl.textContent = health.host_mode
                    ? 'Connected'
                    : 'Not connected (mock data)';
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
}
