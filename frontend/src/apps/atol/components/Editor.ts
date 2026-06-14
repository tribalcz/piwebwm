import type { Disposable } from '../core/types';

/**
 * The editable surface of Atol. A thin wrapper over a contenteditable element
 * providing basic rich-text formatting via document.execCommand.
 *
 * execCommand is deprecated but remains the simplest cross-browser way to do
 * basic formatting with no dependencies, which suits this project. If richer
 * editing is ever needed this is the single place to swap implementations.
 */
export class Editor {
    private host: HTMLElement;
    private el: HTMLElement;
    private gutterEl: HTMLElement;
    private lineNumbersOn = false;
    private changeListeners = new Set<(text: string) => void>();
    private selectionListeners = new Set<() => void>();
    private onDocSelectionChange: () => void;

    constructor(container: Element) {
        this.host = container as HTMLElement;
        // Gutter sits to the left of the editable; both share the host's scroll
        // container so they scroll together. The gutter is hidden until line
        // numbers are enabled (see setLineNumbers), leaving the base editor
        // visually unchanged.
        this.host.innerHTML = `
            <div class="atol-gutter" aria-hidden="true"></div>
            <div class="atol-editor" contenteditable="true" spellcheck="true"></div>
        `;
        this.el = this.host.querySelector<HTMLElement>('.atol-editor')!;
        this.gutterEl = this.host.querySelector<HTMLElement>('.atol-gutter')!;

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
            console.error('Atol editor listener error:', err);
        }
    }

    private emitChange(): void {
        const text = this.getText();
        if (this.lineNumbersOn) this.refreshGutter();
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

    /**
     * Toggle the line-number gutter. Enabling also switches the editable to a
     * no-wrap "code" layout so that one logical line maps to exactly one row,
     * keeping the numbers aligned. Disabling restores normal wrapping.
     */
    setLineNumbers(on: boolean): void {
        this.lineNumbersOn = on;
        this.host.classList.toggle('with-gutter', on);
        if (on) {
            this.refreshGutter();
        } else {
            this.gutterEl.textContent = '';
        }
    }

    private refreshGutter(): void {
        // contenteditable keeps a trailing block after Enter, so innerText ends
        // with an extra "\n" until you type into the new line. Strip a single
        // trailing newline so the count reflects the visible rows (pressing
        // Enter adds exactly one number, not two).
        const text = this.el.innerText;
        const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
        const count = Math.max(1, normalized.split('\n').length);
        let out = '';
        for (let i = 1; i <= count; i++) {
            out += (i > 1 ? '\n' : '') + i;
        }
        this.gutterEl.textContent = out;
    }

    // --- Search / replace -------------------------------------------------

    private searchMatches: { start: number; end: number }[] = [];
    private searchIndex = -1;

    /** Find all matches in the text content, select the first, return count. */
    search(query: string, opts: { caseSensitive?: boolean } = {}): number {
        this.searchMatches = [];
        this.searchIndex = -1;
        if (!query) return 0;

        const text = this.el.textContent ?? '';
        const hay = opts.caseSensitive ? text : text.toLowerCase();
        const needle = opts.caseSensitive ? query : query.toLowerCase();

        let i = hay.indexOf(needle);
        while (i !== -1) {
            this.searchMatches.push({ start: i, end: i + query.length });
            i = hay.indexOf(needle, i + query.length);
        }

        if (this.searchMatches.length > 0) {
            this.searchIndex = 0;
            this.selectMatch(0);
        }
        return this.searchMatches.length;
    }

    findNext(): void {
        if (this.searchMatches.length === 0) return;
        this.searchIndex = (this.searchIndex + 1) % this.searchMatches.length;
        this.selectMatch(this.searchIndex);
    }

    findPrev(): void {
        if (this.searchMatches.length === 0) return;
        this.searchIndex =
            (this.searchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
        this.selectMatch(this.searchIndex);
    }

    replaceCurrent(replacement: string): boolean {
        if (this.searchIndex < 0) return false;
        this.selectMatch(this.searchIndex);
        this.el.focus();
        document.execCommand('insertText', false, replacement);
        return true;
    }

    /** Replace within each text node (preserves element structure/formatting). */
    replaceAll(query: string, replacement: string, opts: { caseSensitive?: boolean } = {}): number {
        if (!query) return 0;
        const re = new RegExp(escapeRegExp(query), opts.caseSensitive ? 'g' : 'gi');
        let count = 0;

        const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let n = walker.nextNode();
        while (n) {
            nodes.push(n as Text);
            n = walker.nextNode();
        }

        for (const node of nodes) {
            const value = node.nodeValue ?? '';
            const replaced = value.replace(re, () => {
                count++;
                return replacement;
            });
            if (replaced !== value) node.nodeValue = replaced;
        }

        this.searchMatches = [];
        this.searchIndex = -1;
        if (count > 0) this.emitChange();
        return count;
    }

    clearSearch(): void {
        this.searchMatches = [];
        this.searchIndex = -1;
    }

    private selectMatch(index: number): void {
        const match = this.searchMatches[index];
        if (!match) return;
        const range = this.rangeForOffsets(match.start, match.end);
        if (!range) return;

        const sel = window.getSelection();
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
        const anchor = range.startContainer.parentElement;
        anchor?.scrollIntoView({ block: 'nearest' });
    }

    /** Map [start,end) character offsets in textContent to a DOM Range. */
    private rangeForOffsets(start: number, end: number): Range | null {
        const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
        let acc = 0;
        let startNode: Text | undefined;
        let startOffset = 0;
        let endNode: Text | undefined;
        let endOffset = 0;

        let n = walker.nextNode() as Text | null;
        while (n) {
            const len = (n.nodeValue ?? '').length;
            if (startNode === undefined && start <= acc + len) {
                startNode = n;
                startOffset = start - acc;
            }
            if (endNode === undefined && end <= acc + len) {
                endNode = n;
                endOffset = end - acc;
                break;
            }
            acc += len;
            n = walker.nextNode() as Text | null;
        }

        if (!startNode || !endNode) return null;
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
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

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
