/**
 * WindowList Component
 * Displays active windows with state and z-index
 */

import { Formatter } from '../utils/Formatter';
import { getIcon } from '@utils/Icons';
import type { DataCollector } from '../utils/DataCollector';

export class WindowList {
    private container: Element;
    private dataCollector: DataCollector;
    private tbody: Element | null = null;

    constructor(container: Element, dataCollector: DataCollector) {
        this.container = container;
        this.dataCollector = dataCollector;

        this.render();
        console.log('WindowList component initialized');
    }

    private render(): void {
        this.container.innerHTML = `
            <div class="window-list-panel" style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                <div style="padding: 12px 16px; background: var(--surface-alt); border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text);">
                        ${getIcon('windowsStats', 20)} Active Windows
                    </h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--surface-alt); border-bottom: 1px solid var(--border);">
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted);">ID</th>
                                <th style="padding: 8px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted);">Title</th>
                                <th style="padding: 8px 16px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text-muted);">State</th>
                                <th style="padding: 8px 16px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text-muted);">Z-Index</th>
                            </tr>
                        </thead>
                        <tbody id="window-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        this.tbody = this.container.querySelector('#window-tbody');
    }

    update(): void {
        if (!this.tbody) return;

        const windows = this.dataCollector.getActiveWindows();

        if (windows.length === 0) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 24px; text-align: center; color: var(--text-faint); font-size: 13px;">
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
                <tr style="border-bottom: 1px solid var(--border-soft);">
                    <td style="padding: 10px 16px; font-size: 11px; font-family: monospace; color: var(--text-faint);">
                        ${Formatter.truncate(win.id, 12)}
                    </td>
                    <td style="padding: 10px 16px; font-size: 13px; color: var(--text);">
                        ${Formatter.escapeHtml(win.title)}
                        ${win.persistent ? '<span style="color: var(--text-muted); font-size: 10px;">📌</span>' : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; background: ${stateBg}; color: ${stateColor}; border-radius: 4px; font-size: 11px; font-weight: 500;">
                            ${win.state}
                        </span>
                    </td>
                    <td style="padding: 10px 16px; text-align: center; font-size: 12px; font-family: monospace; color: var(--text-muted);">
                        ${win.zIndex}
                    </td>
                </tr>
            `;
        }).join('');
    }

    private getStateColor(state: string): string {
        switch (state) {
            case 'normal': return '#22c55e';
            case 'minimized': return '#666';
            case 'maximized': return '#3b82f6';
            default: return '#666';
        }
    }

    private getStateBg(state: string): string {
        switch (state) {
            case 'normal': return '#dcfce7';
            case 'minimized': return '#f3f4f6';
            case 'maximized': return '#dbeafe';
            default: return '#f3f4f6';
        }
    }

    destroy(): void {
        console.log('WindowList component destroyed');
    }
}
