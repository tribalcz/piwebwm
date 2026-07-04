/**
 * Formatter - Format data for display
 * Utility functions for formatting time, bytes, numbers, etc.
 */

export class Formatter {
    /**
     * Format uptime (milliseconds to human readable)
     */
    static uptime(startTime: number): string {
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
     */
    static timeAgo(timestamp: number): string {
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
     */
    static bytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        if (!bytes || bytes < 0) return 'N/A';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format number with thousands separator
     */
    static number(num: number | null | undefined): string {
        if (num === null || num === undefined) return '0';
        return num.toLocaleString();
    }

    /**
     * Truncate string with ellipsis
     */
    static truncate(str: string, maxLength: number = 30): string {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format timestamp to time string
     */
    static time(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString('cs-CZ');
    }

    /**
     * Format percentage
     */
    static percentage(value: number, total: number): string {
        if (!total || total === 0) return '0%';
        return Math.round((value / total) * 100) + '%';
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text: string): string {
        if (!text) return '';
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}
