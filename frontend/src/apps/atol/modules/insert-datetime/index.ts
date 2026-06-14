import { getIcon } from '@utils/Icons';
import type { ModuleContext, AtolModule } from '../../core/types';

type Format = 'datetime' | 'date' | 'time';

const FORMAT_CYCLE: Format[] = ['datetime', 'date', 'time'];

function formatNow(format: Format): string {
    const now = new Date();
    switch (format) {
        case 'date':
            return now.toLocaleDateString('cs-CZ');
        case 'time':
            return now.toLocaleTimeString('cs-CZ');
        default:
            return `${now.toLocaleDateString('cs-CZ')} ${now.toLocaleTimeString('cs-CZ')}`;
    }
}

/**
 * Insert Date/Time — exercises the slots the word-count example does not:
 * a toolbar button, context-menu entries and a keyboard command. The last
 * used format is remembered via the module's namespaced storage.
 *
 * Everything goes through the ModuleContext; all registrations are torn
 * down automatically when the module is disabled.
 */
export default class InsertDateTimeModule implements AtolModule {
    private ctx: ModuleContext | null = null;

    activate(ctx: ModuleContext): void {
        this.ctx = ctx;

        ctx.ui.addToolbarItem({
            id: 'insert-datetime',
            label: `<span class="atol-btn-icon">${getIcon('clock', 14)}</span>`,
            title: 'Insert date/time (Ctrl+Shift+D)',
            onClick: () => this.insert(),
        });

        ctx.ui.addContextMenuItem({
            label: 'Insert date & time',
            icon: getIcon('clock', 18),
            handler: () => this.insert('datetime'),
        });
        ctx.ui.addContextMenuItem({
            label: 'Insert date',
            icon: getIcon('clock', 18),
            handler: () => this.insert('date'),
        });
        ctx.ui.addContextMenuItem({
            label: 'Insert time',
            icon: getIcon('clock', 18),
            handler: () => this.insert('time'),
        });

        ctx.commands.register('insert', () => this.insert(), 'Ctrl+Shift+D');

        ctx.log.log('Insert Date/Time module activated');
    }

    /**
     * Inserts using the given format, or the remembered one. The toolbar
     * button reuses whatever format was picked last from the context menu.
     */
    private insert(format?: Format): void {
        if (!this.ctx) return;

        const chosen = format
            ?? this.ctx.storage.get<Format>('format', 'datetime');
        if (!FORMAT_CYCLE.includes(chosen)) {
            this.ctx.storage.delete('format');
        }

        this.ctx.editor.replaceSelection(formatNow(chosen));
        this.ctx.storage.set('format', chosen);
        this.ctx.editor.focus();
    }

    deactivate(): void {
        this.ctx?.log.log('Insert Date/Time module deactivated');
        this.ctx = null;
    }
}
