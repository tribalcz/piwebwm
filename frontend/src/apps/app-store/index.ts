import type { AppContext, AppManifest, WebDeskApp } from '@core/types';
import type { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';
import type { AppManager } from '@core/AppManager';

import { FilterBar, type FilterState } from './components/FilterBar';
import { CatalogList } from './components/CatalogList';
import { DetailPanel } from './components/DetailPanel';
import { InstallManager } from './core/InstallManager';
import { collectCatalog, entryKey, type CatalogEntry } from './core/Catalog';

/**
 * App Store — browse the catalog of applications and Atol modules and
 * install/uninstall them. "Install" toggles a persisted flag (see
 * InstallManager); it never downloads or removes code.
 */
export default class AppStore implements WebDeskApp {
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private store: Store | null;
    private manifest: AppManifest;
    private appManager: AppManager | null;

    private windowId: string | null = null;
    private install: InstallManager;

    private filterBar: FilterBar | null = null;
    private list: CatalogList | null = null;
    private detail: DetailPanel | null = null;
    private statusEl: Element | null = null;

    private entries: CatalogEntry[] = [];
    private filter: FilterState = { query: '', type: 'all' };
    private selectedKey: string | null = null;

    constructor(context: AppContext) {
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;
        this.appManager = window.webdesk?.appManager ?? null;

        this.install = new InstallManager(this.store, this.appManager);

        console.log('App Store initialized');
    }

    async init(): Promise<void> {
        console.log('App Store init');
    }

    async open(): Promise<void> {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: this.manifest?.ui?.displayName || 'App Store',
            x: 140 + (windowCount * 25),
            y: 90 + (windowCount * 25),
            width: this.manifest?.window?.defaultWidth || 760,
            height: this.manifest?.window?.defaultHeight || 520,
            content: this.renderSkeleton(),
            persistent: this.manifest?.window?.persistent || false,
            onCreated: (id, el) => this.onWindowCreated(id, el),
        });

        console.log('App Store opened, windowId:', this.windowId);
    }

    private renderSkeleton(): string {
        return `
            <div class="app-store">
                <div class="store-filterbar-host" id="store-filter"></div>
                <div class="store-body">
                    <div class="store-list" id="store-list"></div>
                    <div class="store-detail" id="store-detail"></div>
                </div>
                <div class="store-statusbar" id="store-status"></div>
            </div>
        `;
    }

    private async onWindowCreated(id: string, windowEl: HTMLElement): Promise<void> {
        this.windowId = id;

        const filterHost = windowEl.querySelector('#store-filter');
        const listHost = windowEl.querySelector('#store-list');
        const detailHost = windowEl.querySelector('#store-detail');
        this.statusEl = windowEl.querySelector('#store-status');

        if (!filterHost || !listHost || !detailHost) {
            console.error('App Store: window scaffold not found');
            return;
        }

        if (this.eventBus) {
            this.eventBus.emit('app:opened', { appId: this.manifest.id, windowId: id });
        }

        this.filterBar = new FilterBar(filterHost, {
            onChange: (state) => {
                this.filter = state;
                this.renderList();
            },
        });
        this.list = new CatalogList(listHost, {
            onSelect: (entry) => this.selectEntry(entry),
        });
        this.detail = new DetailPanel(detailHost, {
            onToggle: (entry) => this.toggleEntry(entry),
        });

        await this.reloadCatalog();
    }

    private async reloadCatalog(): Promise<void> {
        this.entries = await collectCatalog(this.appManager, this.install);
        this.renderList();
        this.renderStatus();
    }

    private visibleEntries(): CatalogEntry[] {
        const q = this.filter.query.toLowerCase().trim();
        return this.entries.filter(e => {
            if (this.filter.type !== 'all' && e.type !== this.filter.type) return false;
            if (!q) return true;
            return (
                e.name.toLowerCase().includes(q) ||
                (e.description ?? '').toLowerCase().includes(q) ||
                e.id.toLowerCase().includes(q)
            );
        });
    }

    private renderList(): void {
        this.list?.update(this.visibleEntries(), this.selectedKey);
    }

    private selectEntry(entry: CatalogEntry): void {
        this.selectedKey = entryKey(entry.type, entry.id);
        this.detail?.show(entry);
        this.renderList();
    }

    private toggleEntry(entry: CatalogEntry): void {
        const next = !entry.installed;
        try {
            this.install.setInstalled(entry, next);
        } catch (err) {
            console.error('App Store: toggle failed:', err);
            return;
        }
        entry.installed = next;
        this.detail?.show(entry);
        this.renderList();
        this.renderStatus();
    }

    private renderStatus(): void {
        if (!this.statusEl) return;
        const apps = this.entries.filter(e => e.type === 'app');
        const modules = this.entries.filter(e => e.type === 'atol-module');
        const installed = this.entries.filter(e => e.installed).length;
        this.statusEl.textContent =
            `${apps.length} application${apps.length !== 1 ? 's' : ''} · ` +
            `${modules.length} module${modules.length !== 1 ? 's' : ''}` +
            `  —  Installed: ${installed}`;
    }

    async close(): Promise<void> {
        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }
        if (this.eventBus) {
            this.eventBus.emit('app:closed', { appId: this.manifest.id, timestamp: Date.now() });
        }
        console.log('App Store closed');
    }
}
