import type { Disposable, ToolbarItem } from '../core/types';

export interface ToolbarCallbacks {
    onFormat: (command: string, value?: string) => void;
    onOpenModules: () => void;
}

interface FormatButton {
    label: string;
    title: string;
    command: string;
    value?: string;
}

const FORMAT_BUTTONS: FormatButton[] = [
    { label: '<b>B</b>', title: 'Bold (Ctrl+B)', command: 'bold' },
    { label: '<i>I</i>', title: 'Italic (Ctrl+I)', command: 'italic' },
    { label: '<u>U</u>', title: 'Underline (Ctrl+U)', command: 'underline' },
    { label: 'H1', title: 'Heading 1', command: 'formatBlock', value: 'h1' },
    { label: 'H2', title: 'Heading 2', command: 'formatBlock', value: 'h2' },
    { label: '¶', title: 'Paragraph', command: 'formatBlock', value: 'p' },
    { label: '• List', title: 'Bulleted list', command: 'insertUnorderedList' },
    { label: '1. List', title: 'Numbered list', command: 'insertOrderedList' },
    { label: '⌫ Clear', title: 'Clear formatting', command: 'removeFormat' },
];

/**
 * The Notepad toolbar: built-in formatting controls plus a slot where modules
 * inject their own buttons, and a host "Modules" button.
 */
export class Toolbar {
    private container: Element;
    private callbacks: ToolbarCallbacks;
    private moduleSlot!: HTMLElement;

    constructor(container: Element, callbacks: ToolbarCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.render();
        this.setupEventListeners();
    }

    private render(): void {
        const formatHtml = FORMAT_BUTTONS.map(b =>
            `<button class="np-tool-btn" data-command="${b.command}"` +
            (b.value ? ` data-value="${b.value}"` : '') +
            ` title="${b.title}">${b.label}</button>`
        ).join('');

        this.container.innerHTML = `
            <div class="notepad-toolbar">
                <div class="np-toolbar-format">${formatHtml}</div>
                <div class="np-toolbar-modules"></div>
                <div class="np-toolbar-spacer"></div>
                <button class="np-tool-btn np-modules-btn" title="Manage modules">⚙ Modules</button>
            </div>
        `;

        this.moduleSlot = this.container.querySelector<HTMLElement>('.np-toolbar-modules')!;
    }

    private setupEventListeners(): void {
        this.container.querySelectorAll<HTMLElement>('.np-toolbar-format .np-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                if (command) {
                    this.callbacks.onFormat(command, btn.dataset.value);
                }
            });
        });

        const modulesBtn = this.container.querySelector<HTMLElement>('.np-modules-btn');
        modulesBtn?.addEventListener('click', () => this.callbacks.onOpenModules());
    }

    /** Module slot: add a button. Returns a Disposable that removes it. */
    addItem(item: ToolbarItem): Disposable {
        const btn = document.createElement('button');
        btn.className = 'np-tool-btn np-module-item';
        btn.dataset.itemId = item.id;
        btn.innerHTML = item.label;
        if (item.title) btn.title = item.title;
        btn.addEventListener('click', () => item.onClick());
        this.moduleSlot.appendChild(btn);

        return () => btn.remove();
    }

    destroy(): void {
        // DOM goes away with the window; nothing else to release.
    }
}
