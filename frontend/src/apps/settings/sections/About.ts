import { group, row } from '../core/sections';
import type { SettingsContext } from '../core/sections';

export function renderAbout(container: Element, ctx: SettingsContext): void {
    const apps = ctx.appManager?.registry.getAll() ?? [];
    const installed = apps.filter(a => ctx.appManager?.isAppInstalled(a.id)).length;

    container.innerHTML = `
        ${group('WebDesk OS', `
            ${row('Description', '<span>A web-based desktop environment for headless Linux systems</span>')}
            ${row('Applications', `<span>${apps.length} registered · ${installed} installed</span>`)}
            ${row('Frontend', '<span>TypeScript + Vite</span>')}
            ${row('Backend', '<span>Go (Gin) · Rust host agent</span>')}
        `)}
        <p class="set-note">Made with care for Raspberry Pi and other headless machines.</p>
    `;
}
