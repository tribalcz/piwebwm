/**
 * AppList Component
 * Displays running applications with status and uptime
 */

import { Formatter } from '../utils/Formatter';
import { getIcon } from '@utils/Icons';
import type { DataCollector } from '../utils/DataCollector';

export class AppList {
    private container: Element;
    private dataCollector: DataCollector;
    private tbody: Element | null = null;

    constructor(container: Element, dataCollector: DataCollector) {
        this.container = container;
        this.dataCollector = dataCollector;

        this.render();
        console.log('AppList component initialized');
    }

    private render(): void {
        this.container.innerHTML = `
            <div class="app-list-panel" style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                <div style="padding: 12px 16px; background: var(--surface-alt); border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text);">
                        ${getIcon('appStats', 20)} Running Applications
                    </h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--surface-alt); border-bottom: 1px solid var(--border);">
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted);">App ID</th>
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted);">Name</th>
                                <th style="padding: 8px 16px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text-muted);">Status</th>
                                <th style="padding: 8px 16px; text-align: right; font-size: 12px; font-weight: 600; color: var(--text-muted);">Uptime</th>
                            </tr>
                        </thead>
                        <tbody id="app-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        this.tbody = this.container.querySelector('#app-tbody');
    }

    update(): void {
        if (!this.tbody) return;

        const apps = this.dataCollector.getRunningApps();

        if (apps.length === 0) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 24px; text-align: center; color: var(--text-faint); font-size: 13px;">
                        No applications running
                    </td>
                </tr>
            `;
            return;
        }

        this.tbody.innerHTML = apps.map(app => `
            <tr style="border-bottom: 1px solid var(--border-soft);">
                <td style="padding: 10px 16px; font-size: 12px; font-family: monospace; color: var(--text-muted);">
                    ${Formatter.escapeHtml(app.id)}
                </td>
                <td style="padding: 10px 16px; font-size: 13px; color: var(--text);">
                    ${Formatter.escapeHtml(app.name)}
                </td>
                <td style="padding: 10px 16px; text-align: center;">
                    <span style="display: inline-block; padding: 2px 8px; background: #22c55e; color: white; border-radius: 4px; font-size: 11px; font-weight: 500;">
                        ${Formatter.escapeHtml(app.status)}
                    </span>
                </td>
                <td style="padding: 10px 16px; text-align: right; font-size: 12px; font-family: monospace; color: var(--text-muted);">
                    ${Formatter.uptime(app.startTime)}
                </td>
            </tr>
        `).join('');
    }

    destroy(): void {
        console.log('AppList component destroyed');
    }
}
