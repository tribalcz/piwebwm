
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


}