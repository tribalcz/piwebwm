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
import type { ContextMenuContribution, Disposable, EditorAPI } from './core/types';

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

    constructor(context: AppContext) {
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;

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
            title: this.manifest?.ui?.displayName || 'Atol',
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

    async close(): Promise<void> {
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
