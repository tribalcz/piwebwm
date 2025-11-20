/**
 * EventLog Component
 * Displays live event stream with filtering and auto-scroll
 */

import {Formatter} from "@apps/process-monitor/utils/Formatter.js";
import {getIcon} from "@utils/Icons.js";

export class EventLog {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.events = [];
        this.maxEvents = 50;
        this.paused = false;

        this.render();

        this.setupEventListener = this.setupEventListener.bind(this);
        this.setupEventListener();

        console.log('EventLog component initialized');
    }

    render() {
        this.container.innerHTML = `
            <div class="event-log-panel" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; height: 100%; display: flex; flex-direction: column;">
                <div style="padding: 12px 16px; background: #f9f9f9; border-bottom: 1px solid #e0e0e0; flex-shrink: 0;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
                        ${getIcon('eventStats', 20)} Recent Events (live)
                    </h3>
                </div>
                <div id="event-list" style="flex: 1; overflow-y: auto; padding: 8px;"></div>
            </div>
        `;

        this.eventList = this.container.querySelector('#event-list');
    }

    setupEventListener() {


        if (!this.eventBus) {
            console.warn('EventBus not available for EventLog');
            return;
        }


        if (typeof this.eventBus.on !== 'function') {;
            this.eventBus = window.webdesk?.eventBus || null;

            if (!this.eventBus || typeof this.eventBus.on !== 'function') {
                console.error('Fallback failed too!');
                return;
            }
            console.log('Fallback successful!');
        }

        this.unsubscribe = this.eventBus.on('*', (data) => {
            this.addEventFromLog();
        });

        this.pollInterval = setInterval(() => {
            this.updateFromLog();
        }, 1000);
    }

    updateFromLog() {
        if (this.paused) return;

        const recentEvents = this.eventBus.getLog ? this.eventBus.getLog(this.maxEvents) : [];

        if (recentEvents.length > 0) {
            this.events = recentEvents;
            this.renderEvents();
        }
    }

    addEventFromLog() {
        this.updateFromLog();
    }

    renderEvents() {
        if (this.events.length === 0) {
            this.eventList.innerHTML = `
                <div style="padding: 24px; text-align: center; color: #999; font-size: 13px;">
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
                <div class="event-item" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid #f5f5f5; font-size: 12px;">
                    <span style="font-size: 14px;">${icon}</span>
                    <span style="flex: 1; font-family: monospace; color: ${color}; font-weight: 500;">
                        ${Formatter.escapeHtml(e.event)}
                    </span>
                    <span style="color: #999; font-size: 11px; white-space: nowrap;">
                        ${Formatter.timeAgo(e.timestamp)}
                    </span>
                </div>
            `;
        }).join('');

        this.eventList.scrollTop = 0; // Scroll to top when new events are added
    }

    getEventIcon(eventName) {
        if (eventName.startsWith('window:')) return getIcon('windowsStats', 16);
        if (eventName.startsWith('app:')) return getIcon('appStats', 16);
        if (eventName.startsWith('store:')) return getIcon('storeStats', 16);
        if (eventName.includes('error')) return '❌';
        return '📡';
    }

    getEventColor(eventName) {
        if (eventName.includes('error')) return '#ef4444';
        if (eventName.includes('closed') || eventName.includes('closing')) return '#f59e0b';
        if (eventName.includes('created') || eventName.includes('launched')) return '#22c55e';
        return '#3b82f6';
    }

    clear() {
        this.events = [];
        this.renderEvents();
        console.log('Event log cleared');
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        console.log('EventLog component destroyed');
    }
}