/**
 * Formatter - Format data for display
 * Utility functions for formatting time, bytes, numbers, etc.
 */

export class Formatter {
    /**
     * Format uptime (milliseconds to human readable)
     * @param {number} startTime - Timestamp when started
     * @returns {string} Formatted uptime (e.g., "2m 34s")
     */
    static uptime(startTime) {
        const diff = Date.now() - startTime;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Format time ago (e.g., "2s ago", "5m ago")
     * @param {number} timestamp - Unix timestamp
     * @returns {string} Time ago string
     */
    static timeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Format bytes to human readable
     * @param {number} bytes
     * @returns {string} Formatted bytes (e.g., "1.5 MB")
     */
    static bytes(bytes) {
        if (bytes === 0) return '0 B';
        if (!bytes || bytes < 0) return 'N/A';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format number with thousands separator
     * @param {number} num
     * @returns {string} Formatted number (e.g., "1,234")
     */
    static number(num) {
        if (num === null || num === undefined) return '0';
        return num.toLocaleString();
    }

    /**
     * Truncate string with ellipsis
     * @param {string} str
     * @param {number} maxLength
     * @returns {string} Truncated string
     */
    static truncate(str, maxLength = 30) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format timestamp to time string
     * @param {number} timestamp
     * @returns {string} Formatted time (e.g., "14:23:45")
     */
    static time(timestamp) {
        return new Date(timestamp).toLocaleTimeString('cs-CZ');
    }

    /**
     * Format percentage
     * @param {number} value
     * @param {number} total
     * @returns {string} Percentage (e.g., "75%")
     */
    static percentage(value, total) {
        if (!total || total === 0) return '0%';
        return Math.round((value / total) * 100) + '%';
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     * @returns {string} Escaped text
     */
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
