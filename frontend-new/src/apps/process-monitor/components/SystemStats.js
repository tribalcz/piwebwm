/**
 * SystemStats Component
 * Displays system-wide statistics in a grid layout
 */

import { Formatter } from '../utils/Formatter.js';
import {getIcon} from "@utils/Icons.js";

export class SystemStats {
    constructor(container, dataCollector) {
        this.container = container;
        this.dataCollector = dataCollector;

        this.render();
        console.log('SystemStats component initialized');
    }

    render() {
        this.container.innerHTML = `
            <div class="stats-panel" style="background: #f9f9f9; padding: 16px; border-radius: 8px; border: 1px solid #e0e0e0;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">
                    ${getIcon('processMonitor', 20)} System Stats
                </h3>
                <div class="stats-grid" id="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;"></div>
            </div>
        `;

        this.statsGrid = this.container.querySelector('#stats-grid');
    }

    update() {
        const stats = this.dataCollector.getSystemStats();

        this.statsGrid.innerHTML = `
            <div class="stat-item" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 18px;">${getIcon('windowsStats', 20)}</span>
                    <span style="font-size: 12px; color: #666;">Windows</span>
                </div>
                <div style="font-size: 24px; font-weight: 600; color: #333;">
                    ${stats?.windows?.total || 0}
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">
                    ${stats?.windows?.minimized || 0} min, ${stats?.windows?.maximized || 0} max
                </div>
            </div>
                
            <div class="stat-item" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 18px;">${getIcon('appStats', 20)}</span>
                    <span style="font-size: 12px; color: #666;">Apps</span>
                </div>
                <div style="font-size: 24px; font-weight: 600; color: #333;">
                    ${stats.apps.running || 0}
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">
                    ${stats.apps.registered || 0} registered
                </div>
            </div>
            
            <div class="stat-item" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 18px;">${getIcon('eventStats', 20)}</span>
                    <span style="font-size: 12px; color: #666;">Events</span>
                </div>
                <div style="font-size: 24px; font-weight: 600; color: #333;">
                    ${Formatter.number(stats.events.totalListeners || 0)}
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">
                    ${stats.events.events || 0} types
                </div>
            </div>
            
            <div class="stat-item" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 18px;">${getIcon('storeStats', 20)}</span>
                    <span style="font-size: 12px; color: #666;">Store</span>
                </div>
                <div style="font-size: 24px; font-weight: 600; color: #333;">
                    ${stats.store.keys || 0}
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">
                    ${stats.store.subscribers || 0} subscribers
                </div>
            </div>
        `;
    }

    destroy() {
        console.log('SystemStats component destroyed');
    }
}