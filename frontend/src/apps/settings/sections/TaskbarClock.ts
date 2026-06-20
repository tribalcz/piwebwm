import { group, row, toggle } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import type { TaskbarSize } from '@core/ThemeManager';

const FORMAT_KEY = 'settings.clock.format';
const SECONDS_KEY = 'settings.clock.showSeconds';
const SHOW_DATE_KEY = 'settings.clock.showDate';

export function renderTaskbarClock(container: Element, ctx: SettingsContext): void {
    const format = ctx.store?.get<string>(FORMAT_KEY, '24h') ?? '24h';
    const showSeconds = ctx.store?.get<boolean>(SECONDS_KEY, true) ?? true;
    const showDate = ctx.store?.get<boolean>(SHOW_DATE_KEY, false) ?? false;
    const taskbarSize = ctx.themeManager?.getTaskbarSize() ?? 'normal';

    const formatControl = `
        <select id="set-clock-format" class="set-select">
            <option value="24h" ${format === '24h' ? 'selected' : ''}>24-hour</option>
            <option value="12h" ${format === '12h' ? 'selected' : ''}>12-hour</option>
        </select>
    `;

    const sizeControl = `
        <select id="set-taskbar-size" class="set-select">
            <option value="normal" ${taskbarSize === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="compact" ${taskbarSize === 'compact' ? 'selected' : ''}>Compact</option>
        </select>
    `;

    container.innerHTML = `
        ${group('Taskbar', row('Size', sizeControl, 'Compact makes the taskbar thinner'))}
        ${group('Clock', `
            ${row('Time format', formatControl)}
            ${row('Show seconds', toggle('set-clock-seconds', showSeconds))}
            ${row('Show date', toggle('set-clock-date', showDate), 'Show the date next to the time')}
        `)}
    `;

    const sizeSelect = container.querySelector<HTMLSelectElement>('#set-taskbar-size');
    sizeSelect?.addEventListener('change', () => {
        ctx.themeManager?.setTaskbarSize(sizeSelect.value as TaskbarSize);
    });

    const select = container.querySelector<HTMLSelectElement>('#set-clock-format');
    select?.addEventListener('change', () => {
        ctx.store?.set(FORMAT_KEY, select.value);
    });

    const seconds = container.querySelector<HTMLInputElement>('#set-clock-seconds');
    seconds?.addEventListener('change', () => {
        ctx.store?.set(SECONDS_KEY, seconds.checked);
    });

    const date = container.querySelector<HTMLInputElement>('#set-clock-date');
    date?.addEventListener('change', () => {
        ctx.store?.set(SHOW_DATE_KEY, date.checked);
    });
}
