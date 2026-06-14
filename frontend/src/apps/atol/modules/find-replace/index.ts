import { getIcon } from '@utils/Icons';
import type { ModuleContext, AtolModule } from '../../core/types';

/**
 * Find & Replace — a floating search panel driven by the editor's search API.
 * Adds a toolbar button and Ctrl+F / Ctrl+H commands. The panel lives on
 * document.body and is removed on deactivate.
 */
export default class FindReplaceModule implements AtolModule {
    private ctx: ModuleContext | null = null;
    private panel: HTMLElement | null = null;
    private findInput: HTMLInputElement | null = null;
    private replaceInput: HTMLInputElement | null = null;
    private caseInput: HTMLInputElement | null = null;
    private countEl: HTMLElement | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;

        ctx.ui.addToolbarItem({
            id: 'find',
            label: `<span class="atol-btn-icon">${getIcon('search', 14)}</span> Find`,
            title: 'Find & Replace (Ctrl+F)',
            onClick: () => this.open(false),
        });

        ctx.commands.register('find', () => this.open(false), 'Ctrl+F');
        ctx.commands.register('replace', () => this.open(true), 'Ctrl+H');

        ctx.log.log('Find & Replace module activated');
    }

    private open(focusReplace: boolean): void {
        if (!this.panel) this.buildPanel();
        this.panel!.style.display = '';

        // Prefill with the current selection if any.
        const sel = this.ctx?.editor.getSelectionText() ?? '';
        if (sel && this.findInput) {
            this.findInput.value = sel;
            this.runFind();
        }

        const target = focusReplace ? this.replaceInput : this.findInput;
        target?.focus();
        target?.select();
    }

    private buildPanel(): void {
        const panel = document.createElement('div');
        panel.className = 'atol-find-panel';
        panel.innerHTML = `
            <div class="atol-find-row">
                <input type="text" class="ff-find" placeholder="Find" autocomplete="off" />
                <span class="atol-find-count">0</span>
                <button class="atol-find-btn ff-prev" title="Previous">‹</button>
                <button class="atol-find-btn ff-next" title="Next">›</button>
                <button class="atol-find-btn ff-close" title="Close">×</button>
            </div>
            <div class="atol-find-row">
                <input type="text" class="ff-replace" placeholder="Replace" autocomplete="off" />
                <button class="atol-find-btn ff-rep">Replace</button>
                <button class="atol-find-btn ff-repall">All</button>
            </div>
            <div class="atol-find-options">
                <label><input type="checkbox" class="ff-case" /> Case sensitive</label>
            </div>
        `;
        document.body.appendChild(panel);
        this.panel = panel;

        this.findInput = panel.querySelector('.ff-find');
        this.replaceInput = panel.querySelector('.ff-replace');
        this.caseInput = panel.querySelector('.ff-case');
        this.countEl = panel.querySelector('.atol-find-count');

        this.findInput?.addEventListener('input', () => this.runFind());
        this.caseInput?.addEventListener('change', () => this.runFind());
        panel.querySelector('.ff-next')?.addEventListener('click', () => this.ctx?.editor.search.next());
        panel.querySelector('.ff-prev')?.addEventListener('click', () => this.ctx?.editor.search.prev());
        panel.querySelector('.ff-close')?.addEventListener('click', () => this.close());
        panel.querySelector('.ff-rep')?.addEventListener('click', () => this.replaceOne());
        panel.querySelector('.ff-repall')?.addEventListener('click', () => this.replaceAll());

        this.findInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) this.ctx?.editor.search.prev();
                else this.ctx?.editor.search.next();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    private opts(): { caseSensitive: boolean } {
        return { caseSensitive: this.caseInput?.checked ?? false };
    }

    private runFind(): void {
        if (!this.ctx || !this.findInput) return;
        const count = this.ctx.editor.search.find(this.findInput.value, this.opts());
        if (this.countEl) this.countEl.textContent = String(count);
    }

    private replaceOne(): void {
        if (!this.ctx || !this.replaceInput) return;
        this.ctx.editor.search.replace(this.replaceInput.value);
        this.runFind(); // text changed → recompute matches
    }

    private replaceAll(): void {
        if (!this.ctx || !this.findInput || !this.replaceInput) return;
        const n = this.ctx.editor.search.replaceAll(
            this.findInput.value,
            this.replaceInput.value,
            this.opts()
        );
        if (this.countEl) this.countEl.textContent = `${n} replaced`;
    }

    private close(): void {
        if (this.panel) this.panel.style.display = 'none';
        this.ctx?.editor.search.clear();
        this.ctx?.editor.focus();
    }

    deactivate(): void {
        this.panel?.remove();
        this.panel = null;
        this.ctx?.editor.search.clear();
        this.ctx?.log.log('Find & Replace module deactivated');
        this.ctx = null;
    }
}
