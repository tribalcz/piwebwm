import { getIcon } from '@utils/Icons';
import { logout } from '@core/AuthGate';
import type { WindowManager } from '@core/WindowManager';
import type { AppManager } from '@core/AppManager';
import type { AppManifest } from '@core/types';

export class StartMenu {
    private windowManager: WindowManager;
    private appManager: AppManager | null;
    private menuElement!: HTMLDivElement;
    private isOpen: boolean;
    private getIcon: typeof getIcon;

    constructor(windowManager: WindowManager, appManager: AppManager | null = null) {
        this.windowManager = windowManager;
        this.appManager = appManager;
        this.isOpen = false;
        this.getIcon = getIcon;

        this.initMenu();
        this.setupEventListeners();
    }

    private initMenu(): void {
        const menu = document.createElement('div');
        menu.id = 'start-menu';
        menu.className = 'start-menu hidden';

        menu.innerHTML = `
            <div class="start-menu-header">
                <input type="text" class="start-menu-search" placeholder="Search applications..." />
            </div>

            <div class="start-menu-content">
                ${this.renderMenuContent()}
            </div>

            <div class="start-menu-footer">
                <button class="menu-footer-item" data-action="logout">
                    <span>${getIcon('logout', 16)}</span> Logout
                </button>
                <button class="menu-footer-item" data-action="restart">
                    <span>${getIcon('restart', 16)}</span> Restart
                </button>
                <button class="menu-footer-item" data-action="shutdown">
                    <span>${getIcon('shutdown', 16)}</span> Shutdown
                </button>
            </div>
        `;

        document.body.appendChild(menu);
        this.menuElement = menu;
    }

    /**
     * Render menu content from AppRegistry
     */
    private renderMenuContent(): string {
        if (!this.appManager || !this.appManager.registry) {
            return '<div class="menu-section"><div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">No apps available</div></div>';
        }

        const apps = this.appManager.registry.getAll();

        if (apps.length === 0) {
            return '<div class="menu-section"><div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">No apps registered</div></div>';
        }

        // Group apps by category
        const categories = this.groupByCategory(apps);

        // Render each category
        let html = '';

        // Category order and titles
        const categoryConfig: Record<string, string> = {
            'applications': 'Applications',
            'system': 'System',
            'utilities': 'Utilities',
            'about': 'About',
            'other': 'Other'
        };

        Object.entries(categoryConfig).forEach(([categoryId, categoryTitle]) => {
            const categoryApps = categories[categoryId];

            if (categoryApps && categoryApps.length > 0) {
                html += `
                <div class="menu-section" data-category="${categoryId}">
                    <div class="menu-section-title">${categoryTitle}</div>
                    ${categoryApps.map(app => this.renderMenuItem(app)).join('')}
                </div>
            `;

                // Add separator between sections (except after last section)
                if (categoryId !== 'other') {
                    html += '<div class="menu-separator"></div>';
                }
            }
        });

        return html;
    }

    /**
     * Group apps by category
     */
    private groupByCategory(apps: AppManifest[]): Record<string, AppManifest[]> {
        const groups: Record<string, AppManifest[]> = {};

        apps.forEach(app => {
            const category = app.ui?.category || 'other';

            if (!groups[category]) {
                groups[category] = [];
            }

            groups[category].push(app);
        });

        return groups;
    }

    /**
     * Render single menu item
     */
    private renderMenuItem(manifest: AppManifest): string {
        const icon = this.getAppIcon(manifest);
        const badge = this.renderBadge(manifest);
        const disabled = (!manifest.enabled || manifest.status === 'soon') ? 'disabled' : '';

        const displayName = manifest.ui?.displayName || manifest.name;
        const description = manifest.description || '';
        const keywords = (manifest.ui?.keywords || []).join(' ');
        const name = manifest.name || '';

        return `
        <button class="menu-item ${disabled}"
                data-app="${manifest.id}"
                data-name="${this.escapeHtml(name)}"
                data-display-name="${this.escapeHtml(displayName)}"
                data-description="${this.escapeHtml(description)}"
                data-keywords="${this.escapeHtml(keywords)}">
                <span class="menu-icon">${icon}</span>
                <span class="menu-label">${manifest.ui?.displayName || manifest.name}</span>
                ${badge}
        </button>
    `;
    }

    /**
     * Refresh menu content (after apps are discovered)
     */
    refreshMenu(): void {
        if (!this.menuElement) return;

        const contentEl = this.menuElement.querySelector('.start-menu-content');
        if (contentEl) {
            contentEl.innerHTML = this.renderMenuContent();

            // Re-attach event listeners for new menu items
            this.attachMenuItemListeners();
        }

        console.log('StartMenu refreshed with apps from registry');
    }

    /**
     * Attach event listeners to menu items
     */
    private attachMenuItemListeners(): void {
        if (!this.menuElement) return;

        // Handle menu item clicks
        this.menuElement.querySelectorAll('.menu-item:not(.disabled)').forEach(item => {
            // Remove old listeners (if any)
            item.replaceWith(item.cloneNode(true));
        });

        // Re-attach listeners
        this.menuElement.querySelectorAll<HTMLElement>('.menu-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                const appId = item.dataset.app;
                if (!appId) return;

                this.launchApp(appId);
                this.close();
            });
        });
    }

    private setupEventListeners(): void {
        // Toggle menu on start button click
        const startButton = document.getElementById('startBtn');
        if (startButton) {
            startButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && e.target instanceof Node && !this.menuElement.contains(e.target)) {
                this.close();
            }
        });

        // Handle footer actions
        this.menuElement.querySelectorAll<HTMLElement>('.menu-footer-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleSystemAction(action);
            });
        });

        // Search functionality
        const searchInput = this.menuElement.querySelector<HTMLInputElement>('.start-menu-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.filterMenu(searchInput.value);
            });
        }

        this.attachMenuItemListeners();
    }

    toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open(): void {
        this.menuElement.classList.remove('hidden');
        this.menuElement.classList.add('visible');
        this.isOpen = true;

        // Position menu above taskbar
        const startButton = document.getElementById('startBtn');
        if (startButton) {
            const rect = startButton.getBoundingClientRect();
            this.menuElement.style.left = `${rect.left}px`;
            this.menuElement.style.bottom = `${window.innerHeight - rect.top + 5}px`;
        }

        // Focus search input
        const searchInput = this.menuElement.querySelector<HTMLInputElement>('.start-menu-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    close(): void {
        this.menuElement.classList.remove('visible');
        this.menuElement.classList.add('hidden');
        this.isOpen = false;

        // Clear search
        const searchInput = this.menuElement.querySelector<HTMLInputElement>('.start-menu-search');
        if (searchInput) {
            searchInput.value = '';
            this.filterMenu('');
        }
    }

    filterMenu(query: string): void {
        const lowerQuery = query.toLowerCase().trim();
        const items = this.menuElement.querySelectorAll<HTMLElement>('.menu-item');

        items.forEach(item => {
            const displayName = (item.dataset.displayName || '').toLowerCase();
            const name = (item.dataset.name || '').toLowerCase();
            const description = (item.dataset.description || '').toLowerCase();
            const keywords = (item.dataset.keywords || '').toLowerCase();
            const appId = (item.dataset.app || '').toLowerCase();

            const matches =
                displayName.includes(lowerQuery) ||
                name.includes(lowerQuery) ||
                description.includes(lowerQuery) ||
                keywords.includes(lowerQuery) ||
                appId.includes(lowerQuery);

            if (matches) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async launchApp(appId: string): Promise<void> {
        if (!this.appManager) {
            console.error('AppManager is not available');
            return;
        }

        try {
            console.log(`Launching app: ${appId}...`);

            await this.appManager.launch(appId);

            console.log(`App ${appId} launched successfully`);
        } catch (error) {
            console.error(`Failed to launch app ${appId}:`, error);
            const message = error instanceof Error ? error.message : String(error);
            alert(`Failed to launch ${appId}: ${message}`);
        }
    }

    private handleSystemAction(action: string | undefined): void {
        switch (action) {
            case 'logout':
                if (confirm('Are you sure you want to logout?')) {
                    // End the server session, clear local state, then reload
                    // back to the login screen.
                    void logout().finally(() => {
                        localStorage.clear();
                        location.reload();
                    });
                }
                break;

            case 'restart':
                if (confirm('Are you sure you want to restart?')) {
                    alert('Restart simulation - page will reload');
                    location.reload();
                }
                break;

            case 'shutdown':
                if (confirm('Are you sure you want to shutdown?')) {
                    // Show shutdown screen
                    document.body.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center;
                                    height: 100vh; background: #1a1a1a; color: white;
                                    font-family: sans-serif; flex-direction: column; gap: 20px;">
                            <h1 style="font-size: 48px;">⏻</h1>
                            <h2>System Shutdown</h2>
                            <p style="color: #888;">You can close this tab now</p>
                        </div>
                    `;
                }
                break;
        }

        this.close();
    }

    /**
     * Render badge based on app status
     */
    private renderBadge(manifest: AppManifest): string {
        if (!manifest.enabled || manifest.status === 'soon') {
            return `<span class="menu-badge badge-soon">Soon</span>`;
        }

        if (manifest.status === 'beta') {
            return `<span class="menu-badge badge-beta">Beta</span>`;
        }

        if (manifest.status === 'alpha') {
            return `<span class="menu-badge badge-alpha">Alpha</span>`;
        }

        return '';
    }

    /**
     * Get app icon from manifest
     */
    private getAppIcon(manifest: AppManifest, iconSize: number = 16): string {
        const iconName = manifest.ui?.icon || 'unknown';
        return getIcon(iconName, iconSize);
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
