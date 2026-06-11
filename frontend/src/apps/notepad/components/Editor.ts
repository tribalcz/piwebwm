import type { Disposable } from '../core/types';

/**
 * The editable surface of the Notepad. A thin wrapper over a contenteditable
 * element providing basic rich-text formatting via document.execCommand.
 *
 * execCommand is deprecated but remains the simplest cross-browser way to do
 * basic formatting with no dependencies, which suits this project. If richer
 * editing is ever needed this is the single place to swap implementations.
 */
export class Editor {
    private el: HTMLElement;
    private changeListeners = new Set<(text: string) => void>();
    private selectionListeners = new Set<() => void>();
    private onDocSelectionChange: () => void;

    constructor(container: Element) {
        container.innerHTML = `<div class="notepad-editor" contenteditable="true" spellcheck="true"></div>`;
        this.el = container.querySelector<HTMLElement>('.notepad-editor')!;

        this.el.addEventListener('input', () => this.emitChange());

        // selectionchange only fires on document; filter to our editor.
        this.onDocSelectionChange = () => {
            if (this.selectionInEditor()) {
                this.selectionListeners.forEach(cb => this.safe(cb));
            }
        };
        document.addEventListener('selectionchange', this.onDocSelectionChange);
    }

    private selectionInEditor(): boolean {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        const node = sel.anchorNode;
        return node != null && this.el.contains(node);
    }

    private safe(cb: () => void): void {
        try {
            cb();
        } catch (err) {
            console.error('Notepad editor listener error:', err);
        }
    }

    private emitChange(): void {
        const text = this.getText();
        this.changeListeners.forEach(cb => this.safe(() => cb(text)));
    }

    getText(): string {
        return this.el.innerText;
    }

    setText(text: string): void {
        this.el.innerText = text;
        this.emitChange();
    }

    getHTML(): string {
        return this.el.innerHTML;
    }

    setHTML(html: string): void {
        this.el.innerHTML = html;
        this.emitChange();
    }

    getSelectionText(): string {
        return window.getSelection()?.toString() ?? '';
    }

    replaceSelection(text: string): void {
        this.el.focus();
        document.execCommand('insertText', false, text);
    }

    applyFormat(command: string, value?: string): void {
        this.el.focus();
        document.execCommand(command, false, value);
        this.emitChange();
    }

    focus(): void {
        this.el.focus();
    }

    onChange(callback: (text: string) => void): Disposable {
        this.changeListeners.add(callback);
        return () => this.changeListeners.delete(callback);
    }

    onSelectionChange(callback: () => void): Disposable {
        this.selectionListeners.add(callback);
        return () => this.selectionListeners.delete(callback);
    }

    destroy(): void {
        document.removeEventListener('selectionchange', this.onDocSelectionChange);
        this.changeListeners.clear();
        this.selectionListeners.clear();
    }
}
