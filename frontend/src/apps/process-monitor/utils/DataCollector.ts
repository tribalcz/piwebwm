import type { WindowManager } from '@core/WindowManager';
import type { EventBus, EventBusStats, EventLogEntry } from '@core/EventBus';
import type { Store, StoreStats } from '@core/Store';
import type { AppManager } from '@core/AppManager';

export interface DataCollectorDeps {
    windowManager: WindowManager | null;
    eventBus: EventBus | null;
    store: Store | null;
    appManager: AppManager | null;
}

export interface WindowStatsView {
    total: number;
    active: string | null;
    minimized: number;
    maximized: number;
    normal: number;
    zIndex?: number;
}

export interface AppStatsView {
    registered: number;
    running: number;
    runningApps: string[];
    categories?: Map<string, string[]>;
}

export interface SystemStatsView {
    windows: WindowStatsView;
    apps: AppStatsView;
    events: EventBusStats;
    store: StoreStats;
    timestamp: number;
}

export interface RunningAppView {
    id: string;
    name: string;
    status: string;
    startTime: number;
}

export interface ActiveWindowView {
    id: string;
    title: string;
    state: 'normal' | 'minimized' | 'maximized';
    zIndex: string | number;
    persistent: boolean;
}

/**
 * Data Collector - Centralized data collection and processing
 * Collects data from eventBus, store, app manager, window manager
 */
export class DataCollector {
    private windowManager: WindowManager | null;
    private eventBus: EventBus | null;
    private store: Store | null;
    private appManager: AppManager | null;

    constructor({ windowManager, eventBus, store, appManager }: DataCollectorDeps) {
        this.windowManager = windowManager;
        this.eventBus = eventBus;
        this.store = store;
        this.appManager = appManager;

        console.log('Data Collector initialized');
    }

    /**
     * Get system statistic from all managers
     */
    getSystemStats(): SystemStatsView {
        const stats: SystemStatsView = {
            windows: this.getWindowStats(),
            apps: this.getAppStats(),
            events: this.getEventStats(),
            store: this.getStoreStats(),
            timestamp: Date.now()
        };

        return stats;
    }

    /**
     * Get window statistic from window manager
     */
    getWindowStats(): WindowStatsView {
        if (!this.windowManager) {
            return {
                total: 0,
                active: null,
                minimized: 0,
                maximized: 0,
                normal: 0,
            };
        }

        return this.windowManager.getStats();
    }

    /**
     * Get app statistic from app manager
     */
    getAppStats(): AppStatsView {
        if (!this.appManager) {
            return {
                registered: 0,
                running: 0,
                runningApps: []
            };
        }

        return this.appManager.getStats();
    }

    /**
     * Get event statistic from event bus
     */
    getEventStats(): EventBusStats {
        if (!this.eventBus) {
            return {
                events: 0,
                totalListeners: 0,
                logSize: 0
            };
        }

        return this.eventBus.getStats();
    }

    /**
     * Get store statistic from store
     */
    getStoreStats(): StoreStats {
        if (!this.store) {
            return {
                keys: 0,
                totalKeys: 0,
                subscribers: 0,
                autoPersist: false
            };
        }

        return this.store.getStats();
    }

    /**
     * Get list of running apps with metadata
     */
    getRunningApps(): RunningAppView[] {
        if (!this.appManager) {
            return [];
        }

        const runningIds = this.appManager.getRunningApps();

        return runningIds.map(id => {
            const manifest = this.appManager?.registry.get(id);

            return {
                id,
                name: manifest?.name || id,
                status: 'active',
                startTime: Date.now() - 60000 // Mock for now - apps do not track start time yet
            };
        });
    }

    /**
     * Get list of active windows with state
     */
    getActiveWindows(): ActiveWindowView[] {
        if (!this.windowManager) {
            return [];
        }

        const windows = this.windowManager.getAllWindows();

        return Array.from(windows.entries()).map(([id, win]) => {
            let state: ActiveWindowView['state'] = 'normal';
            if (win.minimized) state = 'minimized';
            else if (win.maximized) state = 'maximized';

            return {
                id,
                title: win.config?.title || 'Untitled',
                state,
                zIndex: win.element?.style?.zIndex || 0,
                persistent: win.config?.persistent || false
            };
        });
    }

    /**
     * Get recent events from EventBus log
     */
    getRecentEvents(limit: number = 50): EventLogEntry[] {
        if (!this.eventBus) {
            return [];
        }

        return this.eventBus.getLog(limit);
    }
}
