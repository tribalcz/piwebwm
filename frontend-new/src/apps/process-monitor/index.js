/**
 * Process Monitor App
 * Monitors WebDesk WM processes, events and resources
 */

import { SystemStats } from './components/SystemStats.js';
import { AppList } from './components/AppList.js';
import { WindowList } from './components/WindowList.js';
import { EventLog } from './components/EventLog.js';
import { DataCollector } from './utils/DataCollector.js';
import {getIcon} from "@utils/Icons.js";

export default class ProcessMonitor {
    constructor(context) {
        this.context = context;
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;
        this.appManager = window.webdesk?.appManager || null;

        this.windowId = null;
        this.refreshInterval = null;
        this.dataCollector = null;

        this.components = {
            systemStats: null,
            appList: null,
            windowList: null,
            eventLog: null
        };

        console.log('Process Monitor App initialized');
    }

    async init() {
        this.dataCollector = new DataCollector({
            windowManager: this.windowManager,
            eventBus: this.eventBus,
            store: this.store,
            appManager: this.appManager
        });

        console.log('Process Monitor App init complete');
    }

    async open() {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: this.manifest?.ui?.displayName || `Process Monitor`,
            x: 50 + (windowCount * 25),
            y: 50 + (windowCount * 25),
            width: this.manifest?.window?.defaultWidth || 650,
            height: this.manifest?.window?.defaultHeight || 750,
            content: this.createLayout(),
            persistent: this.manifest?.window?.persistent || false,
            onCreated: (id, windowEl) => this.onWindowCreated(id, windowEl)
        });

        if (this.eventBus) {
            this.eventBus.emit('app:opened', {
                appId: this.manifest.id,
                windowId: this.windowId,
            });
        }

        console.log('Process Monitor App opened');
    }

    createLayout() {
        return `
            <div class="process-monitor" style="padding: 16px; height: 100%; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;">
                <div id="system-stats" style="flex-shrink: 0;"></div>
                <div id="app-list" style="flex-shrink: 0;"></div>
                <div id="window-list" style="flex-shrink: 0;"></div>
                <div id="event-log" style="flex: 1; min-height: 200px; overflow: hidden;"></div>
                <div id="actions" style="flex-shrink: 0; display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                    <button id="btn-export" style="padding: 6px 12px; cursor: pointer;">${getIcon('exportStats', 16)} Export Stats</button>
                    <button id="btn-clear" style="padding: 6px 12px; cursor: pointer;">${getIcon('clear', 16)} Clear Events</button>
                    <button id="btn-pause" style="padding: 6px 12px; cursor: pointer;">${getIcon('pause', 16)} Pause</button>
                </div>
            </div>
        `;
    }

    onWindowCreated(id, windowEl) {
        const contentEl = windowEl.querySelector('.window-content');

        this.initializeComponents(contentEl);

        this.setupActions(contentEl);

        this.startMonitoring();

        console.log('ProcessMonitor window created and components initialized');
    }

    initializeComponents(contentEl) {
        console.log('=== Initializing Components ===');

        if (!this.dataCollector) {
            console.error('DataCollector is not initialized!');
            return;
        }

        if (!this.eventBus) {
            console.warn('EventBus is not available, trying fallback');
            this.eventBus = window.webdesk?.eventBus || null;
        }

        try {
            this.components.systemStats = new SystemStats(
                contentEl.querySelector('#system-stats'),
                this.dataCollector
            );

            this.components.appList = new AppList(
                contentEl.querySelector('#app-list'),
                this.dataCollector
            );

            this.components.windowList = new WindowList(
                contentEl.querySelector('#window-list'),
                this.dataCollector
            );

            this.components.eventLog = new EventLog(
                contentEl.querySelector('#event-log'),
                this.eventBus
            );

            console.log('All components initialized successfully');
        } catch (error) {
            console.error('Failed to initialize components:', error);
        }
    }

    setupActions(contentEl) {
        const btnExport = contentEl.querySelector('#btn-export');
        const btnClear = contentEl.querySelector('#btn-clear');
        const btnPause = contentEl.querySelector('#btn-pause');

        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportStats());
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearEvents());
        }

        if (btnPause) {
            btnPause.addEventListener('click', () => this.togglePause());
        }
    }

    startMonitoring() {
        this.refreshInterval = setInterval(() => {
            this.updateAllComponents();
        }, 1000);
    }

    updateAllComponents() {
        Object.values(this.components).forEach(component => {
            if (component && component.update && typeof component.update === 'function') {
                try {
                    component.update();
                } catch (error) {
                    console.error('Error updating component:', error);
                }
            }
        });
    }

    exportStats() {
        const stats = this.dataCollector.getSystemStats();
        const data = JSON.stringify(stats, null, 2);

        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webdesk-stats-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('Stats exported');
    }

    clearEvents() {
        if (this.components.eventLog && this.components.eventLog.clear) {
            this.components.eventLog.clear();
        }
        console.log('Events cleared');
    }

    togglePause() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('Monitoring paused');
        } else {
            this.startMonitoring();
            console.log('Monitoring resumed');
        }
    }

    async close() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        Object.values(this.components).forEach(component => {
            if (component && component.destroy && typeof component.destroy === 'function') {
                try {
                    component.destroy();
                } catch (error) {
                    console.error('Error destroying component:', error);
                }
            }
        });

        if (this.eventBus) {
            this.eventBus.emit('app:closed', {
                appId: this.manifest.id
            });
        }

        console.log('ProcessMonitor closed');
    }
}