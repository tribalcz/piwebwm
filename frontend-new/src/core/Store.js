/**
 * Centralized state manager
 */

export class Store {
    constructor() {
        this.state = {};
        this.subscribers = new Map();
        this.storageKey = 'webdesk-store';
        this.autoPersist = false;
        this.persistTimeout = null;

        console.log('Store initialized');
    }

    /**
     * Set value in the store
     * @param {string} key
     * @param {*}value
     */
    set(key, value) {
        const oldValue = this.get(key);

        if (key.includes('.')) {
            this.setNested(key, value);
        } else {
            this.state[key] = value;
        }

        this.notify(key, value, oldValue);

        if (this.autoPersist) {
            this.debouncedPersist();
        }
    }

    /**
     * Get a value from the store
     * @param {string} key
     * @param {*} defaultValue
     * @return {*}
     */
    get(key, defaultValue = null) {
        if (key.includes('.')) {
            return this.getNested(key, defaultValue);
        }

        return this.state.hasOwnProperty(key) ? this.state[key] : defaultValue;
    }

    /**
     * chack if key exists
     * @param {string} key
     * @return {boolean}
     */
    has(key) {
        if (key.includes('.')) {
            return this.getNested(key, undefined) !== undefined;
        }

        return this.state.hasOwnProperty(key);
    }

    /**
     * Delete a key
     * @param {string} key
     */
    delete(key) {
        const oldValue = this.get(key);

        if (key.includes('.')) {
            this.deleteNested(key);
        } else {
            delete this.state[key];
        }

        this.notify(key, undefined, oldValue);

        if (this.autoPersist) {
            this.debouncedPersist();
        }
    }

    /**
     * Clear all state
     */
    clear() {
        const oldState = { ...this.state };
        this.state = {};

        Object.keys(oldState).forEach(key => {
            this.notify(key, undefined, oldState[key]);
        });

        if (this.autoPersist) {
            this.persist();
        }

        console.log('Store cleared');
    }

    /**
     * Subscribe to a key change
     * @param {string} key
     * @param {Function} callback
     * @return {Function}
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }

        this.subscribers.get(key).push(callback);

        return () => this.unsubscribe(key, callback);
    }

    /**
     * Unsubscribe from a key change
     * @param {string} key
     * @param {Function} callback
     */
    unsubscribe(key, callback = null) {
        if (!this.subscribers.has(key)) return;

        if (callback === null) {
            this.subscribers.delete(key);
            return;
        }

        const callbacks = this.subscribers.get(key);
        const filtered = callbacks.filter(cb => cb !== callback);

        if (filtered.length === 0) {
            this.subscribers.delete(key);
        } else {
            this.subscribers.set(key, filtered);
        }
    }

    /**
     * Notify osubsriber of a change
     * @param {string} key
     * @param {*} newValue
     * @param {*} oldValue
     * @private
     */
    notify(key, newValue, oldValue) {
        if (newValue === oldValue) return;

        const callbacks = this.subscribers.get(key) || [];
        callbacks.forEach(callback => {
            try {
                callback(newValue, oldValue);
            } catch (error) {
                console.error(`Store subscriber error for '${key}':`, error);
            }
        });

        const wildcardCallback = this.subscribers.get('*') || [];
        wildcardCallback.forEach(callback => {
            try {
                callback(newValue, oldValue, key);
            } catch (error) {
                console.error(`Store wildcard subscriber error for '${key}':`, error);
            }
        });

        if (key.includes('.')) {
            const parts = key.split('.');
            for (let i = parts.length - 1; i > 0; i--) {
                const parentKey = parts.slice(0, i).join('.');
                const parentCallbacks = this.subscribers.get(parentKey) || [];

                parentCallbacks.forEach(callback => {
                    try {
                        callback(this.get(parentKey), undefined);
                    } catch (error) {
                        console.error(`Store parent subscriber error for '${parentKey}':`, error);
                    }
                });
            }
        }
    }

    /**
     * Set nested value using dot notation
     * @param {string} key
     * @param {*} value
     * @private
     */
    setNested(key, value) {
        const parts = key.split('.');
        let current = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];

            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }

            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }

    /**
     * Get nested value using dot notation
     * @param {string} key
     * @param {*} defaultValue
     * @return {*}
     * @private
     */
    getNested(key, defaultValue = null) {
        const parts = key.split('.');
        let current = this.state;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Delete nested kez
     * @param {string} key
     * @private
     */
    deleteNested(key) {
        const parts = key.split('.');
        let current = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];

            if (!current[part] || typeof current[part] !== 'object') {
                return;
            }

            current = current[part];
        }

        delete current[parts[parts.length - 1]];
    }

    /**
     * Get all states
     * @return {Object}
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Set multiple values at once
     * @param {Object} values - Object with key-value pairs
     */
    setMultiple(values) {
        Object.entries(values).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    /**
     * Persist state to local storage
     */
    persist() {
        try {
            const serialized = JSON.stringify({
                state: this.state,
                timestamp: Date.now()
            });

            localStorage.setItem(this.storageKey, serialized);
            console.log('Store persisted to localStorage');
        } catch (error) {
            console.error('Failed to persist store:', error);
        }
    }

    /**
     * Restore state from local storage
     */
    restore() {
        try {
            const serialized = localStorage.getItem(this.storageKey);

            if (!serialized) {
                console.log('No persisted state found in localStorage');
                return false;
            }

            const { state, timestamp } = JSON.parse(serialized);

            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            if (Date.now() - timestamp > maxAge) {
                console.warn('Stored data is too old, ignoring...');
                localStorage.removeItem(this.storageKey);
                return false;
            }

            this.state = state;
            console.log('Store restored from localStorage');

            return true;
        } catch (error) {
            console.error('Failed to restore store:', error);
            localStorage.removeItem(this.storageKey);
            return false;
        }
    }

    /**
     * Enable ayto persistance
     * @paramn {Object} options
     */
    enableAutoPersist(options = {}) {
        this.autoPersist = true;
        this.persistDebounce = options.debounce || 500;

        console.log(`Auto-persist enabled (debounce: ${this.persistDebounce}ms)`);
    }

    /**
     * Disable auto-persist
     */
    disableAutoPersist() {
        this.autoPersist = false;

        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
            this.persistTimeout = null;
        }

        console.log('Auto-persist disabled');
    }

    /**
     * Debounced persist (waits for inactivity before saving)
     * @private
     */
    debouncedPersist() {
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }

        this.persistTimeout = setTimeout(() => {
            this.persist();
        }, this.persistDebounce || 500);
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        const countKeys = (obj) => {
            let count = 0;
            for (const key in obj) {
                count++;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    count += countKeys(obj[key]);
                }
            }
            return count;
        };

        return {
            keys: Object.keys(this.state).length,
            totalKeys: countKeys(this.state),
            subscribers: this.subscribers.size,
            autoPersist: this.autoPersist
        };
    }

    /**
     * Debug: Print current state and subscribers
     */
    debug() {
        console.log('=== Store Debug ===');
        console.log('Stats:', this.getStats());
        console.log('State:', this.getAll());
        console.log('Subscribers:', Array.from(this.subscribers.keys()));
    }
}