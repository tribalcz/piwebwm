import type { ModuleContext, AtolModule } from '../../core/types';

/**
 * Text Transforms — context-menu actions that rewrite the current selection.
 * Pure editor API (getSelectionText + replaceSelection); no host changes.
 */
export default class TextTransformsModule implements AtolModule {
    private ctx: ModuleContext | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;

        const add = (label: string, fn: (s: string) => string) =>
            ctx.ui.addContextMenuItem({ label, handler: () => this.apply(fn) });

        add('UPPERCASE', (s) => s.toUpperCase());
        add('lowercase', (s) => s.toLowerCase());
        add('Title Case', (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()));
        add('Sort lines (A→Z)', (s) => s.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'));
        add('Trim trailing spaces', (s) => s.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n'));
        add('Remove duplicate lines', (s) => {
            const seen = new Set<string>();
            return s.split('\n').filter((l) => (seen.has(l) ? false : (seen.add(l), true))).join('\n');
        });

        ctx.log.log('Text Transforms module activated');
    }

    private apply(transform: (selection: string) => string): void {
        if (!this.ctx) return;
        const selection = this.ctx.editor.getSelectionText();
        if (!selection) return;
        this.ctx.editor.replaceSelection(transform(selection));
    }

    deactivate(): void {
        this.ctx?.log.log('Text Transforms module deactivated');
        this.ctx = null;
    }
}
