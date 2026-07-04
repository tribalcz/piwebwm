import { ContextMenu, type ContextMenuItem } from '@components/ContextMenu';
import type { AppContext, AppManifest, WebDeskApp } from '@core/types';
import type { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';

import { Editor } from './components/Editor';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { ModulesDialog } from './components/ModulesDialog';
import { ModuleManager, type ModuleHostBridge } from './core/ModuleManager';
import { createEditorAPI } from './core/EditorAPI';
import type { ContextMenuContribution, Disposable, DocumentProvider, EditorAPI } from './core/types';

const CONTENT_STORAGE_KEY = 'apps.atol.content';

/**
 * Atol — a basic rich-text editor that also hosts micro-app modules.
 *
 * The editor and its formatting are the built-in baseline; modules extend it
 * through the ModuleManager, contributing to toolbar/status/context-menu slots.
 */
export default class Atol implements WebDeskApp {
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private store: Store | null;
    private manifest: AppManifest;

    private windowId: string | null = null;
    private rootEl: HTMLElement | null = null;

    private editor: Editor | null = null;
    private editorAPI: EditorAPI | null = null;
    private menubar: MenuBar | null = null;
    private toolbar: Toolbar | null = null;
    private statusbar: StatusBar | null = null;
    private modulesDialog: ModulesDialog | null = null;
    private contextMenu = new ContextMenu();
    private contextContribs: ContextMenuContribution[] = [];

    private moduleManager: ModuleManager;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    // File mode: when launched with a DocumentProvider, Atol edits that
    // document in its own window instead of the Store-backed notes buffer.
    private provider: DocumentProvider | null = null;
    private fileDirty = false;
    private windowClosedDisposable: (() => void) | null = null;

    constructor(context: AppContext) {
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;
        this.provider = (context.args?.provider as DocumentProvider) ?? null;

        // Host bridge: getters resolve lazily because the editor/toolbar/status
        // components do not exist until the window is created, while module
        // discovery (which only reads manifests) happens earlier in init().
        const self = this;
        const bridge: ModuleHostBridge = {
            get editorAPI(): EditorAPI {
                return self.editorAPI!;
            },
            get store(): Store | null {
                return self.store;
            },
            addToolbarItem: (item) => self.toolbar!.addItem(item),
            addStatusItem: (item) => self.statusbar!.addItem(item),
            refreshStatus: () => self.statusbar?.refresh(),
            addContextMenuItem: (item) => self.addContextContribution(item),
            addMenu: (menu) => self.menubar!.addMenu(menu),
            setFocusMode: (on) => self.rootEl?.classList.toggle('focus-mode', on),
        };

        this.moduleManager = new ModuleManager(bridge);

        console.log('Atol initialized');
    }

    async init(): Promise<void> {
        await this.moduleManager.discover();
    }

    async open(): Promise<void> {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: this.provider?.title || this.manifest?.ui?.displayName || 'Atol',
            x: 160 + (windowCount * 25),
            y: 110 + (windowCount * 25),
            width: this.manifest?.window?.defaultWidth || 640,
            height: this.manifest?.window?.defaultHeight || 480,
            content: this.renderSkeleton(),
            persistent: this.manifest?.window?.persistent || false,
            onCreated: (id, el) => this.onWindowCreated(id, el),
        });

        console.log('Atol opened, windowId:', this.windowId);
    }

    private renderSkeleton(): string {
        return `
            <div class="atol">
                <div class="atol-menubar-host" id="atol-menubar"></div>
                <div class="atol-toolbar-host" id="atol-toolbar"></div>
                <div class="atol-editor-host" id="atol-editor"></div>
                <div class="atol-statusbar-host" id="atol-status"></div>
            </div>
        `;
    }

    private async onWindowCreated(id: string, windowEl: HTMLElement): Promise<void> {
        this.windowId = id;

        const root = windowEl.querySelector<HTMLElement>('.atol');
        this.rootEl = root;
        const menubarHost = windowEl.querySelector('#atol-menubar');
        const toolbarHost = windowEl.querySelector('#atol-toolbar');
        const editorHost = windowEl.querySelector('#atol-editor');
        const statusHost = windowEl.querySelector('#atol-status');

        if (!root || !menubarHost || !toolbarHost || !editorHost || !statusHost) {
            console.error('Atol: window scaffold not found');
            return;
        }

        if (this.provider) {
            await this.initFileMode(root, toolbarHost, editorHost, statusHost);
            return;
        }

        if (this.eventBus) {
            this.eventBus.emit('app:opened', { appId: this.manifest.id, windowId: id });
        }

        this.editor = new Editor(editorHost);
        this.editorAPI = createEditorAPI(this.editor);
        this.menubar = new MenuBar(menubarHost);
        this.toolbar = new Toolbar(toolbarHost, {
            onFormat: (command, value) => this.editor?.applyFormat(command, value),
            onOpenModules: () => this.modulesDialog?.toggle(),
        });
        this.statusbar = new StatusBar(statusHost);
        this.modulesDialog = new ModulesDialog(root, this.moduleManager);

        // Restore persisted content.
        const saved = this.store?.get<string>(CONTENT_STORAGE_KEY, '');
        if (saved) {
            this.editor.setHTML(saved);
        }

        // Autosave (debounced) + module command shortcuts + editor context menu.
        this.editor.onChange(() => this.scheduleSave());
        this.setupKeyboard(windowEl);
        this.setupContextMenu(editorHost);

        // Bring up modules that are enabled.
        await this.moduleManager.activateEnabled();

        this.statusbar.setMessage('Ready');
        this.editor.focus();

        console.log('Atol components initialized');
    }

    /**
     * File mode: edit an external document via the DocumentProvider. Plain-text
     * editing with explicit Save/Reload — no rich formatting, no modules, no
     * autosave (we never want to silently write a system file), and no
     * `app:opened` event (so AppManager doesn't tie this window to the singleton
     * notes instance). The window's own close drives teardown.
     */
    private async initFileMode(
        root: HTMLElement,
        toolbarHost: Element,
        editorHost: Element,
        statusHost: Element,
    ): Promise<void> {
        const provider = this.provider!;
        this.rootEl = root;
        root.classList.add('atol-text-mode');

        this.editor = new Editor(editorHost);
        this.editorAPI = createEditorAPI(this.editor);
        this.editor.setLineNumbers(true); // helpful for config files
        this.statusbar = new StatusBar(statusHost);

        const readOnly = provider.readOnly === true;
        toolbarHost.innerHTML = `
            <div class="atol-toolbar atol-file-toolbar">
                <button class="atol-tool-btn atol-file-reload" title="Reload from disk">Reload</button>
                ${readOnly ? '' : '<button class="atol-tool-btn atol-file-save" title="Save (Ctrl+S)">Save</button>'}
                <span class="atol-toolbar-spacer"></span>
                <span class="atol-file-path">${escapeHtmlText(provider.title)}</span>
            </div>
        `;
        const saveBtn = toolbarHost.querySelector<HTMLButtonElement>('.atol-file-save');
        const reloadBtn = toolbarHost.querySelector<HTMLButtonElement>('.atol-file-reload');
        saveBtn?.addEventListener('click', () => void this.saveFile());
        reloadBtn?.addEventListener('click', () => void this.loadFile());

        if (readOnly) {
            (editorHost.querySelector('.atol-editor') as HTMLElement | null)?.setAttribute('contenteditable', 'false');
        }

        // Track dirty state.
        this.editor.onChange(() => {
            if (this.fileDirty) return;
            this.fileDirty = true;
            this.statusbar?.setMessage('Modified');
        });

        // Ctrl+S saves.
        this.keydownHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (!readOnly) void this.saveFile();
            }
        };
        root.addEventListener('keydown', this.keydownHandler);

        // The window closing tears this instance down (it isn't tracked by
        // AppManager, so nothing else will).
        if (this.eventBus) {
            const handler = (data: { windowId: string }) => {
                if (data.windowId === this.windowId) {
                    this.windowClosedDisposable?.();
                    this.windowClosedDisposable = null;
                    this.destroyComponents();
                }
            };
            this.eventBus.on('window:closed', handler);
            this.windowClosedDisposable = () => this.eventBus?.off('window:closed', handler);
        }

        await this.loadFile();
        this.editor.focus();
    }

    private async loadFile(): Promise<void> {
        if (!this.provider || !this.editor) return;
        this.statusbar?.setMessage('Loading…');
        try {
            const content = await this.provider.load();
            this.editor.setText(content);
            this.fileDirty = false;
            this.statusbar?.setMessage('Ready');
        } catch (err) {
            this.statusbar?.setMessage('Load failed');
            alert(`Could not open ${this.provider.title}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async saveFile(): Promise<void> {
        if (!this.provider || !this.editor) return;
        this.statusbar?.setMessage('Saving…');
        try {
            await this.provider.save(this.editor.getText());
            this.fileDirty = false;
            this.statusbar?.setMessage('Saved');
        } catch (err) {
            this.statusbar?.setMessage('Save failed');
            alert(`Could not save ${this.provider.title}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private scheduleSave(): void {
        if (!this.store) return;
        this.statusbar?.setMessage('Editing…');
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.store?.set(CONTENT_STORAGE_KEY, this.editor?.getHTML() ?? '');
            this.statusbar?.setMessage('Saved');
        }, 500);
    }

    private setupKeyboard(windowEl: HTMLElement): void {
        this.keydownHandler = (e: KeyboardEvent) => {
            // Only when this window is focused/active.
            const active = document.querySelector<HTMLElement>('.window.active');
            if (!active || active.dataset.id !== this.windowId) return;
            this.moduleManager.handleKeydown(e);
        };
        windowEl.addEventListener('keydown', this.keydownHandler);
    }

    private setupContextMenu(editorHost: Element): void {
        editorHost.addEventListener('contextmenu', (e) => {
            const ev = e as MouseEvent;
            // No module contributions → let the browser's native menu show
            // (spellcheck, etc.).
            if (this.contextContribs.length === 0) return;

            ev.preventDefault();
            const items: ContextMenuItem[] = [
                { label: 'Cut', action: 'cut', handler: () => document.execCommand('cut') },
                { label: 'Copy', action: 'copy', handler: () => document.execCommand('copy') },
                { label: 'Select All', action: 'select-all', handler: () => document.execCommand('selectAll') },
                { separator: true },
                ...this.contextContribs.map((c, i) => ({
                    label: c.label,
                    icon: c.icon,
                    action: `contrib-${i}`,
                    handler: c.handler,
                })),
            ];
            this.contextMenu.show(ev.clientX, ev.clientY, items);
        });
    }

    private addContextContribution(item: ContextMenuContribution): Disposable {
        this.contextContribs.push(item);
        return () => {
            this.contextContribs = this.contextContribs.filter(c => c !== item);
        };
    }

    /**
     * Teardown for the transient file-mode instance, driven by its window
     * closing (it isn't tracked by AppManager). Releases the editor, status bar,
     * key handler and the window:closed subscription. Guarded against running
     * twice.
     */
    private destroyComponents(): void {
        if (this.keydownHandler && this.rootEl) {
            this.rootEl.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        this.windowClosedDisposable?.();
        this.windowClosedDisposable = null;
        this.statusbar?.destroy();
        this.editor?.destroy();
        this.editor = null;
        this.statusbar = null;
    }

    async close(): Promise<void> {
        // File-mode instances are torn down via their window's close event.
        if (this.provider) {
            this.destroyComponents();
            if (this.windowId) {
                this.windowManager.closeWindow(this.windowId);
            }
            return;
        }

        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            // Flush a final save.
            this.store?.set(CONTENT_STORAGE_KEY, this.editor?.getHTML() ?? '');
        }

        await this.moduleManager.destroy();

        this.modulesDialog?.destroy();
        this.statusbar?.destroy();
        this.toolbar?.destroy();
        this.menubar?.destroy();
        this.editor?.destroy();

        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }

        if (this.eventBus) {
            this.eventBus.emit('app:closed', { appId: this.manifest.id, timestamp: Date.now() });
        }

        console.log('Atol closed');
    }
}

function escapeHtmlText(text: string): string {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
