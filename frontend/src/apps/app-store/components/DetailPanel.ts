import { getIcon } from '@utils/Icons';
import type { CatalogEntry } from '../core/Catalog';

export interface DetailPanelCallbacks {
    onToggle: (entry: CatalogEntry) => void;
}

/** Right pane: full detail of the selected entry plus the install action. */
export class DetailPanel {
    private container: Element;
    private callbacks: DetailPanelCallbacks;
    private current: CatalogEntry | null = null;

    constructor(container: Element, callbacks: DetailPanelCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.clear();
    }

    clear(): void {
        this.current = null;
        this.container.innerHTML = `<div class="store-detail-empty">Select an item to see details.</div>`;
    }

    show(entry: CatalogEntry): void {
        this.current = entry;

        const typeLabel = entry.type === 'app' ? 'Application' : 'Atol module';
        const locked = entry.installed && !entry.removable;

        const meta: string[] = [];
        if (entry.category) meta.push(this.metaRow('Category', entry.category));
        if (entry.host) meta.push(this.metaRow('Host', entry.host));
        if (entry.author) meta.push(this.metaRow('Author', entry.author));
        if (entry.permissions && entry.permissions.length > 0) {
            const perms = entry.permissions.map(p => `<li>${escapeHtml(p)}</li>`).join('');
            meta.push(`<dt>Permissions</dt><dd><ul class="store-perms">${perms}</ul></dd>`);
        }

        const actionIcon = entry.installed ? 'delete' : 'install';
        const actionLabel = entry.installed ? 'Uninstall' : 'Install';
        const actionClass = entry.installed ? 'uninstall' : 'install';

        this.container.innerHTML = `
            <div class="store-detail-head">
                <span class="store-detail-icon">${getIcon(entry.icon, 48)}</span>
                <div class="store-detail-titles">
                    <div class="store-detail-name">${escapeHtml(entry.name)}</div>
                    <div class="store-detail-sub">v${escapeHtml(entry.version)}</div>
                    <div class="store-detail-type">${typeLabel}</div>
                </div>
            </div>
            <p class="store-detail-desc">${escapeHtml(entry.description ?? 'No description provided.')}</p>
            <dl class="store-detail-meta">${meta.join('')}</dl>
            <div class="store-detail-actions">
                <button class="store-action-btn ${actionClass}" ${locked ? 'disabled' : ''}>
                    <span class="store-action-icon">${getIcon(actionIcon, 16)}</span> ${actionLabel}
                </button>
                ${locked ? '<span class="store-required">Required — cannot be removed</span>' : ''}
            </div>
        `;

        const btn = this.container.querySelector<HTMLButtonElement>('.store-action-btn');
        btn?.addEventListener('click', () => {
            if (this.current && !btn.disabled) {
                this.callbacks.onToggle(this.current);
            }
        });
    }

    private metaRow(label: string, value: string): string {
        return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
