import { group, row } from '../core/sections';
import type { SettingsContext } from '../core/sections';
import {
    BACKGROUND_PRESETS,
    DRAG_OPACITY_MIN,
    DRAG_OPACITY_MAX,
    DRAG_OPACITY_DEFAULT,
    type BackgroundPreset,
    type ThemeName,
} from '@core/ThemeManager';

const THEMES: { id: ThemeName; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
];

const BACKGROUND_LABELS: Record<BackgroundPreset, string> = {
    default: 'Default',
    ocean: 'Ocean',
    forest: 'Forest',
    sunset: 'Sunset',
};

export function renderAppearance(container: Element, ctx: SettingsContext): void {
    const theme = ctx.themeManager?.getTheme() ?? 'light';
    const background = ctx.themeManager?.getBackground() ?? 'default';

    const themeCards = THEMES.map(t => `
        <button class="set-theme-card${t.id === theme ? ' selected' : ''}" data-theme-choice="${t.id}">
            <span class="set-theme-preview set-theme-preview-${t.id}">
                <span class="set-theme-preview-titlebar"></span>
            </span>
            <span class="set-theme-name">${t.label}</span>
        </button>
    `).join('');

    const bgSwatches = BACKGROUND_PRESETS.map(p => `
        <button class="set-bg-swatch set-bg-${p}${p === background ? ' selected' : ''}"
                data-bg-choice="${p}" title="${BACKGROUND_LABELS[p]}"></button>
    `).join('');

    const opacityPct = Math.round((ctx.themeManager?.getWindowDragOpacity() ?? DRAG_OPACITY_DEFAULT) * 100);
    const minPct = Math.round(DRAG_OPACITY_MIN * 100);
    const maxPct = Math.round(DRAG_OPACITY_MAX * 100);

    container.innerHTML = `
        ${group('Theme', `<div class="set-theme-cards">${themeCards}</div>`)}
        ${group('Desktop background', `<div class="set-bg-swatches">${bgSwatches}</div>`)}
        ${group('Window dragging', row(
            'Opacity while dragging',
            `<span class="set-inline">
                <input type="range" class="ap-drag-opacity" min="${minPct}" max="${maxPct}" step="1" value="${opacityPct}" />
                <span class="ap-drag-readout">${opacityPct} %</span>
            </span>`,
            'Lower = the window is more see-through while you move it'
        ))}
        <p class="set-note">Changes apply immediately and are saved automatically.</p>
    `;

    container.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach(card => {
        card.addEventListener('click', () => {
            const choice = card.dataset.themeChoice as ThemeName;
            ctx.themeManager?.setTheme(choice);
            // Re-render to move the selection highlight.
            renderAppearance(container, ctx);
        });
    });

    container.querySelectorAll<HTMLElement>('[data-bg-choice]').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const choice = swatch.dataset.bgChoice as BackgroundPreset;
            ctx.themeManager?.setBackground(choice);
            renderAppearance(container, ctx);
        });
    });

    // Drag-opacity slider applies live; no re-render (that would drop focus and
    // make the slider feel jumpy), just update the readout.
    const slider = container.querySelector<HTMLInputElement>('.ap-drag-opacity');
    const readout = container.querySelector<HTMLElement>('.ap-drag-readout');
    slider?.addEventListener('input', () => {
        const pct = parseInt(slider.value, 10);
        if (readout) readout.textContent = `${pct} %`;
        ctx.themeManager?.setWindowDragOpacity(pct / 100);
    });
}
