export class ClipboardManager{
    constructor(){
        this.items = [];
        this.operation = null;
    }

    copy(items){
        this.items = Array.isArray(items) ? items : [items];
        this.operation = 'copy';
        console.log('Copied to clipboard:', this.items);
    }

    cut(items){
        this.items = Array.isArray(items) ? items : [items];
        this.operation = 'cut';
        console.log('Cut to clipboard:', this.items);
    }

    paste(targetPath, onComplete){
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
        });

        return Promise.all(promises).then(() => {
            if (this.operation === 'cut') {
                this.clear();
            }
            if (onComplete) onComplete();
        });
    }

    async copyFile(from, to) {
        // Read source file
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(from)}`);
        if (!response.ok) throw new Error('Failed to read source file');

        const data = await response.json();

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

    async moveFile(from, to) {
        const response = await fetch('/api/files/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
        });

        if (!response.ok) throw new Error('Failed to move file');
    }

    clear() {
        this.items = [];
        this.operation = null;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    getOperation() {
        return this.operation;
    }

    getItems() {
        return this.items;
    }
}