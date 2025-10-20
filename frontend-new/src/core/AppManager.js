import { AppRegistry} from "@core/AppRegistry.js";
import {WindowManager} from "@core/WindowManager.js";


/**
 * App Manager
 *
 * Discover, validation, launch, cleanup
 */
export class AppManager {
    constructor(appRegistry) {
        this.windowManager = new WindowManager;
        this.registry = new AppRegistry;
        this.runningApps = new Map();
        this.appModules = new Map();

        console.log('AppManager initialized.');
    }

    /**
     * Search the apps directory and find all applications (manifests)
     */
    async discovery() {
        console.log('Searching for applications...');

        try {
            const manifestModules = import.meta.glob('/src/apps/*/meta/manifest.json');

            console.log(`Found ${Object.keys(manifestModules).length} applications.`);

            for (const [path, importFn] of Object.entries(manifestModules)) {
                try {
                    console.log(`Loading application from ${path}`);
                    const manifest = await importFn();

                    this.validateManifest(manifest.default || manifest);

                    this.registry.register(manifest.default || manifest);
                } catch (error) {
                    console.error(`Failed to load ${path}:`, error);
                    this.showManifestError(path, error);
                }
            }

            console.log(`All applications (${this.registry.count()}) loaded.`)

            this.registry.getAll();
        } catch (error) {
            console.error('Error during discovery:', error);
            throw error;
        }
    }

    /**
     * Validate manifest aacording to the rules
     * @param manifest
     */
    validationManifest(manifest) {
        const errors = [];

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
     * @param {string} path
     * @param {Error} error
     */
    showManifestError(path, error) {
        const appId = path.match(/apps\/([^/]+)\//)?.[1] || 'unknown';

        const errorHtml = `
            <div style="padding:20px; font-famiy:monospace;">
                <h2 stle="color:#ef4444; margin-bottom:16px;">
                    Manifest Error
                </h2>
                <p style="margin-bottom: 12px">
                    <strong>Application:</strong> ${appId}</br>
                    <strong>File:</strong> ${path}
                </p>
                <div style="background: #fee; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                    <strong>Error:</strong></br> 
                    ${error.message}
                </div>
                <button onclick="navigator.clipboard.writeText('${error.stack}')" alert('Error copied to clipboard')>
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
     * Launch the application
     * @param {string} appId
     * @param {Promise<Object>} Instance of the application
     */
    async launch(appId) {
        if (!this.registry.has(appId)) {
            throw new Error(`Application not found: ${appId}`);
        }

        if (this.runningApps.has(appId)) {
            console.log(`Application ${appId} is already running.`);
            return this.runningApps.get(appId);
        }

        const manifest = this.registry.get(appId);

        try {
            const appModule = await this.loadAppModule(appId, manifest.entryPoint);
            const context = this.createAppContext(manifest);
            const appClass = appModule.default;
            const appInstance = new appClass(context);

            if (appInstance.init) {
                await appInstance.init();
            }

            if (appInstance.open) {
                await appInstance.open();
            }

            this,this.runningApps.set(appId, appInstance);
            this.appModules.set(appId, appModule);

            console.log(`Application ${appId} launched.`);

            return appInstance;
        } catch (error) {
            console.error(`Failed to launch application ${appId}: `, error);
            throw error;
        }
    }

    /**
     * Load the app module (dynamic import)
     * @param {string} appId
     * @param {string} entryPoint
     * @returns {Promise<module>}
     */
    async loadAppModule(appId, entryPoint){
        const modulePath = `/src/apps/${appId}/${entryPoint}`;

        console.log(`Loading app module from ${modulePath}`);

        try {
            const module = await import(/* @vite-ignore*/ modulePath);
            return module
        } catch (error) {
            console.error(`Failed to load module ${modulePath}:`, error);
            throw new Error(`Failed to load app module ${modulePath}: ${error.message}`);
        }
    }

    /**
     * Create the app context
     * @param {Object} manifest
     * @returns {Object}
     */
    createAppContext(manifest) {
        return {
            windowManager: this.windowManager,
            manifest: manifest,
            //TODO: This is minimum  for this session...
            //eventBud
            //permissions
            //store
            //logger
        };
    }

    /**
     * Close the application
     * @param {string} appId
     */
    async close(appId) {
        console.log(`Closing application ${appId}`);

        const appInstance = this.runningApps.get(appId);
        if (!appInstance) {
            console.log(`Application ${appId} is not running.`);
            return;
        }

        try {
            if (appInstance.close) {
                await appInstance.close();
            }

            this.runningApps.delete(appId);
            this.appModules.delete(appId);

            console.log(`Application ${appId} closed.`);
        } catch (error) {
            console.error(`Failed to close application ${appId}:`, error);
        }
    }

    /**
     * Return all running apps
     * @returns {Array}
     */
    getRunningApps() {
        return Array.from(this.runningApps.keys());
    }

    /**
     * Check of the apps is running
     * @param {string} appId
     * @return {boolean}
     */
    isRunning(appId) {
        return this.runningApps.has(appId);
    }

    /**
     * hot reload handler
     * @param appId
     */
    async hotReload(appId) {
        console.log(`Hot Reloading: ${appId}`);

        if (this.isRunning(appId)) {
            await this.close(appId);
            console.log(`Application ${appId} killed for hot reloading.`);
        }
    }
}