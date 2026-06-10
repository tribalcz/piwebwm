/** Anything with a filesystem path can sit on the clipboard. */
export interface ClipboardFileItem {
    path: string;
}

type ClipboardOperation = 'copy' | 'cut' | null;

export class ClipboardManager {
    private items: ClipboardFileItem[];
    private operation: ClipboardOperation;

    constructor() {
        this.items = [];
        this.operation = null;
    }

    copy(items: ClipboardFileItem | ClipboardFileItem[]): void {
        this.items = Array.isArray(items) ? items : [items];
        this.operation = 'copy';
        console.log('Copied to clipboard:', this.items);
    }

    cut(items: ClipboardFileItem | ClipboardFileItem[]): void {
        this.items = Array.isArray(items) ? items : [items];
        this.operation = 'cut';
        console.log('Cut to clipboard:', this.items);
    }

    paste(targetPath: string, onComplete?: () => void): Promise<void> {
        if (this.items.length === 0) {
            console.log('No items to paste');
            return Promise.resolve();
        }

        const promises = this.items.map(item => {
            const fileName = item.path.split('/').pop();
            const newPath = `${targetPath}/${fileName}`;

            if (this.operation === 'copy') {
                return this.copyFile(item.path, newPath);
            } else if (this.operation === 'cut') {
                return this.moveFile(item.path, newPath);
            }
            return Promise.resolve();
        });

        return Promise.all(promises).then(() => {
            if (this.operation === 'cut') {
                this.clear();
            }
            if (onComplete) onComplete();
        });
    }

    private async copyFile(from: string, to: string): Promise<void> {
        // Read source file
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(from)}`);
        if (!response.ok) throw new Error('Failed to read source file');

        const data = await response.json() as { content: string };

        // Write to destination
        const writeResponse = await fetch('/api/files/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: to,
                content: data.content,
                isDir: false
            })
        });

        if (!writeResponse.ok) throw new Error('Failed to write file');
    }

    private async moveFile(from: string, to: string): Promise<void> {
        const response = await fetch('/api/files/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
        });

        if (!response.ok) throw new Error('Failed to move file');
    }

    clear(): void {
        this.items = [];
        this.operation = null;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }

    getOperation(): ClipboardOperation {
        return this.operation;
    }

    getItems(): ClipboardFileItem[] {
        return this.items;
    }
}
