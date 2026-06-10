import { ContextMenu, type ContextMenuItem } from '@components/ContextMenu';
import { ClipboardManager } from '@utils/Clipboard';
import { PropertiesDialog } from '@components/PropertiesDialog';
import { getIcon } from '@utils/Icons';
import type { AppContext, AppManifest, WebDeskApp } from '@core/types';
import type { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';

// Import new components
import { Toolbar } from './components/Toolbar';
import { FileList, type SelectedFileItem } from './components/FileList';
import { StatusBar } from './components/StatusBar';
import { FileOperations } from './utils/FileOperations';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * File Explorer - Browse and manage files and folders
 * Modular architecture with separated components
 */
export default class FileExplorer implements WebDeskApp {
    private context: AppContext;
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private store: Store | null;
    private manifest: AppManifest;

    private currentPath: string;
    private windowId: string | null;

    private components: {
        toolbar: Toolbar | null;
        fileList: FileList | null;
        statusBar: StatusBar | null;
    };

    private contextMenu: ContextMenu;
    private clipboard: ClipboardManager;

    constructor(context: AppContext) {
        this.context = context;
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;

        this.currentPath = '/home';
        this.windowId = null;

        // Components
        this.components = {
            toolbar: null,
            fileList: null,
            statusBar: null
        };

        // UI helpers
        this.contextMenu = new ContextMenu();
        this.clipboard = new ClipboardManager();

        console.log('File Explorer initialized');
    }

    async init(): Promise<void> {
        console.log('File Explorer init');
    }

    async open(): Promise<void> {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: this.manifest?.ui?.displayName || 'File Explorer',
            x: 150 + (windowCount * 25),
            y: 100 + (windowCount * 25),
            width: this.manifest?.window?.defaultWidth || 700,
            height: this.manifest?.window?.defaultHeight || 500,
            content: this.renderSkeleton(),
            persistent: this.manifest?.window?.persistent || false,
            onCreated: (windowId, windowEl) => this.onWindowCreated(windowId, windowEl)
        });

        console.log('File Explorer opened, windowId:', this.windowId);
    }

    private onWindowCreated(id: string, windowEl: HTMLElement): void {
        this.windowId = id;

        // Emit app:opened event with windowId
        if (this.eventBus) {
            this.eventBus.emit('app:opened', {
                appId: this.manifest.id,
                windowId: this.windowId
            });
        }

        // Initialize components
        this.initializeComponents(windowEl);

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Load initial directory
        this.navigate(this.currentPath);
    }

    private renderSkeleton(): string {
        return `
            <div class="file-explorer">
                <div class="explorer-toolbar" id="toolbar-container"></div>
                <div class="explorer-content" id="filelist-container"></div>
                <div class="explorer-statusbar" id="statusbar-container"></div>
            </div>
        `;
    }

    private initializeComponents(windowEl: HTMLElement): void {
        const toolbarContainer = windowEl.querySelector('#toolbar-container');
        const fileListContainer = windowEl.querySelector('#filelist-container');
        const statusBarContainer = windowEl.querySelector('#statusbar-container');

        if (!toolbarContainer || !fileListContainer || !statusBarContainer) {
            console.error('File Explorer containers not found in window');
            return;
        }

        // Initialize Toolbar
        this.components.toolbar = new Toolbar(toolbarContainer, {
            onBack: () => this.navigateUp(),
            onUp: () => this.navigateUp(),
            onRefresh: () => this.navigate(this.currentPath),
            onNavigate: (path) => this.navigate(path),
            onHome: () => this.navigate('/home')
        });

        // Initialize FileList
        this.components.fileList = new FileList(fileListContainer, {
            onClick: (path, type) => this.handleFileClick(path, type),
            onDoubleClick: (path, type) => this.handleFileDoubleClick(path, type),
            onContextMenu: (x, y, type, item) => this.showContextMenu(x, y, type, item)
        });

        // Initialize StatusBar
        this.components.statusBar = new StatusBar(statusBarContainer);

        console.log('File Explorer components initialized');
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            const activeWindow = document.querySelector<HTMLElement>('.window.active');
            if (!activeWindow || activeWindow.dataset.id !== this.windowId) {
                return;
            }

            const selectedItem = this.components.fileList?.getSelectedItem();

            // Ctrl+C - Copy
            if (e.ctrlKey && e.key === 'c' && selectedItem) {
                e.preventDefault();
                this.contextCopy(selectedItem);
            }

            // Ctrl+X - Cut
            if (e.ctrlKey && e.key === 'x' && selectedItem) {
                e.preventDefault();
                this.contextCut(selectedItem);
            }

            // Ctrl+V - Paste
            if (e.ctrlKey && e.key === 'v' && !this.clipboard.isEmpty()) {
                e.preventDefault();
                this.contextPaste();
            }

            // Delete
            if (e.key === 'Delete' && selectedItem) {
                e.preventDefault();
                this.contextDelete(selectedItem);
            }

            // F2 - Rename
            if (e.key === 'F2' && selectedItem) {
                e.preventDefault();
                this.contextRename(selectedItem);
            }
        });
    }

    async navigate(path: string): Promise<void> {
        console.log('Navigating to:', path);

        this.components.statusBar?.showLoading();
        this.components.fileList?.showLoading();

        try {
            const data = await FileOperations.listFiles(path);

            this.currentPath = data.path;

            // Update components
            this.components.toolbar?.updateBreadcrumb(this.currentPath);
            this.components.fileList?.update(data.files);
            this.components.statusBar?.showItemCount(data.files.length);

            console.log(`Loaded ${data.files.length} items from ${this.currentPath}`);
        } catch (error) {
            console.error('Failed to navigate:', error);
            this.components.statusBar?.showError(errorMessage(error));
            this.components.fileList?.showError(errorMessage(error));
        }
    }

    navigateUp(): void {
        if (this.currentPath === '/' || this.currentPath === '/home') {
            return;
        }

        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop();
        const newPath = '/' + parts.join('/');
        this.navigate(newPath || '/home');
    }

    private handleFileClick(path: string, type: string): void {
        // Selection is handled by FileList component
        console.log('File clicked:', path, type);
    }

    private async handleFileDoubleClick(path: string, type: string): Promise<void> {
        console.log('File double-clicked:', path, type);

        if (type === 'dir') {
            await this.navigate(path);
        } else {
            await this.openFile(path);
        }
    }

    private async openFile(path: string): Promise<void> {
        this.components.statusBar?.setStatus('Opening file...');

        try {
            const content = await FileOperations.readFile(path);

            this.windowManager.createWindow({
                title: path.split('/').pop() || path,
                x: 200,
                y: 150,
                width: 600,
                height: 400,
                content: `
                    <div class="file-viewer">
                        <div class="file-viewer-toolbar">
                            <span>${getIcon('txt')} ${this.escapeHtml(path)}</span>
                        </div>
                        <pre class="file-content">${this.escapeHtml(content)}</pre>
                    </div>
                `
            });

            this.components.statusBar?.showReady();
        } catch (error) {
            console.error('Failed to open file:', error);
            this.components.statusBar?.showError('Failed to open file');
            alert('Failed to open file: ' + errorMessage(error));
        }
    }

    private showContextMenu(x: number, y: number, type: string, selectedItem: SelectedFileItem | null): void {
        const items = this.buildContextMenuItems(type, selectedItem);
        this.contextMenu.show(x, y, items);
    }

    private buildContextMenuItems(type: string, selectedItem: SelectedFileItem | null): ContextMenuItem[] {
        const items: ContextMenuItem[] = [];

        if (type === 'dir') {
            items.push(
                { icon: getIcon('newFile', 18), label: 'New File', action: 'new-file', handler: () => this.contextNewFile() },
                { icon: getIcon('newDir', 18), label: 'New Folder', action: 'new-folder', handler: () => this.contextNewFolder() },
                { separator: true },
                { icon: getIcon('openDir', 18), label: 'Open', action: 'open', handler: () => this.contextOpen(selectedItem) }
            );
        } else {
            items.push(
                { icon: getIcon('openFile', 18), label: 'Open', action: 'open', handler: () => this.contextOpen(selectedItem) }
            );
        }

        items.push(
            { separator: true },
            { icon: getIcon('rename', 18), label: 'Rename', action: 'rename', handler: () => this.contextRename(selectedItem), shortcut: 'F2' },
            { icon: getIcon('copy', 18), label: 'Copy', action: 'copy', handler: () => this.contextCopy(selectedItem), shortcut: 'Ctrl+C' },
            { icon: getIcon('cut', 18), label: 'Cut', action: 'cut', handler: () => this.contextCut(selectedItem), shortcut: 'Ctrl+X' },
            { icon: getIcon('paste', 18), label: 'Paste', action: 'paste', handler: () => this.contextPaste(), shortcut: 'Ctrl+V' },
            { separator: true },
            { icon: getIcon('delete', 18), label: 'Delete', action: 'delete', handler: () => this.contextDelete(selectedItem), shortcut: 'Del' },
            { separator: true },
            { icon: getIcon('welcome', 18), label: 'Properties', action: 'properties', handler: () => this.contextProperties(selectedItem) },
            { separator: true },
            { icon: getIcon('refresh', 18), label: 'Refresh', action: 'refresh', handler: () => this.navigate(this.currentPath), shortcut: 'F5' }
        );

        return items;
    }

    private contextOpen(item: SelectedFileItem | null): void {
        if (!item) return;

        if (item.type === 'dir') {
            this.navigate(item.path);
        } else {
            this.openFile(item.path);
        }
    }

    private contextCopy(item: SelectedFileItem | null): void {
        if (!item) return;

        this.clipboard.copy(item);
        this.components.statusBar?.setStatus(`Copied: ${item.name}`);
    }

    private contextCut(item: SelectedFileItem | null): void {
        if (!item) return;

        this.clipboard.cut(item);
        this.components.statusBar?.setStatus(`Cut: ${item.name}`);
    }

    private async contextPaste(): Promise<void> {
        if (this.clipboard.isEmpty()) return;

        this.components.statusBar?.setStatus('Pasting...');

        try {
            await this.clipboard.paste(this.currentPath, async () => {
                await this.navigate(this.currentPath);
                this.components.statusBar?.showReady();
            });
        } catch (error) {
            console.error('Failed to paste:', error);
            alert('Failed to paste: ' + errorMessage(error));
            this.components.statusBar?.showError('Paste failed');
        }
    }

    private async contextDelete(item: SelectedFileItem | null): Promise<void> {
        if (!item) return;

        const confirmMsg = item.type === 'dir'
            ? `Delete folder "${item.name}" and all its contents?`
            : `Delete file "${item.name}"?`;

        if (!confirm(confirmMsg)) return;

        this.components.statusBar?.setStatus('Deleting...');

        try {
            await FileOperations.deleteFile(item.path);
            await this.navigate(this.currentPath);
            this.components.statusBar?.showReady();
        } catch (error) {
            console.error('Failed to delete:', error);
            alert('Failed to delete: ' + errorMessage(error));
            this.components.statusBar?.showError('Delete failed');
        }
    }

    private async contextRename(item: SelectedFileItem | null): Promise<void> {
        if (!item) return;

        const newName = prompt(`Rename "${item.name}" to:`, item.name);
        if (!newName || newName === item.name) return;

        this.components.statusBar?.setStatus('Renaming...');

        try {
            await FileOperations.rename(item.path, newName);
            await this.navigate(this.currentPath);
            this.components.statusBar?.showReady();
        } catch (error) {
            console.error('Failed to rename:', error);
            alert('Failed to rename: ' + errorMessage(error));
            this.components.statusBar?.showError('Rename failed');
        }
    }

    private async contextNewFile(): Promise<void> {
        const fileName = prompt('Enter file name:');
        if (!fileName) return;

        const filePath = `${this.currentPath}/${fileName}`;

        this.components.statusBar?.setStatus('Creating file...');

        try {
            await FileOperations.createFile(filePath);
            await this.navigate(this.currentPath);
            this.components.statusBar?.showReady();
        } catch (error) {
            console.error('Failed to create file:', error);
            alert('Failed to create file: ' + errorMessage(error));
            this.components.statusBar?.showError('Create failed');
        }
    }

    private async contextNewFolder(): Promise<void> {
        const folderName = prompt('Enter folder name:');
        if (!folderName) return;

        const folderPath = `${this.currentPath}/${folderName}`;

        this.components.statusBar?.setStatus('Creating folder...');

        try {
            await FileOperations.createFolder(folderPath);
            await this.navigate(this.currentPath);
            this.components.statusBar?.showReady();
        } catch (error) {
            console.error('Failed to create folder:', error);
            alert('Failed to create folder: ' + errorMessage(error));
            this.components.statusBar?.showError('Create failed');
        }
    }

    private async contextProperties(item: SelectedFileItem | null): Promise<void> {
        if (!item) return;

        try {
            const fileInfo = await FileOperations.getFileInfo(item.path);
            PropertiesDialog.show(this.windowManager, fileInfo);
        } catch (error) {
            console.error('Failed to get file info:', error);
            alert('Failed to get file properties');
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async close(): Promise<void> {
        // Destroy components
        Object.values(this.components).forEach(component => {
            if (component && component.destroy) {
                component.destroy();
            }
        });

        // Close window
        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }

        // Emit app:closed event
        if (this.eventBus) {
            this.eventBus.emit('app:closed', {
                appId: this.manifest.id,
                timestamp: Date.now()
            });
        }

        console.log('File Explorer closed');
    }
}
