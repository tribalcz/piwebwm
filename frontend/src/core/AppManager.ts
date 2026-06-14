import { AppRegistry } from '@core/AppRegistry';
import { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';
import type { AppContext, AppManifest, WebDeskApp, WebDeskAppConstructor } from '@core/types';

interface AppModule {
    default: WebDeskAppConstructor;
}

export interface AppManagerStats {
    registered: number;
    running: number;
    runningApps: string[];
    categories: Map<string, string[]>;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * App Manager
 *
 * Discover, validation, launch, cleanup
 */
export class AppManager {
    private eventBus: EventBus | null;
    private store: Store | null;
    readonly windowManager: WindowManager;
    readonly registry: AppRegistry;
    private runningApps: Map<string, WebDeskApp>;
    private appModules: Map<string, AppModule>;
    private windowToApp: Map<string, string>;
    private appStyles: Map<string, HTMLLinkElement[]>;

    constructor(
        eventBus: EventBus | null = null,
        store: Store | null = null,
        windowManager: WindowManager | null = null
    ) {
        this.eventBus = eventBus;
        this.store = store;

        this.windowManager = windowManager || new WindowManager(eventBus, store);
        this.registry = new AppRegistry();
        this.runningApps = new Map();
        this.appModules = new Map();
        this.windowToApp = new Map();
        this.appStyles = new Map();

        console.log('AppManager initialized.');

        this.setupEventListeners();

        if (this.eventBus) {
            console.log('  ↳ AppManager connected to EventBus');
        }
        if (this.store) {
            console.log('  ↳ AppManager connected to Store');
        }
        if (this.windowManager) {
            console.log('  ↳ AppManager using provided WindowManager');
        }
    }

    /**
     * Search the apps directory and find all applications (manifests)
     */
    async discovery(): Promise<void> {
        console.log('Searching for applications...');

        try {
            const manifestModules = import.meta.glob('/src/apps/*/meta/manifest.json');

            console.log(`Found ${Object.keys(manifestModules).length} applications.`);

            for (const [path, importFn] of Object.entries(manifestModules)) {
                try {
                    console.log(`Loading application from ${path}`);
                    const module = await importFn() as { default?: AppManifest };

                    const manifest = module.default ?? (module as AppManifest);

                    this.validateManifest(manifest);

                    this.registry.register(manifest);
                } catch (error) {
                    console.error(`Failed to load ${path}:`, error);
                    this.showManifestError(path, error);
                }
            }

            console.log(`All applications (${this.registry.count()}) loaded.`);

            this.registry.getAll();
        } catch (error) {
            console.error('Error during discovery:', error);
            throw error;
        }
    }

    /**
     * Validate manifest according to the rules
     */
    validateManifest(manifest: AppManifest): void {
        const errors: string[] = [];

        //Requirement fields
        if (!manifest.id) errors.push('Missing "id" field in manifest.');
        if (!manifest.name) errors.push('Missing "name" field in manifest.');
        if (!manifest.version) errors.push('Missing "version" field in manifest.');
        if (!manifest.entryPoint) errors.push('Missing "entryPoint" field in manifest.');

        if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
            errors.push('Invalid id format (use lowercase and dashes only)');
        }

        if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
            errors.push('Invalid version format (use semver: X.Y.Z)');
        }

        if (manifest.permissions && !Array.isArray(manifest.permissions)) {
            errors.push('permissions must be an array');
        }

        if (manifest.window) {
            if (manifest.window.defaultWidth && typeof manifest.window.defaultWidth !== 'number') {
                errors.push('window.defaultWidth must be a number');
            }
            if (manifest.window.defaultHeight && typeof manifest.window.defaultHeight !== 'number') {
                errors.push('window.defaultHeight must be a number');
            }
        }

        if (errors.length > 0) {
            throw new Error(`Invalid manifest:\n- ${errors.join('\n- ')}`);
        }

        console.log(`Manifest valid: ${manifest.id}`);
    }

    /**
     * Show error message for manifest
     */
    showManifestError(path: string, error: unknown): void {
        const appId = path.match(/apps\/([^/]+)\//)?.[1] || 'unknown';
        const err = error instanceof Error ? error : new Error(String(error));

        const errorHtml = `
            <div style="padding:20px; font-famiy:monospace;">
                <h2 style="color:#ef4444; margin-bottom:16px;">
                    Manifest Error
                </h2>
                <p style="margin-bottom: 12px">
                    <strong>Application:</strong> ${appId}</br>
                    <strong>File:</strong> ${path}
                </p>
                <div style="background: #fee; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                    <strong>Error:</strong></br>
                    ${err.message}
                </div>
                <button onclick="navigator.clipboard.writeText('${err.stack}'); alert('Error copied to clipboard');">
                    Copy Error
                </button>
                <p style="margin-top: 16px; color: #666; font-size: 12px">
                    This app will not be available until the manifest is fixed.
                </p>
            </div>
        `;

        this.windowManager.createWindow({
            title: `Error: ${appId}`,
            x: 200,
            y: 150,
            width: 600,
            height: 400,
            content: errorHtml,
            persistent: true
        });
    }

    /**
     * Whether an application is installed (available on the desktop). Backed by
     * the Store; defaults to the manifest's `enabled` flag. "Uninstalling" only
     * flips this flag — bundled code is never removed.
     */
    isAppInstalled(appId: string): boolean {
        const manifest = this.registry.get(appId);
        if (!manifest) return false;
        const fallback = manifest.enabled !== false;
        if (!this.store) return fallback;
        return this.store.get<boolean>(`apps.${appId}.installed`, fallback);
    }

    /**
     * Install or uninstall an application (persisted), emitting an event so the
     * Start menu can refresh. Refuses to uninstall apps marked non-removable.
     */
    setAppInstalled(appId: string, installed: boolean): void {
        const manifest = this.registry.get(appId);
        if (!manifest) return;
        if (!installed && manifest.removable === false) {
            throw new Error(`Application ${appId} cannot be uninstalled`);
        }
        this.store?.set(`apps.${appId}.installed`, installed);
        if (this.eventBus) {
            this.eventBus.emit(installed ? 'app:installed' : 'app:uninstalled', { appId });
        }
    }

    /**
     * Launch the application
     */
    async launch(appId: string): Promise<WebDeskApp> {
        const manifest = this.registry.get(appId);
        if (!manifest) {
            throw new Error(`Application not found: ${appId}`);
        }

        if (!this.isAppInstalled(appId)) {
            throw new Error(`Application not installed: ${appId}`);
        }

        const alreadyRunning = this.runningApps.get(appId);
        if (alreadyRunning) {
            console.log(`Application ${appId} is already running.`);
            return alreadyRunning;
        }

        if (this.eventBus) {
            this.eventBus.emit('app:launching', {
                appId,
                manifest
            });
        }

        try {
            const appModule = await this.loadAppModule(appId, manifest.entryPoint);

            await this.loadAppStyles(appId, manifest);

            const context = this.createAppContext(manifest);
            const AppClass = appModule.default;
            const appInstance = new AppClass(context);

            if (appInstance.init) {
                await appInstance.init();
            }

            if (appInstance.open) {
                await appInstance.open();
            }

            this.runningApps.set(appId, appInstance);
            this.appModules.set(appId, appModule);

            console.log(`Application ${appId} launched.`);

            if (this.eventBus) {
                this.eventBus.emit('app:launched', {
                    appId,
                    manifest,
                    timestamp: Date.now()
                });
            }

            if (this.store) {
                const running = this.store.get<string[]>('apps.running') || [];
                this.store.set('apps.running', [...running, appId]);
                this.store.set('apps.count', running.length + 1);
            }

            return appInstance;
        } catch (error) {
            console.error(`Failed to launch application ${appId}: `, error);

            if (this.eventBus) {
                this.eventBus.emit('app:error', {
                    appId,
                    error: errorMessage(error),
                    phase: 'launch',
                    timestamp: Date.now()
                });
            }
            throw error;
        }
    }

    /**
     * Lazy importers for app entry points, resolved at build time so the
     * modules are part of the bundle (a raw dynamic import would only
     * work against the dev server).
     */
    private static readonly appEntryModules = import.meta.glob('/src/apps/*/*.{js,ts}');

    /**
     * Load the app module (dynamic import)
     */
    async loadAppModule(appId: string, entryPoint: string): Promise<AppModule> {
        const modulePath = `/src/apps/${appId}/${entryPoint}`;

        console.log(`Loading app module from ${modulePath}`);

        // Tolerate a stale extension in the manifest (index.js vs index.ts)
        const candidates = [
            modulePath,
            modulePath.replace(/\.js$/, '.ts'),
            modulePath.replace(/\.ts$/, '.js'),
        ];
        const importer = candidates
            .map(path => AppManager.appEntryModules[path])
            .find(Boolean);

        if (!importer) {
            throw new Error(`Failed to load app module ${modulePath}: entry point not found`);
        }

        try {
            const module = await importer();
            return module as AppModule;
        } catch (error) {
            console.error(`Failed to load module ${modulePath}:`, error);
            throw new Error(`Failed to load app module ${modulePath}: ${errorMessage(error)}`);
        }
    }

    /**
     * Load app styles from manifest
     */
    async loadAppStyles(appId: string, manifest: AppManifest): Promise<void> {
        const styles = manifest.styles || [];

        if (styles.length === 0) {
            return; // No styles to load
        }

        const loadedStyleElements: HTMLLinkElement[] = [];

        for (const stylePath of styles) {
            try {
                const fullPath = `/src/apps/${appId}/${stylePath.replace('./', '')}`;

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fullPath;
                link.dataset.appId = appId;
                link.dataset.stylePath = stylePath;

                document.head.appendChild(link);

                loadedStyleElements.push(link);

                console.log(`  ↳ Loaded stylesheet: ${fullPath}`);
            } catch (error) {
                console.error(`Failed to load stylesheet ${stylePath} for ${appId}:`, error);
            }
        }

        if (loadedStyleElements.length > 0) {
            this.appStyles.set(appId, loadedStyleElements);
            console.log(`  ↳ Loaded ${loadedStyleElements.length} stylesheet(s) for ${appId}`);
        }
    }

    /**
     * Unload app styles
     */
    unloadAppStyles(appId: string): void {
        const styleElements = this.appStyles.get(appId);

        if (!styleElements || styleElements.length === 0) {
            return; // No styles to unload
        }

        styleElements.forEach(link => {
            link.remove();
        });

        this.appStyles.delete(appId);

        console.log(`  ↳ Unloaded ${styleElements.length} stylesheet(s) for ${appId}`);
    }

    /**
     * Create the app context
     */
    createAppContext(manifest: AppManifest): AppContext {
        return {
            windowManager: this.windowManager,
            manifest: manifest,
            eventBus: this.eventBus,
            store: this.store,
            logger: console,
            appId: manifest.id
        };
    }

    /**
     * Close the application
     */
    async close(appId: string): Promise<void> {
        console.log(`Closing application ${appId}`);

        const appInstance = this.runningApps.get(appId);
        if (!appInstance) {
            console.log(`Application ${appId} is not running.`);
            return;
        }

        if (this.eventBus) {
            this.eventBus.emit('app:closing', {
                appId,
            });
        }

        try {
            if (appInstance.close) {
                await appInstance.close();
            }

            this.unloadAppStyles(appId);

            this.runningApps.delete(appId);
            this.appModules.delete(appId);

            console.log(`Application ${appId} closed.`);

            if (this.eventBus) {
                this.eventBus.emit('app:closed', {
                    appId,
                    timestamp: Date.now()
                });
            }

            if (this.store) {
                const running = this.store.get<string[]>('apps.running', []);
                const updated = running.filter(id => id !== appId);
                this.store.set('apps.running', updated);
                this.store.set('apps.count', updated.length);
            }
        } catch (error) {
            console.error(`Failed to close application ${appId}:`, error);

            if (this.eventBus) {
                this.eventBus.emit('app:error', {
                    appId,
                    error: errorMessage(error),
                    phase: 'close',
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Setup event listeners for window lifecycle
     */
    private setupEventListeners(): void {
        if (!this.eventBus) return;

        this.eventBus.on('window:closed', (data) => {
            const { windowId } = data;

            const appId = this.windowToApp.get(windowId);

            if (appId) {
                console.log(`Window ${windowId} closed, cleaning up app ${appId}`);

                this.windowToApp.delete(windowId);

                this.close(appId).catch(err => {
                    console.error(`Failed to cleanup app ${appId}:`, err);
                });
            }
        });

        this.eventBus.on('app:opened', (data) => {
            const { appId, windowId } = data;

            if (appId && windowId) {
                console.log(`Tracking: window ${windowId} belongs to app ${appId}`);
                this.windowToApp.set(windowId, appId);
            }
        });

        console.log('  ↳ AppManager listening to window events');
    }

    /**
     * Return all running apps
     */
    getRunningApps(): string[] {
        return Array.from(this.runningApps.keys());
    }

    /**
     * Check if the app is running
     */
    isRunning(appId: string): boolean {
        return this.runningApps.has(appId);
    }

    /**
     * hot reload handler
     */
    async hotReload(appId: string): Promise<void> {
        console.log(`Hot Reloading: ${appId}`);

        if (this.isRunning(appId)) {
            await this.close(appId);
            console.log(`Application ${appId} killed for hot reloading.`);
        }
    }

    /**
     * Get app statistics
     */
    getStats(): AppManagerStats {
        return {
            registered: this.registry.count(),
            running: this.runningApps.size,
            runningApps: Array.from(this.runningApps.keys()),
            categories: this.registry.getCategorie()
        };
    }
}
