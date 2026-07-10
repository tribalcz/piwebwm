function escapeMenuText(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export interface ContextMenuItem {
    label?: string;
    action?: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    separator?: boolean;
    handler?: () => void;
}

export class ContextMenu {
    private menuElement!: HTMLDivElement;
    private isOpen: boolean;
    private items: ContextMenuItem[];

    constructor() {
        this.isOpen = false;
        this.items = [];

        this.createMenu();
        this.setupGlobalListeners();
    }

    private createMenu(): void {
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu hidden';
        document.body.appendChild(menu);
        this.menuElement = menu;
    }

    private setupGlobalListeners(): void {
        document.addEventListener('click', (e) => {
            if (this.isOpen && e.target instanceof Node && !this.menuElement.contains(e.target)) {
                this.close();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        document.addEventListener('scroll', () => {
            if (this.isOpen) {
                this.close();
            }
        }, true);
    }

    show(x: number, y: number, items: ContextMenuItem[]): void {
        this.items = items;
        this.renderItems();

        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;

        this.menuElement.classList.remove('hidden');
        this.menuElement.classList.add('visible');
        this.isOpen = true;
    }

    private renderItems(): void {
        const html = this.items.map(item => {
            if (item.separator) {
                return '<div class="context-menu-separator"></div>';
            }

            const disabled = item.disabled ? 'disabled' : '';
            // item.icon is trusted SVG markup (from getIcon); label/shortcut may
            // carry dynamic text (e.g. file names) so must be escaped.
            const icon = item.icon ? `<span class="context-menu-icon">${item.icon}</span>` : '';

            return `
            <div class="context-menu-item ${disabled}" data-action="${escapeMenuText(item.action || '')}">
                ${icon}
                <span class="context-menu-label">${escapeMenuText(item.label || '')}</span>
                ${item.shortcut ? `<span class="context-menu-shortcut">${escapeMenuText(item.shortcut)}</span>` : ''}
            </div>
            `;
        }).join('');

        this.menuElement.innerHTML = html;

        this.menuElement.querySelectorAll<HTMLElement>('.context-menu-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                const menuItem = this.items.find(i => i.action === action);

                if (menuItem && menuItem.handler) {
                    menuItem.handler();
                }

                this.close();
            });
        });
    }

    adjustPosition(): void {
        const rect = this.menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            this.menuElement.style.left = `${viewportWidth - rect.width - 5}px`;
        }

        if (rect.bottom > viewportHeight) {
            this.menuElement.style.top = `${rect.top - rect.height - 5}px`;
        }
    }

    close(): void {
        this.menuElement.classList.remove('visible');
        this.menuElement.classList.add('hidden');
        this.isOpen = false;
    }
}
