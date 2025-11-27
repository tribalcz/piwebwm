import {getIcon} from "@utils/Icons.js";

/**
 * FileList Component
 * Displays files and folders in a grid/list layout
 */
export class FileList {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks || {};
        this.files = [];
        this.selectedItems = null;

        this.render();
        this.setupEventListeners();

        console.log('FileList component initialized');
    }

    /**
     * render file list structure
     */
    render() {
        this.container.innerHTML = `
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
        `;

        this.fileListEl = this.container.querySelector('.file-list');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.fileListEl) return;

        //Single click
        this.fileListEl.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                const type = fileItem.dataset.type;
                this.handleClick(path, type);
            }
        });

        // Double click
        this.fileListEl.addEventListener('dblclick', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                const type = fileItem.dataset.type;
                this.handleDoubleClick(path, type);
            }
        });

        // Context menu
        this.fileListEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                const type = fileItem.dataset.type;
                const name = fileItem.querySelector('.file-name').textContent;

                this.selectedItem = { path, type, name };

                if (this.callbacks.onContextMenu) {
                    this.callbacks.onContextMenu(e.clientX, e.clientY, type, { path, type, name });
                }
            }
        });
    }

    /**
     * Single click
     */
    handleClick(path, type) {
        // Remove previous selection
        this.fileListEl.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked item
        const clickedItem = this.fileListEl.querySelector(`[data-path="${path}"]`);
        if (clickedItem) {
            clickedItem.classList.add('selected');
            this.selectedItem = { path, type, name: clickedItem.querySelector('.file-name').textContent };
        }

        if (this.callbacks.onClick) {
            this.callbacks.onClick(path, type);
        }
    }

    /**
     * Double click
     */
    handleDoubleClick(path, type) {
        if (this.callbacks.onDoubleClick) {
            this.callbacks.onDoubleClick(path, type);
        }
    }

    /**
     * Update file list with new files
     * @param {Array} files - Array of file objects
     */
    update(files) {
        this.files = files;
        this.renderFiles();
    }

    /**
     * Render files
     */
    renderFiles() {
        if (!this.fileListEl) return;

        if (this.files.length === 0) {
            this.fileListEl.innerHTML = '<div class="empty-folder">Empty folder</div>';
            return;
        }

        const html = this.files.map(file => this.renderFileItem(file)).join('');
        this.fileListEl.innerHTML = html;

        console.log(`Rendered ${this.files.length} files`);
    }

    /**
     * Render single file item
     * @param {Object} file - File object
     * @returns {string} HTML string
     */
    renderFileItem(file) {
        const icon = this.getFileIcon(file);
        const size = file.is_dir ? '' : this.formatSize(file.size);
        const modified = this.formatDate(file.modified);

        return `
            <div class="file-item ${file.is_dir ? 'folder' : 'file'}" 
                 data-path="${file.path}" 
                 data-type="${file.is_dir ? 'dir' : 'file'}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                <span class="file-size">${size}</span>
                <span class="file-modified">${modified}</span>
            </div>
        `;
    }

    /**
     * Get icon for file
     * @param {Object} file
     * @returns {string} Icon HTML
     */
    getFileIcon(file) {
        if (file.is_dir) {
            if (file.name === '..') return getIcon('up');
            return getIcon('file');
        }

        const ext = file.name.split('.').pop().toLowerCase();
        const iconMap = {
            'txt': 'txt',
            'md': 'md',
            'pdf': 'pdf',
            'doc': 'doc', 'docx': 'doc',
            'xls': 'xls', 'xlsx': 'xls',
            'jpg': 'jpg', 'jpeg': 'jpg', 'png': 'jpg', 'gif': 'jpg',
            'mp3': 'music', 'wav': 'music',
            'mp4': 'video', 'avi': 'video',
            'zip': 'archive', 'tar': 'archive', 'gz': 'archive',
            'sh': 'sh',
            'py': 'py',
            'js': 'js',
            'html': 'html',
            'css': 'css'
        };

        return getIcon(iconMap[ext] || 'unknown');
    }

    /**
     * Format file size
     * @param {number} bytes
     * @returns {string}
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format date
     * @param {number} timestamp
     * @returns {string}
     */
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

    /**
     * Escape HTML
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get selected item
     * @returns {Object|null}
     */
    getSelectedItem() {
        return this.selectedItem;
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.fileListEl.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.selectedItem = null;
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (this.fileListEl) {
            this.fileListEl.innerHTML = '<div class="loading">Loading...</div>';
        }
    }

    /**
     * Show error
     * @param {string} message
     */
    showError(message) {
        if (this.fileListEl) {
            this.fileListEl.innerHTML = `
                <div class="error-message">
                    <span style="font-size: 48px;">⚠️</span>
                    <p>Error: ${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        console.log('FileList component destroyed');
    }
}