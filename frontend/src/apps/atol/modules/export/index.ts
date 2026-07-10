import { getIcon } from '@utils/Icons';
import type { ModuleContext, AtolModule } from '../../core/types';

type Format = 'txt' | 'md' | 'html';

const FORMATS: Record<Format, { ext: string; mime: string }> = {
    txt: { ext: 'txt', mime: 'text/plain' },
    md: { ext: 'md', mime: 'text/markdown' },
    html: { ext: 'html', mime: 'text/html' },
};

/**
 * Export — download the note as a file. Adds a toolbar button that opens a
 * small modal to pick a filename and format. Pure editor API + a Blob download.
 */
export default class ExportModule implements AtolModule {
    private ctx: ModuleContext | null = null;
    private overlay: HTMLElement | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;
        ctx.ui.addToolbarItem({
            id: 'export',
            label: `<span class="atol-btn-icon">${getIcon('exportStats', 14)}</span> Export`,
            title: 'Export / download',
            onClick: () => this.openModal(),
        });
        ctx.log.log('Export module activated');
    }

    private openModal(): void {
        this.closeModal();
        const overlay = document.createElement('div');
        overlay.className = 'atol-modal-overlay';
        overlay.innerHTML = `
            <div class="atol-modal">
                <h3>Export note</h3>
                <label>File name</label>
                <input type="text" class="ex-name" value="note" autocomplete="off" />
                <label>Format</label>
                <select class="ex-format">
                    <option value="txt">Plain text (.txt)</option>
                    <option value="md">Markdown (.md)</option>
                    <option value="html">HTML (.html)</option>
                </select>
                <div class="atol-modal-actions">
                    <button class="atol-modal-btn ex-cancel">Cancel</button>
                    <button class="atol-modal-btn primary ex-download">Download</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });
        overlay.querySelector('.ex-cancel')?.addEventListener('click', () => this.closeModal());
        overlay.querySelector('.ex-download')?.addEventListener('click', () => this.download());

        overlay.querySelector<HTMLInputElement>('.ex-name')?.focus();
    }

    private download(): void {
        if (!this.ctx || !this.overlay) return;
        const name = (this.overlay.querySelector<HTMLInputElement>('.ex-name')?.value || 'note').trim();
        const format = (this.overlay.querySelector<HTMLSelectElement>('.ex-format')?.value || 'txt') as Format;
        const { ext, mime } = FORMATS[format];

        let content: string;
        if (format === 'html') {
            content = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(name)}</title>\n</head>\n<body>\n${this.ctx.editor.getHTML()}\n</body>\n</html>\n`;
        } else {
            content = this.ctx.editor.getText();
        }

        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);

        this.closeModal();
    }

    private closeModal(): void {
        this.overlay?.remove();
        this.overlay = null;
    }

    deactivate(): void {
        this.closeModal();
        this.ctx?.log.log('Export module deactivated');
        this.ctx = null;
    }
}

function escapeHtml(text: string): string {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
