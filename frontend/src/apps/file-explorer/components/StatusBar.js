/**
 * StatusBar Component
 * Displays status messages at the bottom of the file explorer
 */
export class StatusBar {
    constructor(container) {
        this.container = container;
        this.statusText = 'Ready';

        this.render();

        console.log('StatusBar component initialized');
    }

    /**
     * Render status bar HTML
     */
    render() {
        this.container.innerHTML = `
            <div class="explorer-statusbar">
                <span class="status-text">${this.statusText}</span>
            </div>
        `;

        this.statusTextEl = this.container.querySelector('.status-text');
    }

    /**
     * Set status message
     * @param {string} text - Status message
     */
    setStatus(text) {
        this.statusText = text;

        if (this.statusTextEl) {
            this.statusTextEl.textContent = text;
        }
    }

    /**
     * Show loading status
     */
    showLoading() {
        this.setStatus('Loading...');
    }

    /**
     * Show ready status
     */
    showReady() {
        this.setStatus('Ready');
    }

    /**
     * Show file count
     * @param {number} count - Number of items
     */
    showItemCount(count) {
        this.setStatus(`${count} item${count !== 1 ? 's' : ''}`);
    }

    /**
     * Show error status
     * @param {string} error - Error message
     */
    showError(error) {
        this.setStatus(`Error: ${error}`);
    }

    /**
     * Cleanup
     */
    destroy() {
        console.log('StatusBar component destroyed');
    }
}