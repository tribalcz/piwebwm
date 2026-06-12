import type { Store } from '@core/Store';
import type { AppManager } from '@core/AppManager';
import type { CatalogEntry } from './Catalog';

/**
 * Reads and writes install state. Apps are delegated to the AppManager (which
 * also emits the install/uninstall events the Start menu listens for); Atol
 * modules reuse the exact Store key Atol's ModuleManager reads.
 *
 * "Install"/"uninstall" only flips a persisted flag — no code is added or
 * removed; everything ships in the bundle.
 */
export class InstallManager {
    private store: Store | null;
    private appManager: AppManager | null;

    constructor(store: Store | null, appManager: AppManager | null) {
        this.store = store;
        this.appManager = appManager;
    }

    isAppInstalled(appId: string): boolean {
        return this.appManager ? this.appManager.isAppInstalled(appId) : true;
    }

    isModuleEnabled(id: string, enabledByDefault: boolean): boolean {
        if (!this.store) return enabledByDefault;
        return this.store.get<boolean>(this.moduleKey(id), enabledByDefault);
    }

    private moduleKey(id: string): string {
        return `apps.atol.modules.${id}.enabled`;
    }

    /** Apply a new install state to any catalog entry. */
    setInstalled(entry: CatalogEntry, installed: boolean): void {
        if (entry.type === 'app') {
            this.appManager?.setAppInstalled(entry.id, installed);
        } else {
            this.store?.set(this.moduleKey(entry.id), installed);
        }
    }
}
