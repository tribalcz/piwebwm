type StoreState = Record<string, unknown>;

type StoreCallback = (newValue: unknown, oldValue: unknown, key?: string) => void;

export interface StoreStats {
    keys: number;
    totalKeys: number;
    subscribers: number;
    autoPersist: boolean;
}

/**
 * Centralized state manager
 */
export class Store {
    private state: StoreState;
    private subscribers: Map<string, StoreCallback[]>;
    private storageKey: string;
    private autoPersist: boolean;
    private persistTimeout: ReturnType<typeof setTimeout> | null;
    private persistDebounce: number;

    constructor() {
        this.state = {};
        this.subscribers = new Map();
        this.storageKey = 'webdesk-store';
        this.autoPersist = false;
        this.persistTimeout = null;
        this.persistDebounce = 500;

        console.log('Store initialized');
    }

    /**
     * Set value in the store
     */
    set(key: string, value: unknown): void {
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
     */
    get<T = unknown>(key: string): T | null;
    get<T>(key: string, defaultValue: T): T;
    get(key: string, defaultValue: unknown = null): unknown {
        if (key.includes('.')) {
            return this.getNested(key, defaultValue);
        }

        return Object.prototype.hasOwnProperty.call(this.state, key)
            ? this.state[key]
            : defaultValue;
    }

    /**
     * Check if key exists
     */
    has(key: string): boolean {
        if (key.includes('.')) {
            return this.getNested(key, undefined) !== undefined;
        }

        return Object.prototype.hasOwnProperty.call(this.state, key);
    }

    /**
     * Delete a key
     */
    delete(key: string): void {
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
    clear(): void {
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
     */
    subscribe(key: string, callback: StoreCallback): () => void {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }

        this.subscribers.get(key)!.push(callback);

        return () => this.unsubscribe(key, callback);
    }

    /**
     * Unsubscribe from a key change
     */
    unsubscribe(key: string, callback: StoreCallback | null = null): void {
        if (!this.subscribers.has(key)) return;

        if (callback === null) {
            this.subscribers.delete(key);
            return;
        }

        const callbacks = this.subscribers.get(key)!;
        const filtered = callbacks.filter(cb => cb !== callback);

        if (filtered.length === 0) {
            this.subscribers.delete(key);
        } else {
            this.subscribers.set(key, filtered);
        }
    }

    /**
     * Notify subscribers of a change
     */
    private notify(key: string, newValue: unknown, oldValue: unknown): void {
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
     */
    private setNested(key: string, value: unknown): void {
        const parts = key.split('.');
        let current: Record<string, unknown> = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];

            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }

            current = current[part] as Record<string, unknown>;
        }

        current[parts[parts.length - 1]] = value;
    }

    /**
     * Get nested value using dot notation
     */
    private getNested(key: string, defaultValue: unknown = null): unknown {
        const parts = key.split('.');
        let current: unknown = this.state;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Delete nested key
     */
    private deleteNested(key: string): void {
        const parts = key.split('.');
        let current: Record<string, unknown> = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];

            if (!current[part] || typeof current[part] !== 'object') {
                return;
            }

            current = current[part] as Record<string, unknown>;
        }

        delete current[parts[parts.length - 1]];
    }

    /**
     * Get all states
     */
    getAll(): StoreState {
        return JSON.parse(JSON.stringify(this.state)) as StoreState;
    }

    /**
     * Set multiple values at once
     */
    setMultiple(values: StoreState): void {
        Object.entries(values).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    /**
     * Persist state to local storage
     */
    persist(): void {
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
    restore(): boolean {
        try {
            const serialized = localStorage.getItem(this.storageKey);

            if (!serialized) {
                console.log('No persisted state found in localStorage');
                return false;
            }

            const { state, timestamp } = JSON.parse(serialized) as {
                state: StoreState;
                timestamp: number;
            };

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
     * Enable auto persistence
     */
    enableAutoPersist(options: { debounce?: number } = {}): void {
        this.autoPersist = true;
        this.persistDebounce = options.debounce || 500;

        console.log(`Auto-persist enabled (debounce: ${this.persistDebounce}ms)`);
    }

    /**
     * Disable auto-persist
     */
    disableAutoPersist(): void {
        this.autoPersist = false;

        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
            this.persistTimeout = null;
        }

        console.log('Auto-persist disabled');
    }

    /**
     * Debounced persist (waits for inactivity before saving)
     */
    private debouncedPersist(): void {
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }

        this.persistTimeout = setTimeout(() => {
            this.persist();
        }, this.persistDebounce || 500);
    }

    /**
     * Get statistics
     */
    getStats(): StoreStats {
        const countKeys = (obj: Record<string, unknown>): number => {
            let count = 0;
            for (const key in obj) {
                count++;
                const value = obj[key];
                if (typeof value === 'object' && value !== null) {
                    count += countKeys(value as Record<string, unknown>);
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
    debug(): void {
        console.log('=== Store Debug ===');
        console.log('Stats:', this.getStats());
        console.log('State:', this.getAll());
        console.log('Subscribers:', Array.from(this.subscribers.keys()));
    }
}
