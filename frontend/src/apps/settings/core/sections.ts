import type { Store } from '@core/Store';
import type { EventBus } from '@core/EventBus';
import type { AppManager } from '@core/AppManager';
import type { ThemeManager } from '@core/ThemeManager';

/** Everything a section gets to render itself and apply changes. */
export interface SettingsContext {
    store: Store | null;
    eventBus: EventBus | null;
    appManager: AppManager | null;
    themeManager: ThemeManager | null;
}

/** One entry in the sidebar. Adding a section = one file + one registry row. */
export interface SettingsSection {
    id: string;
    label: string;
    icon: string; // Icons.ts name
    render: (container: Element, ctx: SettingsContext) => void;
}

// --- small shared UI builders -----------------------------------------------

export function group(title: string, bodyHtml: string): string {
    return `
        <div class="set-group">
            <div class="set-group-title">${title}</div>
            ${bodyHtml}
        </div>
    `;
}

export function row(label: string, controlHtml: string, hint?: string): string {
    return `
        <div class="set-row">
            <div class="set-row-text">
                <span class="set-row-label">${label}</span>
                ${hint ? `<span class="set-row-hint">${hint}</span>` : ''}
            </div>
            <div class="set-row-control">${controlHtml}</div>
        </div>
    `;
}

export function toggle(id: string, checked: boolean): string {
    return `
        <label class="set-toggle">
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
            <span class="set-toggle-slider"></span>
        </label>
    `;
}
