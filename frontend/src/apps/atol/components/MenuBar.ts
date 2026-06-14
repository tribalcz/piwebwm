import type { Disposable, MenuBarMenu } from '../core/types';

/**
 * The Atol menu bar — the horizontal strip of File/Edit/… menus above the
 * toolbar. The host owns the empty bar; modules contribute top-level menus via
 * the `menubar` slot. The bar hides itself while it holds no menus, so the base
 * editor is unchanged until a menu-providing module is enabled.
 */
export class MenuBar {
    private container: HTMLElement;
    private barEl!: HTMLElement;
    private menus: MenuBarMenu[] = [];
    private openDropdown: HTMLElement | null = null;
    private onDocClick: (e: MouseEvent) => void;

    constructor(container: Element) {
        this.container = container as HTMLElement;
        this.render();

        // Close an open dropdown on any outside click.
        this.onDocClick = (e) => {
            if (this.openDropdown && e.target instanceof Node && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        };
        document.addEventListener('click', this.onDocClick);
    }

    private render(): void {
        this.container.innerHTML = `<div class="atol-menubar"></div>`;
        this.barEl = this.container.querySelector<HTMLElement>('.atol-menubar')!;
        this.syncVisibility();
    }

    /** Add a top-level menu. Returns a Disposable that removes it. */
    addMenu(menu: MenuBarMenu): Disposable {
        this.menus.push(menu);
        this.renderMenus();
        return () => {
            this.menus = this.menus.filter(m => m.id !== menu.id);
            this.renderMenus();
        };
    }

    private renderMenus(): void {
        this.closeDropdown();
        this.barEl.innerHTML = this.menus.map(m =>
            `<button class="atol-menu-trigger" data-menu-id="${m.id}">${escapeHtml(m.label)}</button>`
        ).join('');

        this.barEl.querySelectorAll<HTMLElement>('.atol-menu-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = this.menus.find(m => m.id === trigger.dataset.menuId);
                if (menu) this.toggleDropdown(trigger, menu);
            });
        });

        this.syncVisibility();
    }

    private syncVisibility(): void {
        this.container.style.display = this.menus.length > 0 ? '' : 'none';
    }

    private toggleDropdown(trigger: HTMLElement, menu: MenuBarMenu): void {
        const isOpenForThis = this.openDropdown?.dataset.menuId === menu.id;
        this.closeDropdown();
        if (isOpenForThis) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'atol-menu-dropdown';
        dropdown.dataset.menuId = menu.id;
        dropdown.innerHTML = menu.items.map((item, i) => {
            if (item.separator) return `<div class="atol-menu-separator"></div>`;
            const disabled = item.disabled ? ' disabled' : '';
            const shortcut = item.shortcut
                ? `<span class="atol-menu-shortcut">${escapeHtml(item.shortcut)}</span>` : '';
            return `<button class="atol-menu-item${disabled}" data-index="${i}"${item.disabled ? ' disabled' : ''}>
                <span class="atol-menu-item-label">${escapeHtml(item.label ?? '')}</span>${shortcut}
            </button>`;
        }).join('');

        // Position under the trigger, relative to the menubar container.
        trigger.classList.add('active');
        dropdown.style.left = `${trigger.offsetLeft}px`;
        this.container.appendChild(dropdown);
        this.openDropdown = dropdown;

        dropdown.querySelectorAll<HTMLElement>('.atol-menu-item:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.index);
                const item = menu.items[idx];
                this.closeDropdown();
                item?.onClick?.();
            });
        });
    }

    private closeDropdown(): void {
        if (this.openDropdown) {
            this.openDropdown.remove();
            this.openDropdown = null;
        }
        this.barEl.querySelectorAll('.atol-menu-trigger.active').forEach(t => t.classList.remove('active'));
    }

    destroy(): void {
        document.removeEventListener('click', this.onDocClick);
        this.closeDropdown();
        this.menus = [];
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
