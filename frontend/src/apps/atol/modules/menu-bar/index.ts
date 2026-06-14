import type { ModuleContext, AtolModule } from '../../core/types';

/**
 * Menu Bar — adds the classic File / Edit dropdown menus above the toolbar
 * (the `menubar` slot). Edit actions go through the editor's applyFormat (which
 * focuses the editor first, so commands target it even though the click was on
 * a menu button). Shortcuts shown in the menu are the browser's native
 * contenteditable bindings, so they keep working without a separate command.
 */
export default class MenuBarModule implements AtolModule {
    private ctx: ModuleContext | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;

        ctx.ui.addMenu({
            id: 'file',
            label: 'File',
            items: [
                { label: 'New', shortcut: 'Ctrl+N', onClick: () => this.newDocument() },
            ],
        });

        ctx.ui.addMenu({
            id: 'edit',
            label: 'Edit',
            items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => ctx.editor.applyFormat('undo') },
                { label: 'Redo', shortcut: 'Ctrl+Y', onClick: () => ctx.editor.applyFormat('redo') },
                { separator: true },
                { label: 'Cut', shortcut: 'Ctrl+X', onClick: () => ctx.editor.applyFormat('cut') },
                { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => ctx.editor.applyFormat('copy') },
                { label: 'Paste', shortcut: 'Ctrl+V', onClick: () => this.paste() },
                { separator: true },
                { label: 'Select All', shortcut: 'Ctrl+A', onClick: () => ctx.editor.applyFormat('selectAll') },
            ],
        });

        ctx.log.log('Menu Bar module activated');
    }

    private newDocument(): void {
        if (!this.ctx) return;
        if (confirm('Discard the current note and start a new one?')) {
            this.ctx.editor.setText('');
            this.ctx.editor.focus();
        }
    }

    private async paste(): Promise<void> {
        if (!this.ctx) return;
        this.ctx.editor.focus();
        try {
            const text = await navigator.clipboard.readText();
            this.ctx.editor.replaceSelection(text);
        } catch (err) {
            this.ctx.log.warn('Paste failed (clipboard permission?):', err);
        }
    }

    deactivate(): void {
        this.ctx?.log.log('Menu Bar module deactivated');
        this.ctx = null;
    }
}
