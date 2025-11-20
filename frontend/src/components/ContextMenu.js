export class ContextMenu{
    constructor(){
        this.menuElement = null;
        this.isOpen = false;
        this.items = [];

        this.createMenu();
        this.setupGlobalListeners();
    }

    createMenu(){
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu hidden';
        document.body.appendChild(menu);
        this.menuElement = menu;
    }

    setupGlobalListeners(){
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.menuElement.contains(e.target)) {
                this.close()
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

    show(x, y, items){
        this.items = items;
        this.renderItems();

        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;

        this.menuElement.classList.remove('hidden');
        this.menuElement.classList.add('visible');
        this.isOpen = true;
    }

    renderItems(){
        const html = this.items.map(item => {
            if (item.separator) {
                return '<div class="context-menu-separator"></div>'
            }

            const disabled = item.disabled ? 'disabled' : '';
            const icon = item.icon ? `<span class="context-menu-icon">${item.icon}</span>` : '';

            return `
            <div class="context-menu-item ${disabled}" data-action="${item.action || ''}">
                ${icon}
                <soan class="context-menu-label">${item.label}</soan>
                ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}
            </div>
            `;
        }).join('');

        this.menuElement.innerHTML = html;

        this.menuElement.querySelectorAll('.context-menu-item:not(.disabled)').forEach(item => {
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

    adjustPosition(){
        const rect = this.menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            this.menuElement.style.left = `${viewportWidth - rect.width - 5}px`;
        }

        if (rect.bottom > viewportHeight) {
            this.menuElement.style.top = `${rect.top - rect.height -5}px`;
        }
    }

    close(){
        this.menuElement.classList.remove('visible');
        this.menuElement.classList.add('hidden');
        this.isOpen = false;
    }
}