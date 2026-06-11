import type { AppManager } from '@core/AppManager';
import type { InstallManager } from './InstallManager';

export type EntryType = 'app' | 'notepad-module';

/** A unified catalog entry, normalized from an app or a module manifest. */
export interface CatalogEntry {
    type: EntryType;
    id: string;
    name: string;
    version: string;
    author?: string;
    description?: string;
    icon: string; // icon name for getIcon()
    category?: string; // applications only
    host?: string; // modules only
    permissions?: string[];
    removable: boolean;
    installed: boolean;
}

/** Minimal shape of a notepad module.json (local copy to avoid coupling). */
interface RawModuleManifest {
    id: string;
    type: string;
    host: string;
    version: string;
    name: string;
    description?: string;
    author?: string;
    enabledByDefault?: boolean;
}

/** Composite key, unique across types (an app and a module could share an id). */
export function entryKey(type: EntryType, id: string): string {
    return `${type}:${id}`;
}

/**
 * Gathers the catalog: applications from the AppManager registry plus Notepad
 * modules discovered from their manifests. Install state is resolved through
 * the InstallManager so it reflects the same flags the rest of the system uses.
 */
export async function collectCatalog(
    appManager: AppManager | null,
    install: InstallManager
): Promise<CatalogEntry[]> {
    const entries: CatalogEntry[] = [];

    // Applications.
    if (appManager) {
        for (const m of appManager.registry.getAll()) {
            entries.push({
                type: 'app',
                id: m.id,
                name: m.ui?.displayName || m.name,
                version: m.version,
                author: m.author,
                description: m.description,
                icon: m.ui?.icon || 'unknown',
                category: m.ui?.category,
                permissions: m.permissions,
                removable: m.removable !== false,
                installed: install.isAppInstalled(m.id),
            });
        }
    }

    // Notepad modules. Module entries borrow the host app's icon.
    const moduleManifests = import.meta.glob('/src/apps/notepad/modules/*/module.json');
    const hostIcon = appManager?.registry.get('notepad')?.ui?.icon || 'txt';

    for (const importer of Object.values(moduleManifests)) {
        try {
            const mod = await importer() as { default?: RawModuleManifest };
            const m = mod.default ?? (mod as RawModuleManifest);
            if (m.type !== 'notepad-module') continue;

            const def = m.enabledByDefault ?? false;
            entries.push({
                type: 'notepad-module',
                id: m.id,
                name: m.name,
                version: m.version,
                author: m.author,
                description: m.description,
                icon: hostIcon,
                host: m.host,
                removable: true,
                installed: install.isModuleEnabled(m.id, def),
            });
        } catch (err) {
            console.warn('App Store: failed to read a module manifest:', err);
        }
    }

    return entries;
}
