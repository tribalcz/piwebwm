import { getIcon} from "@utils/Icons.js";

export class StartMenu {
    constructor(windowManager, appManager = null) {
        this.windowManager = windowManager;
        this.appManager = appManager;
        this.menuElement = null;
        this.isOpen = false;
        this.getIcon = getIcon;

        this.initMenu();
        this.setupEventListeners();
    }

    initMenu() {
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
     * @returns {string} HTML for menu sections
     */
    renderMenuContent() {
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
        const categoryConfig = {
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
     * @param {Array} apps - Array of app manifests
     * @returns {Object} Apps grouped by category
     */
    groupByCategory(apps) {
        const groups = {};

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
     * @param {Object} manifest - App manifest
     * @returns {string} HTML for menu item
     */
    renderMenuItem(manifest) {
        const icon = this.getAppIcon(manifest);
        const badge = this.renderBadge(manifest);
        const disabled = (!manifest.enabled || manifest.status === 'soon') ? 'disabled' : '';

        return `
        <button class="menu-item ${disabled}" data-app="${manifest.id}">
            <span class="menu-icon">${icon}</span>
            <span class="menu-label">${manifest.ui?.displayName || manifest.name}</span>
            ${badge}
        </button>
    `;
    }

    /**
     * Refresh menu content (after apps are discovered)
     */
    refreshMenu() {
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
    attachMenuItemListeners() {
        if (!this.menuElement) return;

        // Handle menu item clicks
        this.menuElement.querySelectorAll('.menu-item:not(.disabled)').forEach(item => {
            // Remove old listeners (if any)
            item.replaceWith(item.cloneNode(true));
        });

        // Re-attach listeners
        this.menuElement.querySelectorAll('.menu-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', (e) => {
                const appId = e.currentTarget.dataset.app;
                this.launchApp(appId);
                this.close();
            });
        });
    }

    setupEventListeners() {
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
            if (this.isOpen && !this.menuElement.contains(e.target)) {
                this.close();
            }
        });

        // Handle footer actions
        this.menuElement.querySelectorAll('.menu-footer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleSystemAction(action);
            });
        });

        // Search functionality
        const searchInput = this.menuElement.querySelector('.start-menu-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterMenu(e.target.value);
            });
        }

        this.attachMenuItemListeners();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
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
        const searchInput = this.menuElement.querySelector('.start-menu-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    close() {
        this.menuElement.classList.remove('visible');
        this.menuElement.classList.add('hidden');
        this.isOpen = false;

        // Clear search
        const searchInput = this.menuElement.querySelector('.start-menu-search');
        if (searchInput) {
            searchInput.value = '';
            this.filterMenu('');
        }
    }

    filterMenu(query) {
        const lowerQuery = query.toLowerCase();
        const items = this.menuElement.querySelectorAll('.menu-item');

        items.forEach(item => {
            const label = item.querySelector('.menu-label').textContent.toLowerCase();
            if (label.includes(lowerQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        // Hide sections if all items are hidden
        const sections = this.menuElement.querySelectorAll('.menu-section');
        sections.forEach(section => {
            const visibleItems = section.querySelectorAll('.menu-item[style*="flex"]');
            if (visibleItems.length === 0 && query !== '') {
                section.style.display = 'none';
            } else {
                section.style.display = 'block';
            }
        });
    }

    async launchApp(appId) {
        if (!this.appManager) {
            console.error('AppManager is not available');
            return;
        }

        try{
            console.log(`Launching app: ${appId}...`);

            await this.appManager.launch(appId);

            console.log(`App ${appId} launched successfully`);
        } catch (error) {
            console.error(`Failed to launch app ${appId}:`, error);
            alert(`Failed to launch ${appId}: ${error.message}`);
        }
    }

    handleSystemAction(action) {
        switch(action) {
            case 'logout':
                if (confirm('Are you sure you want to logout?')) {
                    // Clear state and reload
                    localStorage.clear();
                    location.reload();
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
     * @param {Object} - manifets
     * @return {string} - HTML for badge
     */
    renderBadge(manifest) {
        if (!manifest.enabled || manifest.status === 'sonn') {
            return `<span class="menu-badge badge-soon">Sonn</span>`;
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
     * @param {Object} - manifest
     * @param {int} - icon size
     * @return {string|*} - icon HTML
     */
    getAppIcon(manifest, iconSize = 16) {
        const iconName = manifest.ui?.icon || 'unknown';
        return getIcon(iconName, iconSize);
    }
}