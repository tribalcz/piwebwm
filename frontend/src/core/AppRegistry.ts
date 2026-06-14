import type { AppManifest } from '@core/types';

/**
 * AppRegistry - Central repository for application metadata
 * Provides a query API for searching and filtering
 */
export class AppRegistry {
    private apps: Map<string, AppManifest>;
    private categories: Map<string, string[]>;

    constructor() {
        this.apps = new Map();
        this.categories = new Map();
        console.log('AppRegistry initialized');
    }

    /**
     * Register an application
     */
    register(manifest: AppManifest): void {
        if (!manifest || !manifest.id) {
            throw new Error('Invalid manifest: missing id');
        }

        const appId = manifest.id;

        this.apps.set(appId, manifest);

        const category = manifest.ui?.category || 'other';
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category)!.push(appId);

        console.log(`App registered: ${appId} (${category})`);
    }

    /**
     * Unregister an application
     */
    unregister(appId: string): void {
        const manifest = this.apps.get(appId);
        if (!manifest) return;

        const category = manifest.ui?.category || 'other';
        const apps = this.categories.get(category);
        if (apps) {
            const index = apps.indexOf(appId);
            if (index > -1) {
                apps.splice(index, 1);
            }
        }

        this.apps.delete(appId);
        console.log(`App unregistered: ${appId}`);
    }

    /**
     * Get an application by ID
     */
    get(appId: string): AppManifest | null {
        return this.apps.get(appId) || null;
    }

    /**
     * Check if an application is registered
     */
    has(appId: string): boolean {
        return this.apps.has(appId);
    }

    /**
     * Get all registered applications
     */
    getAll(): AppManifest[] {
        return Array.from(this.apps.values());
    }

    /**
     * Return all apps in a specific category
     */
    getByCategory(category: string): AppManifest[] {
        const appIds = this.categories.get(category) || [];
        return appIds
            .map(id => this.apps.get(id))
            .filter((manifest): manifest is AppManifest => Boolean(manifest));
    }

    /**
     * Return all categories
     */
    getCategorie(): Map<string, string[]> {
        return this.categories;
    }

    /**
     * Search for application by keywords
     */
    search(query: string): AppManifest[] {
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
     * Count the number of registered apps
     */
    count(): number {
        return this.apps.size;
    }

    /**
     * Clear all registered apps ( ONLY FOR TESTING )
     * TODO: remove this method after testing
     */
    clear(): void {
        this.apps.clear();
        this.categories.clear();
        console.log('AppRegistry cleared');
    }

    /**
     * Export the registry apps to JSON ( FOR DEBUGGING )
     */
    toJSON(): { apps: AppManifest[]; categories: [string, string[]][] } {
        return {
            apps: Array.from(this.apps.values()),
            categories: Array.from(this.categories.entries())
        };
    }
}
