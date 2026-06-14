/**
 * StatusBar Component
 * Displays status messages at the bottom of the file explorer
 */
export class StatusBar {
    private container: Element;
    private statusText: string;
    private statusTextEl: Element | null = null;

    constructor(container: Element) {
        this.container = container;
        this.statusText = 'Ready';

        this.render();

        console.log('StatusBar component initialized');
    }

    /**
     * Render status bar HTML
     */
    private render(): void {
        this.container.innerHTML = `
            <div class="explorer-statusbar">
                <span class="status-text">${this.statusText}</span>
            </div>
        `;

        this.statusTextEl = this.container.querySelector('.status-text');
    }

    /**
     * Set status message
     */
    setStatus(text: string): void {
        this.statusText = text;

        if (this.statusTextEl) {
            this.statusTextEl.textContent = text;
        }
    }

    /**
     * Show loading status
     */
    showLoading(): void {
        this.setStatus('Loading...');
    }

    /**
     * Show ready status
     */
    showReady(): void {
        this.setStatus('Ready');
    }

    /**
     * Show file count
     */
    showItemCount(count: number): void {
        this.setStatus(`${count} item${count !== 1 ? 's' : ''}`);
    }

    /**
     * Show error status
     */
    showError(error: string): void {
        this.setStatus(`Error: ${error}`);
    }

    /**
     * Cleanup
     */
    destroy(): void {
        console.log('StatusBar component destroyed');
    }
}
