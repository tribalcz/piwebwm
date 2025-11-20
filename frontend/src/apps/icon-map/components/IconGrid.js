import { getIcon, getAllIcons } from '@utils/Icons.js';
import { ClipboardManager } from '@utils/Clipboard.js';

/**
 * IconGrid Component
 * Displays icons in a grid layout with click-to-copy functionality
 */
export class IconGrid {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks || {};
        this.allIcons = getAllIcons();
        this.filteredIcons = this.allIcons;
        this.selectedIcon = null;
        this.clipboard = new ClipboardManager();

        this.render();
        this.setupEventListeners();

        console.log('IconGrid component initialized');
    }

    /**
     * Render grid structure
     */
    render() {
        this.container.innerHTML = `
            <div class="icon-grid-wrapper">
                <div class="icon-grid-stats">
                    <span class="stats-text">Showing <strong class="stats-count">0</strong> icons</span>
                </div>
                <div class="icon-grid">
                    <!-- Icons will be rendered here -->
                </div>
            </div>
        `;

        this.gridEl = this.container.querySelector('.icon-grid');
        this.statsCount = this.container.querySelector('.stats-count');

        this.renderIcons();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.gridEl.addEventListener('click', (e) => {
            const iconCard = e.target.closest('.icon-card');
            if (iconCard) {
                const iconName = iconCard.dataset.icon;
                this.handleIconClick(iconName);
            }
        });

        this.gridEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const iconCard = e.target.closest('.icon-card');
            if (iconCard) {
                const iconName = iconCard.dataset.icon;
                this.handleIconContextMenu(e.clientX, e.clientY, iconName);
            }
        });
    }

    /**
     * Filter icons based on search query and category
     * @param {string} query - Search query
     * @param {string} category - Category filter
     */
    filter(query, category) {
        const lowerQuery = query.toLowerCase().trim();

        this.filteredIcons = this.allIcons.filter(icon => {
            const matchesCategory = category === 'all' || icon.category === category;

            const matchesSearch = !lowerQuery ||
                icon.name.toLowerCase().includes(lowerQuery) ||
                icon.category.toLowerCase().includes(lowerQuery);

            return matchesCategory && matchesSearch;
        });

        this.renderIcons();
    }

    /**
     * Render icons to grid
     */
    renderIcons() {
        if (this.filteredIcons.length === 0) {
            this.gridEl.innerHTML = `
                <div class="empty-state">
                    <span style="font-size: 48px;">${getIcon('search', 48)}</span>
                    <p>No icons found</p>
                    <span style="color: #999;">Try a different search term or category</span>
                </div>
            `;
            this.statsCount.textContent = '0';
            return;
        }

        const html = this.filteredIcons.map(icon => this.renderIconCard(icon)).join('');
        this.gridEl.innerHTML = html;
        this.statsCount.textContent = this.filteredIcons.length;

        console.log(`Rendered ${this.filteredIcons.length} icons`);
    }

    /**
     * Render single icon card
     * @param {Object} icon - Icon object
     * @returns {string} HTML string
     */
    renderIconCard(icon) {
        return `
            <div class="icon-card" data-icon="${icon.name}" title="Click to copy name">
                <div class="icon-preview">
                    ${getIcon(icon.name, 48)}
                </div>
                <div class="icon-info">
                    <div class="icon-name">${this.escapeHtml(icon.name)}</div>
                    <div class="icon-category">${this.escapeHtml(icon.category)}</div>
                </div>
            </div>
        `;
    }

    /**
     * Handle icon click - copy name to clipboard
     * @param {string} iconName - Icon name
     */
    handleIconClick(iconName) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(iconName)
                .then(() => {
                    this.showCopyFeedback(iconName, 'name');
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    alert('Failed to copy to clipboard');
                });
        } else {
            this.fallbackCopy(iconName);
        }
    }

    /**
     * Handle icon context menu - show options
     * @param {number} x - Mouse X position
     * @param {number} y - Mouse Y position
     * @param {string} iconName - Icon name
     */
    handleIconContextMenu(x, y, iconName) {
        if (this.callbacks.onContextMenu) {
            this.callbacks.onContextMenu(x, y, iconName);
        }
    }

    /**
     * Copy SVG code to clipboard
     * @param {string} iconName - Icon name
     */
    copySvgCode(iconName) {
        const iconObj = this.allIcons.find(i => i.name === iconName);
        if (!iconObj) return;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(iconObj.svg)
                .then(() => {
                    this.showCopyFeedback(iconName, 'svg');
                })
                .catch(err => {
                    console.error('Failed to copy SVG:', err);
                    alert('Failed to copy SVG to clipboard');
                });
        } else {
            this.fallbackCopy(iconObj.svg);
        }
    }

    /**
     * Show copy feedback
     * @param {string} iconName - Icon name
     * @param {string} type - 'name' or 'svg'
     */
    showCopyFeedback(iconName, type) {
        const card = this.gridEl.querySelector(`[data-icon="${iconName}"]`);
        if (!card) return;

        card.classList.add('copied');

        const message = type === 'name' ? 'Name copied!' : 'SVG copied!';
        const originalContent = card.innerHTML;

        card.innerHTML = `
            <div class="copy-feedback">
                <span style="font-size: 32px;">${getIcon('copy', 32)}</span>
                <div style="margin-top: 8px; font-weight: 500;">${message}</div>
            </div>
        `;

        setTimeout(() => {
            card.innerHTML = originalContent;
            card.classList.remove('copied');
        }, 1500);
    }

    /**
     * Fallback copy method for older browsers
     * @param {string} text - Text to copy
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            alert('Copied to clipboard!');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            alert('Failed to copy to clipboard');
        }

        document.body.removeChild(textarea);
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
     * Get all icons
     * @returns {Array}
     */
    getAllIcons() {
        return this.allIcons;
    }

    /**
     * Cleanup
     */
    destroy() {
        console.log('IconGrid component destroyed');
    }
}