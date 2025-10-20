
/**
 * AppRegistry - Central repository for application metadata
 * Provides a query API for searching and filtering
 */
export class AppRegistry {
    constructor() {
        this.apps = new Map();
        this.categories = new Map();
        console.log('AppRegistry initialized');
    }

    /**
     * Register an application
     * @param {Object} manifest - Application manifest
     */
    register(manifest) {
        if (!manifest || !manifest.id) {
            throw new Error('Invalid manifest: missing id');
        }

        const appId = manifest.id;

        this.apps.set(appId, manifest);

        const category = manifest.ui?.category || 'other';
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(appId);

        console.log(`App registered: ${appId} (${category})`);
    }

    /**
     * Unregister an application
     * @param {string} appId - Application ID
     */
    unregister(appId) {
        const manifest = this.apps.get(appId);
        if (!manifest) return;

        const cateogory = manifest.ui?.category || 'other';
        if (this.categories.has(cateogory)) {
            const apps = this.categories.get(cateogory);
            const index = apps.indexOf(appId);
            if (index > -1) {
                apps.splice(index, 1);
            }
        }

        this.apps.delete(appId);
        console.log(`App unregistered: ${appId}`);
    }

    /**
     * Get all registered applications
     * @returns {Array}
     */
    getAll() {
        return Array.from(this.apps.values());
    }

    /**
     * Return all apps in a specific category
     * @param {string} category - Category name
     * @returns {Array}
     */
    getByCategory(category) {
        const appIds = this.categories.get(category) || [];
        return appIds.map(id => this.apps.get(id)).filter(Boolean);
    }

    /**
     * Retun all categories
     * @returns {Array}
     */
    getCategorie() {
        return this.categories;
    }

    /**
     * earch for application by keywords
     * @param {string}
     * @returns {Array}
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAll().filter(manifest => {
            if (manifest.name?.toLowerCase().includes(lowerQuery)) return true;

            if (manifest.ui?.displayName?.toLowerCase().includes(lowerQuery)) return true;

            if (manifest.ui?.keywords?.some(k => k.toLowerCase().includes(lowerQuery))) return true;

            if (manifest.description?.toLowerCase().includes(lowerQuery)) return true;

            return false;
        });
    }

    /**
     * Coutn the number of registered apps
     * @returns {number}
     */
    count() {
        return this.apps.size;
    }

    /**
     * Clear allregistered apps ( ONLY FOR TESTING )
     * TODO: remove this method after testing
     */
    clear() {
        this.apps.clear();
        this.categories.clear();
        console.log('AppRegistry cleared');
    }

    /**
     * Export the registrz apps to JSON ( FOR DEBUGGING )
     * @returns {Object}
     */
    toJSON() {
        return {
            apps: Array.from(this.apps.values()),
            categories: Array.from(this.categories.entries())
        };
    }
}