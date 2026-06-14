import type { EventName, EventPayload } from '@core/types';

type EventCallback = (data: any) => void;

interface Listener {
    callback: EventCallback;
    context: object | null;
    once: boolean;
}

export interface EventLogEntry {
    event: string;
    data: unknown;
    timestamp: number;
    listeners: number;
}

export interface EventBusStats {
    events: number;
    totalListeners: number;
    logSize: number;
}

/**
 * pub/sub system
 */
export class EventBus {
    private events: Map<string, Listener[]>;
    private eventLog: EventLogEntry[];
    private maxLogSize: number;

    constructor() {
        this.events = new Map();
        this.eventLog = [];
        this.maxLogSize = 100;

        console.log('EventBus initialized');
    }

    /**
     * Subscribe to an event
     */
    on<E extends EventName>(
        event: E,
        callback: (data: EventPayload<E>) => void,
        context: object | null = null
    ): () => void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener: Listener = { callback, context, once: false };
        this.events.get(event)!.push(listener);

        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once
     */
    once<E extends EventName>(
        event: E,
        callback: (data: EventPayload<E>) => void,
        context: object | null = null
    ): () => void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener: Listener = { callback, context, once: true };
        this.events.get(event)!.push(listener);

        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, callback: EventCallback | null = null): void {
        if (!this.events.has(event)) return;

        if (callback === null) {
            this.events.delete(event);
            return;
        }

        const listeners = this.events.get(event)!;
        const filtered = listeners.filter(l => l.callback !== callback);

        if (filtered.length === 0) {
            this.events.delete(event);
        } else {
            this.events.set(event, filtered);
        }
    }

    /**
     * Emit an event
     */
    emit<E extends EventName>(event: E, data: EventPayload<E> | null = null): void {
        this.logEvent(event, data);

        const listeners = this.events.get(event) || [];

        const wildcardListeners = this.getWildcardListeners(event);

        const allListeners = [...listeners, ...wildcardListeners];

        if (allListeners.length === 0) return;

        const listenersToRemove: Listener[] = [];

        allListeners.forEach(listener => {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, data);
                } else {
                    listener.callback(data);
                }

                if (listener.once) {
                    listenersToRemove.push(listener);
                }
            } catch (error) {
                console.error(`EventBus error in listener for '${event}':`, error);
                this.emit('error', { event, error, data });
            }
        });

        listenersToRemove.forEach(listener => {
            this.off(event, listener.callback);
        });
    }

    /**
     * Emit an event asynchronously
     */
    async emitAsync<E extends EventName>(event: E, data: EventPayload<E> | null = null): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.emit(event, data);
                resolve();
            }, 0);
        });
    }

    /**
     * Get wildcard listeners for an event
     */
    private getWildcardListeners(event: string): Listener[] {
        const listeners: Listener[] = [];

        this.events.forEach((eventListeners, pattern) => {
            if (this.matchesWildcard(event, pattern)) {
                listeners.push(...eventListeners);
            }
        });

        return listeners;
    }

    /**
     * Check if an event matches a wildcard pattern
     */
    private matchesWildcard(event: string, pattern: string): boolean {
        if (pattern === '*') return true;

        if (!pattern.includes('*')) return false;

        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/:/g, '\\:');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(event);
    }

    /**
     * Clear all listeners for event
     */
    clear(pattern: string | null = null): void {
        if (pattern === null) {
            this.events.clear();
            console.log('EventBus cleared all listeners');
            return;
        }

        const toDelete: string[] = [];
        this.events.forEach((_, event) => {
            if (this.matchesWildcard(event, pattern) || event === pattern) {
                toDelete.push(event);
            }
        });

        toDelete.forEach(event => this.events.delete(event));
        console.log(`EventBus cleared listeners for pattern: ${pattern}`);
    }

    /**
     * Get all listeners for an event
     */
    getListeners(event: string): Listener[] {
        return this.events.get(event) || [];
    }

    /**
     * Check if event has listeners
     */
    hasListeners(event: string): boolean {
        return this.events.has(event);
    }

    /**
     * Get all registered events
     */
    getEvents(): string[] {
        return Array.from(this.events.keys());
    }

    /**
     * Log event for debugging
     */
    private logEvent(event: string, data: unknown): void {
        const logEntry: EventLogEntry = {
            event,
            data,
            timestamp: Date.now(),
            listeners: this.getListeners(event).length
        };

        this.eventLog.push(logEntry);

        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
    }

    /**
     * Get event log for debugging
     */
    getLog(limit: number = 50): EventLogEntry[] {
        return this.eventLog.slice(-limit);
    }

    /**
     * Get statistic
     */
    getStats(): EventBusStats {
        let totalListeners = 0;
        this.events.forEach(listeners => {
            totalListeners += listeners.length;
        });

        return {
            events: this.events.size,
            totalListeners: totalListeners,
            logSize: this.eventLog.length,
        };
    }

    debug(): void {
        console.log('===EventBus debug info: ===');
        console.log('Stats:', this.getStats());
        console.log('Events:', this.getEvents());
        console.log('Recent log:', this.getLog(10));

        this.events.forEach((listeners, event) => {
            console.log(`  ${event}: ${listeners.length} listener(s)`);
        });
    }
}
