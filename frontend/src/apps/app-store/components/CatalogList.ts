import { getIcon } from '@utils/Icons';
import { entryKey, type CatalogEntry } from '../core/Catalog';

export interface CatalogListCallbacks {
    onSelect: (entry: CatalogEntry) => void;
}

/** Left pane: catalog entries grouped into Applications and Atol Modules. */
export class CatalogList {
    private container: Element;
    private callbacks: CatalogListCallbacks;
    private entries: CatalogEntry[] = [];
    private selectedKey: string | null = null;

    constructor(container: Element, callbacks: CatalogListCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
    }

    update(entries: CatalogEntry[], selectedKey: string | null): void {
        this.entries = entries;
        this.selectedKey = selectedKey;
        this.render();
    }

    private render(): void {
        if (this.entries.length === 0) {
            this.container.innerHTML = `<div class="store-empty">Nothing matches your search.</div>`;
            return;
        }

        const apps = this.entries.filter(e => e.type === 'app');
        const modules = this.entries.filter(e => e.type === 'atol-module');

        let html = '';
        if (apps.length > 0) html += this.renderSection('Applications', apps);
        if (modules.length > 0) html += this.renderSection('Atol Modules', modules);
        this.container.innerHTML = html;

        this.container.querySelectorAll<HTMLElement>('.store-card').forEach(card => {
            card.addEventListener('click', () => {
                const key = card.dataset.key;
                const entry = this.entries.find(e => entryKey(e.type, e.id) === key);
                if (entry) this.callbacks.onSelect(entry);
            });
        });
    }

    private renderSection(title: string, entries: CatalogEntry[]): string {
        const cards = entries.map(e => this.renderCard(e)).join('');
        return `<div class="store-section-title">${title}</div>${cards}`;
    }

    private renderCard(entry: CatalogEntry): string {
        const key = entryKey(entry.type, entry.id);
        const selected = key === this.selectedKey ? ' selected' : '';
        const stateClass = entry.installed ? 'is-installed' : 'is-available';
        const stateLabel = entry.installed ? 'Installed' : 'Available';

        return `
            <div class="store-card${selected}" data-key="${escapeHtml(key)}">
                <span class="store-card-icon">${getIcon(entry.icon, 28)}</span>
                <span class="store-card-main">
                    <span class="store-card-name">${escapeHtml(entry.name)} <small>v${escapeHtml(entry.version)}</small></span>
                    <span class="store-card-desc">${escapeHtml(entry.description ?? '')}</span>
                </span>
                <span class="store-card-state ${stateClass}">${stateLabel}</span>
            </div>
        `;
    }
}

function escapeHtml(text: string): string {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
