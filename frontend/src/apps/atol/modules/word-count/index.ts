import type { ModuleContext, AtolModule } from '../../core/types';

/**
 * Word Count — a minimal example module. Adds a status-bar item showing live
 * word and character counts, refreshed on every edit.
 *
 * Note how it never touches the host DOM or the window: it only uses the
 * ModuleContext. All registrations are tracked by the ModuleManager, so there
 * is nothing to clean up here beyond an optional deactivate hook.
 */
export default class WordCountModule implements AtolModule {
    private ctx: ModuleContext | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;

        ctx.ui.addStatusItem({
            id: 'word-count',
            render: () => {
                const text = ctx.editor.getText().trim();
                const words = text === '' ? 0 : text.split(/\s+/).length;
                const chars = ctx.editor.getText().length;
                return `${words} words · ${chars} chars`;
            },
        });

        // Re-render the status item whenever the text changes.
        ctx.editor.onChange(() => ctx.ui.refreshStatus());

        ctx.log.log('Word Count module activated');
    }

    deactivate(): void {
        this.ctx?.log.log('Word Count module deactivated');
        this.ctx = null;
    }
}
