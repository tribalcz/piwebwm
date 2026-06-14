import { getIcon } from '@utils/Icons';

export interface ToolbarCallbacks {
    onBack?: () => void;
    onUp?: () => void;
    onRefresh?: () => void;
    onNavigate?: (path: string) => void;
    onHome?: () => void;
}

/**
 * Toolbar Component
 * Navigation buttons and breadcrumb
 */
export class Toolbar {
    private container: Element;
    private callbacks: ToolbarCallbacks;
    private currentPath: string;

    constructor(container: Element, callbacks?: ToolbarCallbacks) {
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
    private render(): void {
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
    private setupEventListeners(): void {
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
     */
    updateBreadcrumb(path: string): void {
        this.currentPath = path;

        const breadcrumbEl = this.container.querySelector('.path-breadcrumb');
        if (!breadcrumbEl) return;

        const parts = path.split('/').filter(p => p);

        let html = `<span class="breadcrumb-item" data-path="/home">${getIcon('home', 16)}</span>`;

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
        breadcrumbEl.querySelectorAll<HTMLElement>('.breadcrumb-item:not(.active)').forEach(item => {
            item.addEventListener('click', () => {
                const targetPath = item.dataset.path;
                if (targetPath && this.callbacks.onNavigate) {
                    this.callbacks.onNavigate(targetPath);
                }
            });
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        console.log('Toolbar component destroyed');
    }
}
