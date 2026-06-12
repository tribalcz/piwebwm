import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';

const FORMAT_KEY = 'settings.clock.format';
const SECONDS_KEY = 'settings.clock.showSeconds';

export function renderTaskbarClock(container: Element, ctx: SettingsContext): void {
    const format = ctx.store?.get<string>(FORMAT_KEY, '24h') ?? '24h';
    const showSeconds = ctx.store?.get<boolean>(SECONDS_KEY, true) ?? true;

    const formatControl = `
        <select id="set-clock-format" class="set-select">
            <option value="24h" ${format === '24h' ? 'selected' : ''}>24-hour</option>
            <option value="12h" ${format === '12h' ? 'selected' : ''}>12-hour</option>
        </select>
    `;

    container.innerHTML = group('Clock', `
        ${row('Time format', formatControl)}
        ${row('Show seconds', toggle('set-clock-seconds', showSeconds))}
    `);

    const select = container.querySelector<HTMLSelectElement>('#set-clock-format');
    select?.addEventListener('change', () => {
        ctx.store?.set(FORMAT_KEY, select.value);
    });

    const seconds = container.querySelector<HTMLInputElement>('#set-clock-seconds');
    seconds?.addEventListener('change', () => {
        ctx.store?.set(SECONDS_KEY, seconds.checked);
    });
}
