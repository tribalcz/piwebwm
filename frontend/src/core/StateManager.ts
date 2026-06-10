import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';
import type { WindowManager } from '@core/WindowManager';

interface PersistedWindow {
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    maximized: boolean;
    persistent: boolean;
}

export class StateManager {
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private store: Store | null;

    constructor(windowManager: WindowManager, eventBus: EventBus | null = null, store: Store | null = null) {
        this.windowManager = windowManager;
        this.eventBus = eventBus;
        this.store = store;

        console.log('StateManager initialized');

        if (this.eventBus) {
            console.log('  ↳ StateManager connected to EventBus');
        }
        if (this.store) {
            console.log('  ↳ StateManager connected to Store');
        }

        this.setupEventListeners();

        this.restoreWindowState();
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        if (!this.eventBus) return;

        this.eventBus.on('window:created', () => this.saveWindowState());
        this.eventBus.on('window:closed', () => this.saveWindowState());
        this.eventBus.on('window:focused', () => this.saveWindowState());

        console.log('  ↳ StateManager listening to window events');
    }

    /**
     * Save window state
     */
    saveWindowState(): void {
        if (!this.store) return;

        const windows = this.windowManager.getAllWindows();
        const windowsData: PersistedWindow[] = Array.from(windows.entries()).map(([id, win]) => ({
            id: id,
            title: win.config.title,
            x: parseInt(win.element.style.left) || 0,
            y: parseInt(win.element.style.top) || 0,
            width: parseInt(win.element.style.width) || 600,
            height: parseInt(win.element.style.height) || 400,
            minimized: win.minimized || false,
            maximized: win.maximized || false,
            persistent: win.config.persistent || false
        }));

        this.store.set('persistence.windows', windowsData);

        console.log(`Saved ${windowsData.length} window(s) to Store`);
    }

    /**
     * Restore window state from Store
     */
    restoreWindowState(): void {
        if (!this.store) return;

        const savedWindows = this.store.get<PersistedWindow[]>('persistence.windows', []);

        if (savedWindows.length === 0) {
            console.log('No windows to restore');
            return;
        }

        console.log(`📂 Restoring ${savedWindows.length} window(s)...`);

        savedWindows.forEach(winData => {
            if (!winData.persistent) {
                return;
            }

            try {
                this.windowManager.createWindow({
                    title: winData.title,
                    x: winData.x,
                    y: winData.y,
                    width: winData.width,
                    height: winData.height,
                    content: '<div style="padding: 20px;">Restored window - content not preserved</div>',
                    persistent: true
                });
            } catch (error) {
                console.error(`Failed to restore window ${winData.id}:`, error);
            }
        });
    }

    /**
     * Clear saved state
     */
    clearState(): void {
        if (!this.store) return;

        this.store.delete('persistence.windows');
        console.log('State cleared');
    }
}
