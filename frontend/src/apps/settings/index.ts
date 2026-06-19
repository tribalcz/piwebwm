import { getIcon } from '@utils/Icons';
import type { AppContext, AppManifest, WebDeskApp } from '@core/types';
import type { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';

import type { SettingsContext, SettingsSection } from './core/sections';
import { renderAppearance } from './sections/Appearance';
import { renderNetwork } from './sections/Network';
import { renderDateTime } from './sections/DateTime';
import { renderWindows } from './sections/Windows';
import { renderTaskbarClock } from './sections/TaskbarClock';
import { renderSystem } from './sections/System';
import { renderAbout } from './sections/About';

const SECTIONS: SettingsSection[] = [
    { id: 'appearance', label: 'Appearance', icon: 'settings', render: renderAppearance },
    { id: 'network', label: 'Network', icon: 'network', render: renderNetwork },
    { id: 'datetime', label: 'Date & Time', icon: 'globe', render: renderDateTime },
    { id: 'windows', label: 'Windows', icon: 'windowsStats', render: renderWindows },
    { id: 'taskbar-clock', label: 'Taskbar & Clock', icon: 'clock', render: renderTaskbarClock },
    { id: 'system', label: 'System', icon: 'systemMonitor', render: renderSystem },
    { id: 'about', label: 'About', icon: 'welcome', render: renderAbout },
];

/**
 * Settings — GNOME-like layout: a sidebar with sections on the left, the
 * selected section's controls on the right. All values persist in the Store
 * under settings.* and apply immediately.
 */
export default class Settings implements WebDeskApp {
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private store: Store | null;
    private manifest: AppManifest;

    private windowId: string | null = null;
    private activeSection = SECTIONS[0].id;
    private contentEl: Element | null = null;
    private sidebarEl: Element | null = null;
    private currentCleanup: (() => void) | null = null;

    constructor(context: AppContext) {
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;

        console.log('Settings initialized');
    }

    async init(): Promise<void> {
        console.log('Settings init');
    }

    async open(): Promise<void> {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: this.manifest?.ui?.displayName || 'Settings',
            x: 170 + (windowCount * 25),
            y: 100 + (windowCount * 25),
            width: this.manifest?.window?.defaultWidth || 720,
            height: this.manifest?.window?.defaultHeight || 500,
            content: this.renderSkeleton(),
            persistent: this.manifest?.window?.persistent || false,
            onCreated: (id, el) => this.onWindowCreated(id, el),
        });

        console.log('Settings opened, windowId:', this.windowId);
    }

    private renderSkeleton(): string {
        const items = SECTIONS.map(s => `
            <button class="set-nav-item" data-section="${s.id}">
                <span class="set-nav-icon">${getIcon(s.icon, 18)}</span>
                <span>${s.label}</span>
            </button>
        `).join('');

        return `
            <div class="settings-app">
                <div class="set-sidebar">${items}</div>
                <div class="set-content">
                    <h2 class="set-content-title"></h2>
                    <div class="set-content-body"></div>
                </div>
            </div>
        `;
    }

    private onWindowCreated(id: string, windowEl: HTMLElement): void {
        this.windowId = id;

        this.sidebarEl = windowEl.querySelector('.set-sidebar');
        this.contentEl = windowEl.querySelector('.set-content');

        if (this.eventBus) {
            this.eventBus.emit('app:opened', { appId: this.manifest.id, windowId: id });
        }

        this.sidebarEl?.querySelectorAll<HTMLElement>('.set-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.dataset.section;
                if (sectionId) this.showSection(sectionId);
            });
        });

        this.showSection(this.activeSection);
    }

    private buildContext(): SettingsContext {
        return {
            store: this.store,
            eventBus: this.eventBus,
            appManager: window.webdesk?.appManager ?? null,
            themeManager: window.webdesk?.themeManager ?? null,
        };
    }

    private showSection(sectionId: string): void {
        const section = SECTIONS.find(s => s.id === sectionId);
        if (!section || !this.contentEl) return;

        this.activeSection = sectionId;

        // Tear down the previously rendered section (e.g. stop polling).
        this.currentCleanup?.();
        this.currentCleanup = null;

        this.sidebarEl?.querySelectorAll<HTMLElement>('.set-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        const title = this.contentEl.querySelector('.set-content-title');
        const body = this.contentEl.querySelector('.set-content-body');
        if (!title || !body) return;

        title.textContent = section.label;
        const cleanup = section.render(body, this.buildContext());
        this.currentCleanup = typeof cleanup === 'function' ? cleanup : null;
    }

    async close(): Promise<void> {
        this.currentCleanup?.();
        this.currentCleanup = null;

        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }
        if (this.eventBus) {
            this.eventBus.emit('app:closed', { appId: this.manifest.id, timestamp: Date.now() });
        }
        console.log('Settings closed');
    }
}
