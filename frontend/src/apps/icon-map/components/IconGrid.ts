import { getIcon, getAllIcons, type IconInfo } from '@utils/Icons';
import { ClipboardManager } from '@utils/Clipboard';

export interface IconGridCallbacks {
    onContextMenu?: (x: number, y: number, iconName: string) => void;
}

/**
 * IconGrid Component
 * Displays icons in a grid layout with click-to-copy functionality
 */
export class IconGrid {
    private container: Element;
    private callbacks: IconGridCallbacks;
    private allIcons: IconInfo[];
    private filteredIcons: IconInfo[];
    private clipboard: ClipboardManager;
    private gridEl!: HTMLElement;
    private statsCount!: HTMLElement;

    constructor(container: Element, callbacks?: IconGridCallbacks) {
        this.container = container;
        this.callbacks = callbacks || {};
        this.allIcons = getAllIcons();
        this.filteredIcons = this.allIcons;
        this.clipboard = new ClipboardManager();

        this.render();
        this.setupEventListeners();

        console.log('IconGrid component initialized');
    }

    /**
     * Render grid structure
     */
    private render(): void {
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

        this.gridEl = this.container.querySelector<HTMLElement>('.icon-grid')!;
        this.statsCount = this.container.querySelector<HTMLElement>('.stats-count')!;

        this.renderIcons();
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        this.gridEl.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;

            const iconCard = e.target.closest<HTMLElement>('.icon-card');
            if (iconCard) {
                const iconName = iconCard.dataset.icon;
                if (iconName) {
                    this.handleIconClick(iconName);
                }
            }
        });

        this.gridEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            if (!(e.target instanceof Element)) return;

            const iconCard = e.target.closest<HTMLElement>('.icon-card');
            if (iconCard) {
                const iconName = iconCard.dataset.icon;
                if (iconName) {
                    this.handleIconContextMenu(e.clientX, e.clientY, iconName);
                }
            }
        });
    }

    /**
     * Filter icons based on search query and category
     */
    filter(query: string, category: string): void {
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
    private renderIcons(): void {
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
        this.statsCount.textContent = String(this.filteredIcons.length);

        console.log(`Rendered ${this.filteredIcons.length} icons`);
    }

    /**
     * Render single icon card
     */
    private renderIconCard(icon: IconInfo): string {
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
     */
    private handleIconClick(iconName: string): void {
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
     */
    private handleIconContextMenu(x: number, y: number, iconName: string): void {
        if (this.callbacks.onContextMenu) {
            this.callbacks.onContextMenu(x, y, iconName);
        }
    }

    /**
     * Copy SVG code to clipboard
     */
    copySvgCode(iconName: string): void {
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
     */
    private showCopyFeedback(iconName: string, type: 'name' | 'svg'): void {
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
     */
    private fallbackCopy(text: string): void {
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
     */
    private escapeHtml(text: string): string {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * Get all icons
     */
    getAllIcons(): IconInfo[] {
        return this.allIcons;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        console.log('IconGrid component destroyed');
    }
}
