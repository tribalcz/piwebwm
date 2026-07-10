import { getIcon } from '@utils/Icons';
import type { ModuleContext, AtolModule } from '../../core/types';

interface Snapshot {
    ts: number;
    html: string;
    preview: string;
}

const MAX_SNAPSHOTS = 20;
const AUTO_INTERVAL_MS = 60_000;

/**
 * Snapshots — local history. Takes a snapshot of the document every minute (if
 * it changed) and on demand, keeping the last 20 in module storage. A toolbar
 * button opens a panel to review and restore them.
 */
export default class SnapshotsModule implements AtolModule {
    private ctx: ModuleContext | null = null;
    private panel: HTMLElement | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;

        ctx.ui.addToolbarItem({
            id: 'snapshots',
            label: `<span class="atol-btn-icon">${getIcon('clock', 14)}</span> History`,
            title: 'Snapshots / local history',
            onClick: () => this.togglePanel(),
        });

        this.timer = setInterval(() => this.maybeSnapshot(), AUTO_INTERVAL_MS);
        ctx.log.log('Snapshots module activated');
    }

    private load(): Snapshot[] {
        return this.ctx?.storage.get<Snapshot[]>('list', []) ?? [];
    }

    private save(list: Snapshot[]): void {
        this.ctx?.storage.set('list', list.slice(-MAX_SNAPSHOTS));
    }

    private maybeSnapshot(): void {
        if (!this.ctx) return;
        const html = this.ctx.editor.getHTML();
        const list = this.load();
        if (list.length > 0 && list[list.length - 1].html === html) return; // unchanged
        if (!this.ctx.editor.getText().trim()) return; // skip empty
        this.takeSnapshot(html);
    }

    private takeSnapshot(html?: string): void {
        if (!this.ctx) return;
        const content = html ?? this.ctx.editor.getHTML();
        const list = this.load();
        list.push({
            ts: Date.now(),
            html: content,
            preview: this.ctx.editor.getText().slice(0, 60).replace(/\s+/g, ' ').trim(),
        });
        this.save(list);
        if (this.panel) this.renderList();
    }

    private togglePanel(): void {
        if (this.panel) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    private openPanel(): void {
        const panel = document.createElement('div');
        panel.className = 'atol-history-panel';
        panel.innerHTML = `
            <div class="atol-history-head">
                <h3>History</h3>
                <div>
                    <button class="atol-find-btn sn-take">Take snapshot</button>
                    <button class="atol-find-btn sn-close" title="Close">×</button>
                </div>
            </div>
            <div class="atol-history-list"></div>
        `;
        document.body.appendChild(panel);
        this.panel = panel;

        panel.querySelector('.sn-take')?.addEventListener('click', () => this.takeSnapshot());
        panel.querySelector('.sn-close')?.addEventListener('click', () => this.closePanel());

        this.renderList();
    }

    private renderList(): void {
        if (!this.panel) return;
        const listEl = this.panel.querySelector<HTMLElement>('.atol-history-list');
        if (!listEl) return;

        const list = this.load().slice().reverse(); // newest first
        if (list.length === 0) {
            listEl.innerHTML = `<div class="atol-history-empty">No snapshots yet</div>`;
            return;
        }

        listEl.innerHTML = list.map((s) => `
            <div class="atol-history-item" data-ts="${s.ts}">
                <span>
                    <span class="atol-history-time">${formatTime(s.ts)}</span><br>
                    <span class="atol-history-preview">${escapeHtml(s.preview || '(empty)')}</span>
                </span>
                <button class="atol-find-btn sn-restore" data-ts="${s.ts}">Restore</button>
            </div>
        `).join('');

        listEl.querySelectorAll<HTMLElement>('.sn-restore').forEach((btn) => {
            btn.addEventListener('click', () => this.restore(Number(btn.dataset.ts)));
        });
    }

    private restore(ts: number): void {
        if (!this.ctx) return;
        const snap = this.load().find((s) => s.ts === ts);
        if (!snap) return;
        if (confirm('Restore this snapshot? The current content will be replaced.')) {
            this.ctx.editor.setHTML(snap.html);
        }
    }

    private closePanel(): void {
        this.panel?.remove();
        this.panel = null;
    }

    deactivate(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.closePanel();
        this.ctx?.log.log('Snapshots module deactivated');
        this.ctx = null;
    }
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleString('cs-CZ');
}

function escapeHtml(text: string): string {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
