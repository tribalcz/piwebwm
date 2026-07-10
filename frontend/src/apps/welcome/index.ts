import type { AppContext, AppManifest, WebDeskApp } from '@core/types';
import type { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';
import { getIcon } from '@utils/Icons';

interface AppEntry {
    icon: string;
    name: string;
    desc: string;
}

const APPS: AppEntry[] = [
    { icon: 'fileManager', name: 'File Explorer', desc: 'browse files; open text files straight in Atol' },
    { icon: 'textEditor', name: 'Atol', desc: 'modular editor — a notepad that grows toward an IDE; also edits files' },
    { icon: 'appStore', name: 'App Store', desc: 'install or remove apps and Atol modules' },
    { icon: 'settings', name: 'Settings', desc: 'appearance, network, date & time, and live system info' },
    { icon: 'processMonitor', name: 'Process Monitor', desc: 'inspect running processes' },
];

/**
 * Welcome App — a short introduction to WebDesk OS and a couple of quick links
 * into the most useful apps.
 */
export default class Welcome implements WebDeskApp {
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private store: Store | null;
    private manifest: AppManifest;

    private windowId: string | null = null;

    constructor(context: AppContext) {
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;

        console.log('Welcome App initialized');
    }

    async init(): Promise<void> {
        console.log('Welcome App init');
    }

    async open(): Promise<void> {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: 'Welcome to WebDesk OS',
            x: 100 + (windowCount * 30),
            y: 100 + (windowCount * 30),
            width: this.manifest?.window?.defaultWidth || 540,
            height: this.manifest?.window?.defaultHeight || 480,
            persistent: this.manifest?.window?.persistent ?? true,
            content: this.createContent(),
            onCreated: (_id, el) => this.wire(el),
        });

        if (this.eventBus) {
            this.eventBus.emit('app:opened', {
                appId: this.manifest.id,
                windowId: this.windowId,
            });
        }
    }

    async close(): Promise<void> {
        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }
        if (this.eventBus) {
            this.eventBus.emit('app:closed', {
                appId: this.manifest.id,
                timestamp: Date.now(),
            });
        }
        console.log('Welcome App closed');
    }

    /** Wires the quick-launch buttons to the app manager. */
    private wire(el: HTMLElement): void {
        el.querySelectorAll<HTMLElement>('[data-launch]').forEach(btn => {
            btn.addEventListener('click', () => {
                const appId = btn.dataset.launch!;
                window.webdesk?.appManager?.launch(appId).catch(err => {
                    console.error(`Welcome: failed to launch ${appId}`, err);
                });
            });
        });
    }

    private createContent(): string {
        const apps = APPS.map(a => `
            <li>
                <span class="welcome-ic">${getIcon(a.icon, 18)}</span>
                <span><strong>${a.name}</strong> <span class="welcome-desc">— ${a.desc}</span></span>
            </li>
        `).join('');

        return `
            <div class="welcome">
                <div class="welcome-head">
                    <span class="welcome-logo">${getIcon('welcome', 30)}</span>
                    <div>
                        <h2>WebDesk OS</h2>
                        <p class="welcome-sub">A web-based desktop for headless Linux and Raspberry Pi.</p>
                    </div>
                </div>

                <h3>Apps</h3>
                <ul class="welcome-list">${apps}</ul>

                <h3>Desktop</h3>
                <ul class="welcome-plain">
                    <li>Window management — move, resize, minimize and maximize</li>
                    <li>Start menu with app search and power options</li>
                    <li>Light and dark themes</li>
                    <li>Sessions persist across reloads</li>
                </ul>

                <div class="welcome-actions">
                    <button class="welcome-btn primary" data-launch="settings">Open Settings</button>
                    <button class="welcome-btn" data-launch="app-store">Open App Store</button>
                    <button class="welcome-btn" data-launch="file-explorer">Open Files</button>
                </div>

                <div class="welcome-tip">
                    Tip: right-click the desktop for quick actions, and use the App Store to add more apps and Atol modules.
                </div>
            </div>
        `;
    }
}
