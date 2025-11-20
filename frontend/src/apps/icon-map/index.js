import { ContextMenu } from '@components/ContextMenu.js';
import { getIcon } from '@utils/Icons.js';

import { SearchBar } from './components/SearchBar.js';
import { IconGrid } from './components/IconGrid.js';

/**
 * Icon Map - Browse and search system icons
 * Modular architecture with SearchBar and IconGrid components
 */
export default class IconMap {
    constructor(context) {
        this.context = context;
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;

        this.windowId = null;

        this.components = {
            searchBar: null,
            iconGrid: null
        };

        this.contextMenu = new ContextMenu();

        console.log('Icon Map initialized');
    }

    async init() {
        console.log('Icon Map init');
    }

    async open() {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowId = this.windowManager.createWindow({
            title: this.manifest?.ui?.displayName || 'Icon Map',
            x: 150 + (windowCount * 25),
            y: 100 + (windowCount * 25),
            width: this.manifest?.window?.defaultWidth || 800,
            height: this.manifest?.window?.defaultHeight || 600,
            content: this.renderSkeleton(),
            persistent: this.manifest?.window?.persistent || false,
            onCreated: (windowId, windowEl) => this.onWindowCreated(windowId, windowEl)
        });

        console.log('Icon Map opened, windowId:', this.windowId);
    }

    onWindowCreated(id, windowEl) {
        this.windowId = id;

        if (this.eventBus) {
            this.eventBus.emit('app:opened', {
                appId: this.manifest.id,
                windowId: this.windowId
            });
        }

        this.initializeComponents(windowEl);

        this.setupKeyboardShortcuts();
    }

    renderSkeleton() {
        return `
            <div class="icon-map-app">
                <div class="icon-map-search" id="search-container"></div>
                <div class="icon-map-content" id="grid-container"></div>
                
                <div class="icon-map-footer">
                    <div class="footer-hint">
                        Click [<span>${getIcon('copy', 16)}</span>] to copy icon name • Right-click for more options
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents(windowEl) {
        const searchContainer = windowEl.querySelector('#search-container');
        const gridContainer = windowEl.querySelector('#grid-container');

        this.components.searchBar = new SearchBar(searchContainer, {
            onChange: (filters) => this.handleSearchChange(filters)
        });

        this.components.iconGrid = new IconGrid(gridContainer, {
            onContextMenu: (x, y, iconName) => this.showContextMenu(x, y, iconName)
        });

        console.log('Icon Map components initialized');
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const activeWindow = document.querySelector('.window.active');
            if (!activeWindow || activeWindow.dataset.id !== this.windowId) {
                return;
            }
        });
    }

    handleSearchChange(filters) {
        const { query, category } = filters;

        if (this.components.iconGrid) {
            this.components.iconGrid.filter(query, category);
        }

        console.log('Search filters changed:', filters);
    }

    showContextMenu(x, y, iconName) {
        const items = [
            {
                icon: getIcon('copy', 18),
                label: 'Copy Icon Name',
                action: 'copy-name',
                handler: () => this.copyIconName(iconName)
            },
            {
                icon: getIcon('copy', 18),
                label: 'Copy SVG Code',
                action: 'copy-svg',
                handler: () => this.copySvgCode(iconName)
            },
            { separator: true },
            {
                icon: getIcon('search', 18),
                label: `Icon: ${iconName}`,
                action: 'info',
                disabled: true
            }
        ];

        this.contextMenu.show(x, y, items);
    }

    copyIconName(iconName) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(iconName)
                .then(() => {
                    console.log(`Copied icon name: ${iconName}`);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        }
    }

    copySvgCode(iconName) {
        if (this.components.iconGrid) {
            this.components.iconGrid.copySvgCode(iconName);
        }
    }

    async close() {
        Object.values(this.components).forEach(component => {
            if (component && component.destroy) {
                component.destroy();
            }
        });

        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }

        if (this.eventBus) {
            this.eventBus.emit('app:closed', {
                appId: this.manifest.id
            });
        }

        console.log('Icon Map closed');
    }
}