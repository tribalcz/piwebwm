/**
 * Atol module system — public contracts.
 *
 * A "module" (micro-app) extends the Atol host. It is deliberately distinct
 * from a top-level WebDesk application:
 *   - it is described by module.json (not meta/manifest.json), so the global
 *     AppManager discovery never picks it up;
 *   - it has no window — it contributes to host-provided slots;
 *   - its lifecycle (activate/deactivate) is driven by the host's
 *     ModuleManager, not by AppManager.
 */

/** A teardown function. Everything a module registers returns one. */
export type Disposable = () => void;

/** Slots a module may contribute to. Declared up-front in module.json. */
export type ModuleSlot = 'toolbar' | 'statusbar' | 'contextmenu';

/**
 * module.json schema. `type` is the discriminator that marks this as an Atol
 * micro-app rather than a normal application.
 */
export interface ModuleManifest {
    id: string;
    type: 'atol-module';
    host: string; // target host app id, e.g. "atol"
    version: string;
    name: string;
    description?: string;
    author?: string;
    entryPoint: string;
    slots?: ModuleSlot[];
    enabledByDefault?: boolean;
}

/** A button a module adds to the host toolbar. */
export interface ToolbarItem {
    id: string;
    label: string; // text or inline HTML (icon)
    title?: string; // tooltip
    onClick: () => void;
}

/** A status-bar contribution. `render` is called by the host on every refresh. */
export interface StatusItem {
    id: string;
    render: () => string; // returns text/HTML
}

/** An entry a module adds to the editor's context menu. */
export interface ContextMenuContribution {
    label: string;
    handler: () => void;
    icon?: string;
}

/** Per-module key/value store, namespaced under apps.atol.modules.<id>. */
export interface ModuleStorage {
    get<T = unknown>(key: string, defaultValue?: T): T;
    set(key: string, value: unknown): void;
    delete(key: string): void;
}

/**
 * The editor surface exposed to modules. Modules never touch the host DOM
 * directly; everything goes through this facade.
 */
export interface EditorAPI {
    getText(): string;
    setText(text: string): void;
    getHTML(): string;
    getSelectionText(): string;
    replaceSelection(text: string): void;
    /** Apply a formatting command (bold, italic, formatBlock, …). */
    applyFormat(command: string, value?: string): void;
    focus(): void;
    /** Fires on content change. Returns a Disposable. */
    onChange(callback: (text: string) => void): Disposable;
    /** Fires when the selection inside the editor changes. Returns a Disposable. */
    onSelectionChange(callback: () => void): Disposable;
}

/** UI registration surface. Each method returns a Disposable. */
export interface ModuleUI {
    addToolbarItem(item: ToolbarItem): Disposable;
    addStatusItem(item: StatusItem): Disposable;
    addContextMenuItem(item: ContextMenuContribution): Disposable;
    /** Ask the host to re-render status contributions. */
    refreshStatus(): void;
}

/** Command registration (with optional keyboard shortcut). */
export interface ModuleCommands {
    register(id: string, handler: () => void, shortcut?: string): Disposable;
}

/** Everything a module receives on activation. */
export interface ModuleContext {
    moduleId: string;
    editor: EditorAPI;
    ui: ModuleUI;
    commands: ModuleCommands;
    storage: ModuleStorage;
    log: Console;
}

/** Lifecycle contract a module's default export must implement. */
export interface AtolModule {
    activate(ctx: ModuleContext): void | Promise<void>;
    deactivate?(): void | Promise<void>;
}

/** Shape of a module entry point's default export. */
export type AtolModuleConstructor = new () => AtolModule;
