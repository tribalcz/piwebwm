/**
 * AppList Component
 * Displays running applications with status and uptime
 */

import { Formatter } from '../utils/Formatter.js';
import {getIcon} from "@utils/Icons.js";

export class AppList {
    constructor(container, dataCollector) {
        this.container = container;
        this.dataCollector = dataCollector;

        this.render();
        console.log('AppList component initialized');
    }

    render() {
        this.container.innerHTML = `
            <div class="app-list-panel" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="padding: 12px 16px; background: #f9f9f9; border-bottom: 1px solid #e0e0e0;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
                        ${getIcon('appStats', 20)} Running Applications
                    </h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #fafafa; border-bottom: 1px solid #e0e0e0;">
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #666;">App ID</th>
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #666;">Name</th>
                                <th style="padding: 8px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #666;">Status</th>
                                <th style="padding: 8px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #666;">Uptime</th>
                            </tr>
                        </thead>
                        <tbody id="app-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        this.tbody = this.container.querySelector('#app-tbody');
    }

    update() {
        const apps = this.dataCollector.getRunningApps();

        if (apps.length === 0) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 24px; text-align: center; color: #999; font-size: 13px;">
                        No applications running
                    </td>
                </tr>
            `;
            return;
        }

        this.tbody.innerHTML = apps.map(app => `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 16px; font-size: 12px; font-family: monospace; color: #666;">
                    ${Formatter.escapeHtml(app.id)}
                </td>
                <td style="padding: 10px 16px; font-size: 13px; color: #333;">
                    ${Formatter.escapeHtml(app.name)}
                </td>
                <td style="padding: 10px 16px; text-align: center;">
                    <span style="display: inline-block; padding: 2px 8px; background: #22c55e; color: white; border-radius: 4px; font-size: 11px; font-weight: 500;">
                        ${Formatter.escapeHtml(app.status)}
                    </span>
                </td>
                <td style="padding: 10px 16px; text-align: right; font-size: 12px; font-family: monospace; color: #666;">
                    ${Formatter.uptime(app.startTime)}
                </td>
            </tr>
        `).join('');
    }

    destroy() {
        console.log('AppList component destroyed');
    }
}