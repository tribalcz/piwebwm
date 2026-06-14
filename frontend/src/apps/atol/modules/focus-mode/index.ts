import type { ModuleContext, AtolModule } from '../../core/types';

/**
 * Focus Mode — distraction-free writing. The toolbar button enters focus mode
 * (host hides the menu bar, toolbar and status bar via ui.setFocusMode). Since
 * the toolbar is then hidden, a floating exit button is the way back out.
 */
export default class FocusModeModule implements AtolModule {
    private ctx: ModuleContext | null = null;
    private exitBtn: HTMLElement | null = null;
    private active = false;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;
        ctx.ui.addToolbarItem({
            id: 'focus',
            label: 'Focus',
            title: 'Distraction-free writing',
            onClick: () => this.enter(),
        });
        ctx.log.log('Focus Mode module activated');
    }

    private enter(): void {
        if (!this.ctx || this.active) return;
        this.active = true;
        this.ctx.ui.setFocusMode(true);

        const btn = document.createElement('button');
        btn.className = 'atol-focus-exit';
        btn.textContent = '× Exit focus';
        btn.addEventListener('click', () => this.exit());
        document.body.appendChild(btn);
        this.exitBtn = btn;

        this.ctx.editor.focus();
    }

    private exit(): void {
        if (!this.active) return;
        this.active = false;
        this.ctx?.ui.setFocusMode(false);
        this.exitBtn?.remove();
        this.exitBtn = null;
    }

    deactivate(): void {
        this.exit();
        this.ctx?.log.log('Focus Mode module deactivated');
        this.ctx = null;
    }
}
