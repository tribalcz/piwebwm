import type { ModuleManager } from '../core/ModuleManager';

/**
 * A small overlay panel listing discovered modules with an enable/disable
 * toggle. Rendered inside the Atol window, not a separate WebDesk window.
 */
export class ModulesDialog {
    private parent: HTMLElement;
    private manager: ModuleManager;
    private overlay: HTMLElement | null = null;

    constructor(parent: HTMLElement, manager: ModuleManager) {
        this.parent = parent;
        this.manager = manager;
    }

    toggle(): void {
        if (this.overlay) {
            this.close();
        } else {
            this.open();
        }
    }

    open(): void {
        if (this.overlay) return;

        const overlay = document.createElement('div');
        overlay.className = 'atol-modules-overlay';
        overlay.innerHTML = `
            <div class="atol-modules-panel">
                <div class="atol-modules-header">
                    <h3>Modules</h3>
                    <button class="atol-modules-close" title="Close">×</button>
                </div>
                <div class="atol-modules-list"></div>
            </div>
        `;
        this.parent.appendChild(overlay);
        this.overlay = overlay;

        overlay.querySelector('.atol-modules-close')?.addEventListener('click', () => this.close());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        this.renderList();
    }

    private renderList(): void {
        if (!this.overlay) return;
        const list = this.overlay.querySelector<HTMLElement>('.atol-modules-list')!;
        const modules = this.manager.list();

        if (modules.length === 0) {
            list.innerHTML = `<div class="atol-modules-empty">No modules installed</div>`;
            return;
        }

        list.innerHTML = modules.map(m => `
            <label class="atol-module-row">
                <input type="checkbox" data-module-id="${m.id}" ${m.enabled ? 'checked' : ''} />
                <span class="atol-module-info">
                    <span class="atol-module-name">${escapeHtml(m.name)} <small>v${escapeHtml(m.version)}</small></span>
                    <span class="atol-module-desc">${escapeHtml(m.description ?? '')}</span>
                </span>
            </label>
        `).join('');

        list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', async () => {
                const id = cb.dataset.moduleId;
                if (!id) return;
                cb.disabled = true;
                await this.manager.setEnabled(id, cb.checked);
                cb.disabled = false;
                this.renderList();
            });
        });
    }

    close(): void {
        this.overlay?.remove();
        this.overlay = null;
    }

    destroy(): void {
        this.close();
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
