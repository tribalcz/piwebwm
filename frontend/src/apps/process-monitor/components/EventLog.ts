/**
 * EventLog Component
 * Displays live event stream with filtering and auto-scroll
 */

import { Formatter } from '../utils/Formatter';
import { getIcon } from '@utils/Icons';
import type { EventBus, EventLogEntry } from '@core/EventBus';

export class EventLog {
    private container: Element;
    private eventBus: EventBus | null;
    private events: EventLogEntry[];
    private maxEvents: number;
    private paused: boolean;
    private eventList: HTMLElement | null = null;
    private unsubscribe: (() => void) | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;

    constructor(container: Element, eventBus: EventBus | null) {
        this.container = container;
        this.eventBus = eventBus;
        this.events = [];
        this.maxEvents = 50;
        this.paused = false;

        this.render();
        this.setupEventListener();

        console.log('EventLog component initialized');
    }

    private render(): void {
        this.container.innerHTML = `
            <div class="event-log-panel" style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; height: 100%; display: flex; flex-direction: column;">
                <div style="padding: 12px 16px; background: var(--surface-alt); border-bottom: 1px solid var(--border); flex-shrink: 0;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text);">
                        ${getIcon('eventStats', 20)} Recent Events (live)
                    </h3>
                </div>
                <div id="event-list" style="flex: 1; overflow-y: auto; padding: 8px;"></div>
            </div>
        `;

        this.eventList = this.container.querySelector<HTMLElement>('#event-list');
    }

    private setupEventListener(): void {
        if (!this.eventBus) {
            console.warn('EventBus not available for EventLog, trying fallback');
            this.eventBus = window.webdesk?.eventBus || null;

            if (!this.eventBus) {
                console.error('Fallback failed too!');
                return;
            }
            console.log('Fallback successful!');
        }

        this.unsubscribe = this.eventBus.on('*', () => {
            this.addEventFromLog();
        });

        this.pollInterval = setInterval(() => {
            this.updateFromLog();
        }, 1000);
    }

    private updateFromLog(): void {
        if (this.paused) return;
        if (!this.eventBus) return;

        const recentEvents = this.eventBus.getLog(this.maxEvents);

        if (recentEvents.length > 0) {
            this.events = recentEvents;
            this.renderEvents();
        }
    }

    private addEventFromLog(): void {
        this.updateFromLog();
    }

    private renderEvents(): void {
        if (!this.eventList) return;

        if (this.events.length === 0) {
            this.eventList.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--text-faint); font-size: 13px;">
                    No events yet...
                </div>
            `;
            return;
        }

        const reversedEvents = this.events.slice().reverse();

        this.eventList.innerHTML = reversedEvents.map(e => {
            const icon = this.getEventIcon(e.event);
            const color = this.getEventColor(e.event);

            return `
                <div class="event-item" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--surface-hover); font-size: 12px;">
                    <span style="font-size: 14px;">${icon}</span>
                    <span style="flex: 1; font-family: monospace; color: ${color}; font-weight: 500;">
                        ${Formatter.escapeHtml(e.event)}
                    </span>
                    <span style="color: var(--text-faint); font-size: 11px; white-space: nowrap;">
                        ${Formatter.timeAgo(e.timestamp)}
                    </span>
                </div>
            `;
        }).join('');

        this.eventList.scrollTop = 0; // Scroll to top when new events are added
    }

    private getEventIcon(eventName: string): string {
        if (eventName.startsWith('window:')) return getIcon('windowsStats', 16);
        if (eventName.startsWith('app:')) return getIcon('appStats', 16);
        if (eventName.startsWith('store:')) return getIcon('storeStats', 16);
        if (eventName.includes('error')) return '❌';
        return '📡';
    }

    private getEventColor(eventName: string): string {
        if (eventName.includes('error')) return '#ef4444';
        if (eventName.includes('closed') || eventName.includes('closing')) return '#f59e0b';
        if (eventName.includes('created') || eventName.includes('launched')) return '#22c55e';
        return '#3b82f6';
    }

    clear(): void {
        this.events = [];
        this.renderEvents();
        console.log('Event log cleared');
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        console.log('EventLog component destroyed');
    }
}
