import {getIcon} from "@utils/Icons.js";

/**
 * Toolbar Component
 * Navigation buttons and breadcrumb
 */
export class Toolbar {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks || {};
        this.currentPath = '/';

        this.render();
        this.setupEventListeners();

        console.log('Toolbar component initialized');
    }

    /**
     * Render toolbar HTML
     */
    render() {
        this.container.innerHTML = `
            <div class="explorer-toolbar">
                <button class="btn-back" title="Back">
                    <span>${getIcon('back', 16)}</span>
                </button>
                <button class="btn-up" title="Up">
                    <span>${getIcon('up', 16)}</span>
                </button>
                <button class="btn-refresh" title="Refresh">
                    <span>${getIcon('refresh', 16)}</span>
                </button>
                <div class="path-breadcrumb"></div>
            </div>
        `;
    }

    /**
     * Setup event listeners for button
     */
    setupEventListeners() {
        const backBtn = this.container.querySelector('.btn-back');
        const upBtn = this.container.querySelector('.btn-up');
        const refreshBtn = this.container.querySelector('.btn-refresh');

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.callbacks.onBack) {
                    this.callbacks.onBack();
                }
            });
        }

        if (upBtn) {
            upBtn.addEventListener('click', () => {
                if (this.callbacks.onUp) {
                    this.callbacks.onUp();
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.callbacks.onRefresh) {
                    this.callbacks.onRefresh();
                }
            });
        }
    }

    /**
     * Update breadcrumb display
     * @param {string} path - Current directory path
     */
    updateBreadcrumb(path) {
        this.currentPath = path;

        const breadcrumbEl = this.container.querySelector('.path-breadcrumb');
        if(!breadcrumbEl) return;

        const parts = path.split('/').filter(p => p);

        let html = `<span class="breadcrumb-item" data-path="/">${getIcon('home', 16)}</span>`;

        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath += '/' + part;
            const isLast = index === parts.length - 1;

            html += `<span class="breadcrumb-separator">/</span>`;
            html += `<span class="breadcrumb-item ${isLast ? 'active' : ''}" data-path="${currentPath}">
                ${this.escapeHtml(part)}
            </span>`;
        });

        breadcrumbEl.innerHTML = html;

        //Click listeners for breadcrumb items
        breadcrumbEl.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item => {
            item.addEventListener('click', () => {
                const targetPath = item.dataset.path;
                if (this.callbacks.onNavigate) {
                    this.callbacks.onNavigate(targetPath);
                }
            });
        });
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Cleanup
     */
    destroy() {
        console.log('Toolbar component destroyed');
    }
}