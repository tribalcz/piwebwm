import type { Store } from '@core/Store';
import type {
    ContextMenuContribution,
    Disposable,
    EditorAPI,
    ModuleContext,
    ModuleManifest,
    ModuleSlot,
    ModuleStorage,
    NotepadModule,
    NotepadModuleConstructor,
    StatusItem,
    ToolbarItem,
} from './types';

const HOST_ID = 'notepad';
const VALID_SLOTS: ModuleSlot[] = ['toolbar', 'statusbar', 'contextmenu'];

/** The host UI surface the manager wires module contributions into. */
export interface ModuleHostBridge {
    editorAPI: EditorAPI;
    addToolbarItem(item: ToolbarItem): Disposable;
    addStatusItem(item: StatusItem): Disposable;
    refreshStatus(): void;
    addContextMenuItem(item: ContextMenuContribution): Disposable;
    store: Store | null;
}

interface ModuleRecord {
    manifest: ModuleManifest;
    importer: () => Promise<unknown>;
    instance: NotepadModule | null;
    disposables: Disposable[];
}

interface RegisteredCommand {
    moduleId: string;
    handler: () => void;
    shortcut?: ParsedShortcut;
}

interface ParsedShortcut {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    key: string;
}

/** Public view of a module for the management dialog. */
export interface ModuleInfo {
    id: string;
    name: string;
    description?: string;
    version: string;
    enabled: boolean;
    active: boolean;
}

function disposeSafely(d: Disposable): void {
    try {
        d();
    } catch (err) {
        console.error('Notepad module dispose error:', err);
    }
}

function parseShortcut(shortcut: string): ParsedShortcut {
    const parts = shortcut.split('+').map(p => p.trim().toLowerCase());
    return {
        ctrl: parts.includes('ctrl') || parts.includes('cmd'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        key: parts[parts.length - 1],
    };
}

/**
 * Discovers, validates and runs Notepad modules. Each module gets its own
 * ModuleContext; every contribution it makes is tracked so the manager can tear
 * it all down on deactivate — a module cannot leak a listener or a DOM node.
 */
export class ModuleManager {
    private host: ModuleHostBridge;
    private records = new Map<string, ModuleRecord>();
    private commands = new Map<string, RegisteredCommand>();

    constructor(host: ModuleHostBridge) {
        this.host = host;
    }

    /** Scan the modules directory, validate manifests, build the registry. */
    async discover(): Promise<void> {
        const manifestModules = import.meta.glob('/src/apps/notepad/modules/*/module.json');
        const entryModules = import.meta.glob('/src/apps/notepad/modules/*/*.{js,ts}');

        for (const [path, importManifest] of Object.entries(manifestModules)) {
            try {
                const mod = await importManifest() as { default?: ModuleManifest };
                const manifest = mod.default ?? (mod as ModuleManifest);

                this.validateManifest(manifest, path);

                const dir = path.slice(0, path.lastIndexOf('/') + 1);
                const entryPath = dir + manifest.entryPoint;
                const importer =
                    entryModules[entryPath] ??
                    entryModules[entryPath.replace(/\.js$/, '.ts')] ??
                    entryModules[entryPath.replace(/\.ts$/, '.js')];

                if (!importer) {
                    throw new Error(`entry point not found: ${entryPath}`);
                }

                this.records.set(manifest.id, {
                    manifest,
                    importer,
                    instance: null,
                    disposables: [],
                });
                console.log(`Notepad module registered: ${manifest.id}`);
            } catch (err) {
                // A broken module must not take the host down.
                console.warn(`Skipping invalid module at ${path}:`, err);
            }
        }
    }

    private validateManifest(manifest: ModuleManifest, path: string): void {
        const errors: string[] = [];

        if (!manifest.id) errors.push('missing "id"');
        else if (!/^[a-z0-9-]+$/.test(manifest.id)) errors.push('invalid "id" (lowercase/dashes only)');
        if (manifest.type !== 'notepad-module') errors.push('"type" must be "notepad-module"');
        if (manifest.host !== HOST_ID) errors.push(`"host" must be "${HOST_ID}"`);
        if (!manifest.name) errors.push('missing "name"');
        if (!manifest.version) errors.push('missing "version"');
        else if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) errors.push('invalid "version" (semver X.Y.Z)');
        if (!manifest.entryPoint) errors.push('missing "entryPoint"');
        if (manifest.slots) {
            for (const slot of manifest.slots) {
                if (!VALID_SLOTS.includes(slot)) errors.push(`unknown slot "${slot}"`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`manifest (${path}):\n  - ${errors.join('\n  - ')}`);
        }
    }

    /** Activate every module that is enabled (persisted state or default). */
    async activateEnabled(): Promise<void> {
        for (const record of this.records.values()) {
            if (this.isEnabled(record.manifest.id)) {
                await this.activate(record.manifest.id);
            }
        }
    }

    isEnabled(id: string): boolean {
        const record = this.records.get(id);
        if (!record) return false;
        const fallback = record.manifest.enabledByDefault ?? false;
        if (!this.host.store) return fallback;
        return this.host.store.get<boolean>(this.enabledKey(id), fallback);
    }

    private enabledKey(id: string): string {
        return `apps.notepad.modules.${id}.enabled`;
    }

    /** Enable or disable a module at runtime, persisting the choice. */
    async setEnabled(id: string, enabled: boolean): Promise<void> {
        const record = this.records.get(id);
        if (!record) return;

        this.host.store?.set(this.enabledKey(id), enabled);

        if (enabled && !record.instance) {
            await this.activate(id);
        } else if (!enabled && record.instance) {
            await this.deactivate(id);
        }
    }

    private async activate(id: string): Promise<void> {
        const record = this.records.get(id);
        if (!record || record.instance) return;

        try {
            const mod = await record.importer() as { default: NotepadModuleConstructor };
            const instance = new mod.default();
            const ctx = this.buildContext(record);
            await instance.activate(ctx);
            record.instance = instance;
            console.log(`Notepad module activated: ${id}`);
        } catch (err) {
            console.error(`Failed to activate module ${id}:`, err);
            // Roll back anything that was registered before the failure.
            this.disposeRecord(record);
        }
    }

    private async deactivate(id: string): Promise<void> {
        const record = this.records.get(id);
        if (!record || !record.instance) return;

        try {
            await record.instance.deactivate?.();
        } catch (err) {
            console.error(`Module ${id} deactivate() error:`, err);
        }

        this.disposeRecord(record);
        record.instance = null;
        console.log(`Notepad module deactivated: ${id}`);
    }

    private disposeRecord(record: ModuleRecord): void {
        // Reverse order: last registered, first disposed.
        for (const d of record.disposables.slice().reverse()) {
            disposeSafely(d);
        }
        record.disposables = [];
        // Drop the module's commands.
        for (const [key, cmd] of this.commands) {
            if (cmd.moduleId === record.manifest.id) {
                this.commands.delete(key);
            }
        }
    }

    private buildContext(record: ModuleRecord): ModuleContext {
        const moduleId = record.manifest.id;
        const slots = new Set(record.manifest.slots ?? []);
        const track = (d: Disposable): Disposable => {
            record.disposables.push(d);
            return d;
        };

        const requireSlot = (slot: ModuleSlot, action: string): boolean => {
            if (!slots.has(slot)) {
                console.warn(
                    `Module ${moduleId} tried to ${action} without declaring the "${slot}" slot in module.json`
                );
                return false;
            }
            return true;
        };

        const noop: Disposable = () => {};

        // Editor wrapper: subscriptions are auto-tracked for cleanup.
        const editor: EditorAPI = {
            getText: () => this.host.editorAPI.getText(),
            setText: (t) => this.host.editorAPI.setText(t),
            getHTML: () => this.host.editorAPI.getHTML(),
            getSelectionText: () => this.host.editorAPI.getSelectionText(),
            replaceSelection: (t) => this.host.editorAPI.replaceSelection(t),
            applyFormat: (c, v) => this.host.editorAPI.applyFormat(c, v),
            focus: () => this.host.editorAPI.focus(),
            onChange: (cb) => track(this.host.editorAPI.onChange(cb)),
            onSelectionChange: (cb) => track(this.host.editorAPI.onSelectionChange(cb)),
        };

        return {
            moduleId,
            editor,
            ui: {
                addToolbarItem: (item) =>
                    requireSlot('toolbar', 'add a toolbar item')
                        ? track(this.host.addToolbarItem(item))
                        : noop,
                addStatusItem: (item) =>
                    requireSlot('statusbar', 'add a status item')
                        ? track(this.host.addStatusItem(item))
                        : noop,
                addContextMenuItem: (item) =>
                    requireSlot('contextmenu', 'add a context-menu item')
                        ? track(this.host.addContextMenuItem(item))
                        : noop,
                refreshStatus: () => this.host.refreshStatus(),
            },
            commands: {
                register: (id, handler, shortcut) => {
                    const key = `${moduleId}:${id}`;
                    this.commands.set(key, {
                        moduleId,
                        handler,
                        shortcut: shortcut ? parseShortcut(shortcut) : undefined,
                    });
                    return track(() => this.commands.delete(key));
                },
            },
            storage: this.createStorage(moduleId),
            log: console,
        };
    }

    private createStorage(moduleId: string): ModuleStorage {
        const prefix = `apps.notepad.modules.${moduleId}.data.`;
        const store = this.host.store;
        const memory = new Map<string, unknown>();

        return {
            get: <T = unknown>(key: string, defaultValue?: T): T => {
                if (store) return store.get<T>(prefix + key, defaultValue as T);
                return (memory.has(key) ? memory.get(key) : defaultValue) as T;
            },
            set: (key, value) => {
                if (store) store.set(prefix + key, value);
                else memory.set(key, value);
            },
            delete: (key) => {
                if (store) store.delete(prefix + key);
                else memory.delete(key);
            },
        };
    }

    /** Dispatch a keydown to any matching module command. Returns true if handled. */
    handleKeydown(e: KeyboardEvent): boolean {
        for (const cmd of this.commands.values()) {
            const s = cmd.shortcut;
            if (!s) continue;
            if (
                s.ctrl === (e.ctrlKey || e.metaKey) &&
                s.shift === e.shiftKey &&
                s.alt === e.altKey &&
                s.key === e.key.toLowerCase()
            ) {
                e.preventDefault();
                try {
                    cmd.handler();
                } catch (err) {
                    console.error('Module command error:', err);
                }
                return true;
            }
        }
        return false;
    }

    /** Snapshot for the management dialog. */
    list(): ModuleInfo[] {
        return Array.from(this.records.values()).map(r => ({
            id: r.manifest.id,
            name: r.manifest.name,
            description: r.manifest.description,
            version: r.manifest.version,
            enabled: this.isEnabled(r.manifest.id),
            active: r.instance !== null,
        }));
    }

    /** Deactivate everything (host is closing). */
    async destroy(): Promise<void> {
        for (const id of Array.from(this.records.keys()).reverse()) {
            await this.deactivate(id);
        }
        this.commands.clear();
    }
}
