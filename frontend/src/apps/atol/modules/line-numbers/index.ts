import type { ModuleContext, AtolModule } from '../../core/types';

/**
 * Line Numbers — turns on the editor's IDE-style line-number gutter.
 *
 * It needs no UI slot: it is pure editor behaviour, driven entirely through
 * EditorAPI.setLineNumbers. Enabling/disabling the module (from the Modules
 * dialog or the App Store) shows/hides the gutter. The gutter itself, and the
 * no-wrap layout it implies, are owned by the host editor.
 */
export default class LineNumbersModule implements AtolModule {
    private ctx: ModuleContext | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;
        ctx.editor.setLineNumbers(true);
        ctx.log.log('Line Numbers module activated');
    }

    deactivate(): void {
        this.ctx?.editor.setLineNumbers(false);
        this.ctx?.log.log('Line Numbers module deactivated');
        this.ctx = null;
    }
}
