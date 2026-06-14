import type { Disposable, StatusItem } from '../core/types';

/**
 * The Atol status bar. The host owns a left-hand message (save state);
 * modules contribute items rendered on the right and re-rendered on refresh().
 */
export class StatusBar {
    private container: Element;
    private hostMessageEl!: HTMLElement;
    private moduleSlot!: HTMLElement;
    private items: StatusItem[] = [];

    constructor(container: Element) {
        this.container = container;
        this.render();
    }

    private render(): void {
        this.container.innerHTML = `
            <div class="atol-statusbar">
                <span class="atol-status-message">Ready</span>
                <span class="atol-status-modules"></span>
            </div>
        `;
        this.hostMessageEl = this.container.querySelector<HTMLElement>('.atol-status-message')!;
        this.moduleSlot = this.container.querySelector<HTMLElement>('.atol-status-modules')!;
    }

    setMessage(text: string): void {
        this.hostMessageEl.textContent = text;
    }

    /** Module slot: add a status item. Returns a Disposable that removes it. */
    addItem(item: StatusItem): Disposable {
        this.items.push(item);
        this.refresh();
        return () => {
            this.items = this.items.filter(i => i.id !== item.id);
            this.refresh();
        };
    }

    /** Re-render all module status items. */
    refresh(): void {
        this.moduleSlot.innerHTML = this.items
            .map(item => {
                let content = '';
                try {
                    content = item.render();
                } catch (err) {
                    console.error(`Status item '${item.id}' render error:`, err);
                    content = '';
                }
                return `<span class="atol-status-item" data-item-id="${item.id}">${content}</span>`;
            })
            .join('');
    }

    destroy(): void {
        this.items = [];
    }
}
