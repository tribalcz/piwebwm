/**
 * pub/sub system
 */
export class EventBus {
    constructor() {
        this.events = new Map();
        this.eventLog =[];
        this.maxLogSize = 100;

        console.log('EventBus initialized');
    }

    /**
     * Subscribe to an event
     * @param {string} event
     * @param {function} callback
     * @param {Object} context
     * @return {function}
     */
    on(event, callback, context = null) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener = { callback, context,  once: false };
        this.events.get(event).push(listener);

        return () => this.off(event, callback);
    }

    /**
     * Subsrcibe to an event once
     * @param {string} event
     * @param {string} callback
     * @param {Object} context
     * @return {Function}
     */
    once(event, callback, context = null) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener = { callback, context, once: true };
        this.events.get(event).push(listener);

        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback = null) {
        if (!this.events.has(event)) return;

        if (callback === null) {
            this.events.delete(event);
            return;
        }

        const listeners = this.events.get(event);
        const filtered = listeners.filter(l => l.callback !== callback);

        if (filtered.length  === 0) {
            this.events.delete(event);
        } else {
            this.events.set(event, filtered);
        }
    }

    /**
     * Emit an evet
     * @param {string} event
     * @param {*} data
     */
    emit(event, data = null) {
        this.logEvent(event, data);

        const listeners = this.events.get(event) || [];

        const wildcardListeners = this.getWildcardListeners(event);

        const allListeners = [...listeners, ...wildcardListeners];

        if (allListeners.length === 0) return;

        const listenersToRemove = [];

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
     * @param {string} event
     * @param {*} data
     * @return {Promise}
     */
    async emitAsync(event, data = null) {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.emit(event, data);
                resolve();
            }, 0);
        });
    }

    /**
     * Get wildcard listeners for an event
     * @param {string} event
     * @return {Array}
     * @private
     */
    getWildcardListeners(event) {
        const listeners = [];

        this.events.forEach((eventListeners, pattern) => {
            if (this.matchesWildcard(event, pattern)) {
                listeners.push(...eventListeners);
            }
        });

        return listeners;
    }

    /**
     * Check if an event matches a wildcard pattern
     * @param {string} event
     * @param {string} pattern
     * @return {boolean}
     * @private
     */
    matchesWildcard(event, pattern) {
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
     * @param {string} pattern
     */
    clear(pattern = null) {
        if (pattern === null) {
            this.events.clear();
            console.log('EventBus cleared all listeners');
            return;
        }

        const toDelete = [];
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
     * @param {string} event
     * @return {Array}
     */
    getListeners(event) {
        return this.events.get(event) || [];
    }

    /**
     * Check if event has listeners
     * @param {string} event
     * @return {boolean}
     */
    hasListeners(event) {
        return this.events.has(event);
    }

    /**
     * Get all registered events
     * @return {Array}
     */
    getEvents() {
        return Array.from(this.events.keys());
    }

    /**
     * Log event for debuging
     * @param {string} event
     * @param {*} data
     */
    logEvent(event, data) {
        const logEntry = {
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
     * @param {number}
     * @return {Array}
     */
    getLog(limit = 50) {
        return this.eventLog.slice(-limit);
    }

    /**
     * Get statistic
     * @return {Object}
     */
    getStats() {
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

    debug() {
        console.log('===EventBus debug info: ===');
        console.log('Stats:', this.getStats());
        console.log('Events:', this.getEvents());
        console.log('Recent log:', this.getLog(10));

        this.events.forEach((listeners, event) => {
            console.log(`  ${event}: ${listeners.length} listener(s)`);
        });
    }
}