/**
 * WindowList Component
 * Displays active windows with state and z-index
 */

import { Formatter } from '../utils/Formatter.js';
import {getIcon} from "@utils/Icons.js";

export class WindowList {
    constructor(container, dataCollector) {
        this.container = container;
        this.dataCollector = dataCollector;

        this.render();
        console.log('WindowList component initialized');
    }

    render() {
        this.container.innerHTML = `
            <div class="window-list-panel" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="padding: 12px 16px; background: #f9f9f9; border-bottom: 1px solid #e0e0e0;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
                        ${getIcon('windowsStats', 20)} Active Windows
                    </h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #fafafa; border-bottom: 1px solid #e0e0e0;">
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #666;">ID</th>
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #666;">Title</th>
                                <th style="padding: 8px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #666;">State</th>
                                <th style="padding: 8px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #666;">Z-Index</th>
                            </tr>
                        </thead>
                        <tbody id="window-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        this.tbody = this.container.querySelector('#window-tbody');
    }

    update() {
        const windows = this.dataCollector.getActiveWindows();

        if (windows.length === 0) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 24px; text-align: center; color: #999; font-size: 13px;">
                        No active windows
                    </td>
                </tr>
            `;
            return;
        }

        this.tbody.innerHTML = windows.map(win => {
            const stateColor = this.getStateColor(win.state);
            const stateBg = this.getStateBg(win.state);

            return `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 10px 16px; font-size: 11px; font-family: monospace; color: #999;">
                        ${Formatter.truncate(win.id, 12)}
                    </td>
                    <td style="padding: 10px 16px; font-size: 13px; color: #333;">
                        ${Formatter.escapeHtml(win.title)}
                        ${win.persistent ? '<span style="color: #666; font-size: 10px;">📌</span>' : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; background: ${stateBg}; color: ${stateColor}; border-radius: 4px; font-size: 11px; font-weight: 500;">
                            ${win.state}
                        </span>
                    </td>
                    <td style="padding: 10px 16px; text-align: center; font-size: 12px; font-family: monospace; color: #666;">
                        ${win.zIndex}
                    </td>
                </tr>
            `;
        }).join('');
    }

    getStateColor(state) {
        switch(state) {
            case 'normal': return '#22c55e';
            case 'minimized': return '#666';
            case 'maximized': return '#3b82f6';
            default: return '#666';
        }
    }

    getStateBg(state) {
        switch(state) {
            case 'normal': return '#dcfce7';
            case 'minimized': return '#f3f4f6';
            case 'maximized': return '#dbeafe';
            default: return '#f3f4f6';
        }
    }

    destroy() {
        console.log('WindowList component destroyed');
    }
}