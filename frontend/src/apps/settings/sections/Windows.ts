import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';

const RESTORE_KEY = 'settings.windows.restoreOnStartup';

export function renderWindows(container: Element, ctx: SettingsContext): void {
    const restore = ctx.store?.get<boolean>(RESTORE_KEY, true) ?? true;

    container.innerHTML = group('Session', `
        ${row(
            'Restore windows on startup',
            toggle('set-restore', restore),
            'Reopen persistent windows from the previous session'
        )}
    `);

    const cb = container.querySelector<HTMLInputElement>('#set-restore');
    cb?.addEventListener('change', () => {
        ctx.store?.set(RESTORE_KEY, cb.checked);
    });
}
