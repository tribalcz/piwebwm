/**
 * Data Collector - Centralized data collection and processing
 * Colets data from eventBus, store, app manager window manager
 */

export class DataCollector {
    constructor({ windowManager, eventBus, store, appManager }) {
        this.windowManager = windowManager;
        this.eventBus = eventBus;
        this.store = store;
        this.appManager = appManager;

        console.log('Data Collector initialized');
    }

    /**
     * Get system statistic from all managers
     */
    getSystemStats() {
        const stats = {windows: this.getWindowStats(),
            apps: this.getAppStats(),
            events: this.getEventStats(),
            store: this.getStoreStats(),
            timestamp: Date.now()
        }

        return stats;
    }

    /**
     * Get window statistic from window manager
     */
    getWindowStats() {
        if (!this.windowManager || !this.windowManager.getStats) {
            return {
                total: 0,
                active: null,
                minimized: 0,
                maximized: 0,
                normal: 0,
            }
        }

        return this.windowManager.getStats();
    }

    /**
     * Get app statistic from app manager
     */
    getAppStats() {
        if (!this.appManager || !this.appManager.getStats) {
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
    getEventStats() {
        if (!this.eventBus || !this.eventBus.getStats) {
            return {
                events: 0,
                totalListeners: 0,
                logSize: 0 };
        }

        return this.eventBus.getStats();
    }

    /**
     * Get store statistic from store
     */
    getStoreStats() {
        if (!this.store || !this.store.getStats) {
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
    getRunningApps() {
        if (!this.appManager) {
            return [];
        }

        const runningIds = this.appManager.getRunningApps ?
            this.appManager.getRunningApps() : [];

        return runningIds.map(id => {
            const appInstance = this.appManager.runningApps?.get(id);
            const manifest = this.appManager.registry?.get(id);

            return {
                id,
                name: manifest?.name || id,
                status: 'active',
                startTime: appInstance?.startTime || Date.now() - 60000 // Mock for now
            };
        });
    }

    /**
     * Get list of active windows with state
     */
    getActiveWindows() {
        if (!this.windowManager || !this.windowManager.getAllWindows) {
            return [];
        }

        const windows = this.windowManager.getAllWindows();

        return Array.from(windows.entries()).map(([id, win]) => {
            let state = 'normal';
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
    getRecentEvents(limit = 50) {
        if (!this.eventBus || !this.eventBus.getLog) {
            return [];
        }

        return this.eventBus.getLog(limit);
    }
}