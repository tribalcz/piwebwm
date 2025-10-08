export class FileExplorer {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.currentPath = '/home';
        this.files = [];
        this.windowId = null;
    }

    async open() {
        this.windowId = await new Promise((resolve) => {
            const id = this.windowManager.createWindow({
                title: 'File Explorer',
                x: 150,
                y: 100,
                width: 700,
                height: 500,
                content: this.renderSkeleton(),
                persistent: false,
                onCreated: (windowId, windowEl) => {
                    console.log('Window created callback:', windowId);
                    this.windowId = windowId;
                    resolve(windowId);
                }
            });
        });

        console.log('Setting up event listeners for:', this.windowId);
        this.setupEventListeners();
        await this.navigate(this.currentPath);
    }

    renderSkeleton() {
        return `
            <div class="file-explorer">
                <div class="explorer-toolbar">
                    <button class="btn-back" title="Back">
                        <span>←</span>
                    </button>
                    <button class="btn-up" title="Up">
                        <span>↑</span>
                    </button>
                    <button class="btn-refresh" title="Refresh">
                        <span>🔄</span>
                    </button>
                    <div class="path-breadcrumb"></div>
                </div>
                
                <div class="explorer-content">
                    <div class="file-list-header">
                        <span class="col-name">Name</span>
                        <span class="col-size">Size</span>
                        <span class="col-modified">Modified</span>
                    </div>
                    <div class="file-list">
                        <div class="loading">Loading...</div>
                    </div>
                </div>
                
                <div class="explorer-statusbar">
                    <span class="status-text">Ready</span>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const windowEl = document.querySelector(`[data-id="${this.windowId}"]`);
        if (!windowEl) {
            console.error('Window element not found:', this.windowId);
            return;
        }

        const backBtn = windowEl.querySelector('.btn-back');
        const upBtn = windowEl.querySelector('.btn-up');
        const refreshBtn = windowEl.querySelector('.btn-refresh');
        const fileList = windowEl.querySelector('.file-list');

        if (!backBtn || !upBtn || !refreshBtn || !fileList) {
            console.error('Some elements not found in window');
            return;
        }

        // Back button
        backBtn.addEventListener('click', () => {
            console.log('Back clicked');
            this.navigateBack();
        });

        // Up button
        upBtn.addEventListener('click', () => {
            console.log('Up clicked');
            this.navigateUp();
        });

        // Refresh button
        refreshBtn.addEventListener('click', () => {
            console.log('Refresh clicked');
            this.navigate(this.currentPath);
        });

        // File list clicks (delegation)
        fileList.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                const type = fileItem.dataset.type;
                console.log('File clicked:', path, type);
                this.handleFileClick(path, type);
            }
        });

        // Double click for opening
        fileList.addEventListener('dblclick', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                const type = fileItem.dataset.type;
                console.log('File double-clicked:', path, type);
                this.handleFileDoubleClick(path, type);
            }
        });

        console.log('Event listeners attached');
    }

    async navigate(path) {
        console.log('Navigating to:', path);
        this.setStatus('Loading...');

        try {
            const url = `/api/files/list?path=${encodeURIComponent(path)}`;
            console.log('Fetching:', url);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Received data:', data);

            this.currentPath = data.path;
            this.files = data.files;

            console.log('Rendering file list...');
            this.renderFileList();
            this.updateBreadcrumb();
            this.setStatus(`${this.files.length} items`);
        } catch (error) {
            console.error('Failed to load directory:', error);
            this.setStatus('Error loading directory');
            this.renderError(error.message);
        }
    }

    renderFileList() {
        const windowEl = document.querySelector(`[data-id="${this.windowId}"]`);
        if (!windowEl) {
            console.error('Window not found for rendering');
            return;
        }

        const fileListEl = windowEl.querySelector('.file-list');
        if (!fileListEl) {
            console.error('File list element not found');
            return;
        }

        console.log('Rendering', this.files.length, 'files');

        if (this.files.length === 0) {
            fileListEl.innerHTML = '<div class="empty-folder">Empty folder</div>';
            return;
        }

        const html = this.files.map(file => {
            const icon = this.getFileIcon(file);
            const size = file.type === 'dir' ? '' : this.formatSize(file.size);
            const modified = this.formatDate(file.modified);

            return `
            <div class="file-item ${file.type === 'dir' ? 'folder' : 'file'}" 
                 data-path="${file.path}" 
                 data-type="${file.type}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                <span class="file-size">${size}</span>
                <span class="file-modified">${modified}</span>
            </div>
        `;
        }).join('');

        fileListEl.innerHTML = html;
        console.log('File list rendered successfully');
    }

    renderError(message) {
        const windowEl = document.querySelector(`[data-id="${this.windowId}"]`);
        if (!windowEl) return;

        const fileListEl = windowEl.querySelector('.file-list');
        if (fileListEl) {
            fileListEl.innerHTML = `
                <div class="error-message">
                    <span style="font-size: 48px;">⚠️</span>
                    <p>Error: ${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    updateBreadcrumb() {
        const windowEl = document.querySelector(`[data-id="${this.windowId}"]`);
        if (!windowEl) return;

        const breadcrumbEl = windowEl.querySelector('.path-breadcrumb');
        if (!breadcrumbEl) return;

        const parts = this.currentPath.split('/').filter(p => p);

        let html = '<span class="breadcrumb-item" data-path="/">🏠</span>';
        let currentPath = '';

        parts.forEach((part, index) => {
            currentPath += '/' + part;
            const isLast = index === parts.length - 1;
            html += `<span class="breadcrumb-separator">/</span>`;
            html += `<span class="breadcrumb-item ${isLast ? 'active' : ''}" data-path="${currentPath}">${this.escapeHtml(part)}</span>`;
        });

        breadcrumbEl.innerHTML = html;

        // Add click listeners to breadcrumb items
        breadcrumbEl.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                this.navigate(path);
            });
        });
    }

    handleFileClick(path, type) {
        // Single click - just select (visual feedback)
        const windowEl = document.querySelector(`[data-id="${this.windowId}"]`);
        if (!windowEl) return;

        // Remove previous selection
        windowEl.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked item
        const clickedItem = windowEl.querySelector(`[data-path="${path}"]`);
        if (clickedItem) {
            clickedItem.classList.add('selected');
        }
    }

    async handleFileDoubleClick(path, type) {
        if (type === 'dir') {
            // Navigate into directory
            await this.navigate(path);
        } else {
            // Open file (for now, just text files)
            await this.openFile(path);
        }
    }

    async openFile(path) {
        this.setStatus('Opening file...');

        try {
            const response = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Create a new window with file content
            this.windowManager.createWindow({
                title: path.split('/').pop(),
                x: 200,
                y: 150,
                width: 600,
                height: 400,
                content: `
                    <div class="file-viewer">
                        <div class="file-viewer-toolbar">
                            <span>📄 ${this.escapeHtml(path)}</span>
                        </div>
                        <pre class="file-content">${this.escapeHtml(data.content)}</pre>
                    </div>
                `
            });

            this.setStatus('Ready');
        } catch (error) {
            console.error('Failed to open file:', error);
            this.setStatus('Error opening file');
            alert('Failed to open file: ' + error.message);
        }
    }

    navigateUp() {
        if (this.currentPath === '/' || this.currentPath === '/home') {
            return; // Already at root
        }

        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop(); // Remove last part
        const newPath = '/' + parts.join('/');
        this.navigate(newPath || '/home');
    }

    navigateBack() {
        // Simple implementation - could be enhanced with history stack
        this.navigateUp();
    }

    setStatus(text) {
        const windowEl = document.querySelector(`[data-id="${this.windowId}"]`);
        if (!windowEl) return;

        const statusEl = windowEl.querySelector('.status-text');
        if (statusEl) {
            statusEl.textContent = text;
        }
    }

    getFileIcon(file) {
        if (file.type === 'dir') {
            if (file.name === '..') return '⬆️';
            return '📁';
        }

        const ext = file.name.split('.').pop().toLowerCase();
        const iconMap = {
            'txt': '📄',
            'md': '📝',
            'pdf': '📕',
            'doc': '📘',
            'docx': '📘',
            'xls': '📗',
            'xlsx': '📗',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'mp3': '🎵',
            'wav': '🎵',
            'mp4': '🎬',
            'avi': '🎬',
            'zip': '🗜️',
            'tar': '🗜️',
            'gz': '🗜️',
            'sh': '⚙️',
            'py': '🐍',
            'js': '📜',
            'html': '🌐',
            'css': '🎨',
        };

        return iconMap[ext] || '📄';
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today ' + date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return diffDays + ' days ago';
        } else {
            return date.toLocaleDateString('cs-CZ');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}