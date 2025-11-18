import { ContextMenu } from '@components/ContextMenu.js';
import { ClipboardManager } from '@utils/Clipboard.js';
import { PropertiesDialog } from '@components/PropertiesDialog.js';
import { getIcon } from '@utils/Icons.js';

// Import new components
import { Toolbar } from './components/Toolbar.js';
import { FileList } from './components/FileList.js';
import { StatusBar } from './components/StatusBar.js';
import { FileOperations } from './utils/FileOperations.js';

/**
 * File Explorer - Browse and manage files and folders
 * Modular architecture with separated components
 */
export default class FileExplorer {
    constructor(context) {
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

    async init() {
        console.log('File Explorer init');
    }

    async open() {
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

    onWindowCreated(id, windowEl) {
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

    renderSkeleton() {
        return `
            <div class="file-explorer">
                <div id="toolbar-container"></div>
                <div id="filelist-container"></div>
                <div id="statusbar-container"></div>
            </div>
        `;
    }

    initializeComponents(windowEl) {
        const toolbarContainer = windowEl.querySelector('#toolbar-container');
        const fileListContainer = windowEl.querySelector('#filelist-container');
        const statusBarContainer = windowEl.querySelector('#statusbar-container');

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

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const activeWindow = document.querySelector('.window.active');
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

    async navigate(path) {
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
            this.components.statusBar?.showError(error.message);
            this.components.fileList?.showError(error.message);
        }
    }

    navigateUp() {
        if (this.currentPath === '/' || this.currentPath === '/home') {
            return;
        }

        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop();
        const newPath = '/' + parts.join('/');
        this.navigate(newPath || '/home');
    }

    handleFileClick(path, type) {
        // Selection is handled by FileList component
        console.log('File clicked:', path, type);
    }

    async handleFileDoubleClick(path, type) {
        console.log('File double-clicked:', path, type);

        if (type === 'dir') {
            await this.navigate(path);
        } else {
            await this.openFile(path);
        }
    }

    async openFile(path) {
        this.components.statusBar?.setStatus('Opening file...');

        try {
            const content = await FileOperations.readFile(path);

            this.windowManager.createWindow({
                title: path.split('/').pop(),
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
            alert('Failed to open file: ' + error.message);
        }
    }

    showContextMenu(x, y, type, selectedItem) {
        const items = this.buildContextMenuItems(type, selectedItem);
        console.log('Context menu items:', items);
        console.log('Selected item:', selectedItem);
        console.log('Context menu type:', type);
        console
        this.contextMenu.show(x, y, items);
    }

    buildContextMenuItems(type, selectedItem) {
        const items = [];

        if (type === 'dir') {
            items.push(
                { icon: getIcon('newFile', 18), label: 'New File', handler: () => this.contextNewFile() },
                { icon: getIcon('newDir', 18), label: 'New Folder', handler: () => this.contextNewFolder() },
                { separator: true },
                { icon: getIcon('openDir', 18), label: 'Open', handler: () => this.contextOpen(selectedItem) }
            );
        } else {
            items.push(
                { icon: getIcon('openFile', 18), label: 'Open', handler: () => this.contextOpen(selectedItem) }
            );
        }

        items.push(
            { separator: true },
            { icon: getIcon('rename', 18), label: 'Rename', handler: () => this.contextRename(selectedItem), shortcut: 'F2' },
            { icon: getIcon('copy', 18), label: 'Copy', handler: () => this.contextCopy(selectedItem), shortcut: 'Ctrl+C' },
            { icon: getIcon('cut', 18), label: 'Cut', handler: () => this.contextCut(selectedItem), shortcut: 'Ctrl+X' },
            { separator: true },
            { icon: getIcon('delete', 18), label: 'Delete', handler: () => this.contextDelete(selectedItem), shortcut: 'Del' },
            { separator: true },
            { icon: getIcon('welcome', 18), label: 'Properties', handler: () => this.contextProperties(selectedItem) },
            { separator: true },
            { icon: getIcon('refresh', 18), label: 'Refresh', handler: () => this.navigate(this.currentPath), shortcut: 'F5' }
        );

        return items;
    }

    contextOpen(item) {
        if (!item) return;

        if (item.type === 'dir') {
            this.navigate(item.path);
        } else {
            this.openFile(item.path);
        }
    }

    contextCopy(item) {
        if (!item) return;

        this.clipboard.copy(item);
        this.components.statusBar?.setStatus(`Copied: ${item.name}`);
    }

    contextCut(item) {
        if (!item) return;

        this.clipboard.cut(item);
        this.components.statusBar?.setStatus(`Cut: ${item.name}`);
    }

    async contextPaste() {
        if (this.clipboard.isEmpty()) return;

        this.components.statusBar?.setStatus('Pasting...');

        try {
            await this.clipboard.paste(this.currentPath, async () => {
                await this.navigate(this.currentPath);
                this.components.statusBar?.showReady();
            });
        } catch (error) {
            console.error('Failed to paste:', error);
            alert('Failed to paste: ' + error.message);
            this.components.statusBar?.showError('Paste failed');
        }
    }

    async contextDelete(item) {
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
            alert('Failed to delete: ' + error.message);
            this.components.statusBar?.showError('Delete failed');
        }
    }

    async contextRename(item) {
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
            alert('Failed to rename: ' + error.message);
            this.components.statusBar?.showError('Rename failed');
        }
    }

    async contextNewFile() {
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
            alert('Failed to create file: ' + error.message);
            this.components.statusBar?.showError('Create failed');
        }
    }

    async contextNewFolder() {
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
            alert('Failed to create folder: ' + error.message);
            this.components.statusBar?.showError('Create failed');
        }
    }

    async contextProperties(item) {
        if (!item) return;

        try {
            const fileInfo = await FileOperations.getFileInfo(item.path);
            PropertiesDialog.show(this.windowManager, fileInfo);
        } catch (error) {
            console.error('Failed to get file info:', error);
            alert('Failed to get file properties');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async close() {
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
                appId: this.manifest.id
            });
        }

        console.log('File Explorer closed');
    }
}