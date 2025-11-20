/**
 * FileOperations Utility
 * Handles all file system operations (copy, move, delete, create, etc.)
 */
export class FileOperations {

    /**
     * Read file content
     * @param {string} path - File path
     * @returns {Promise<string>} File content
     */
    static async readFile(path) {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.content;
    }

    /**
     * Copy file from source to destination
     * @param {string} from - Source path
     * @param {string} to - Destination path
     * @returns {Promise<void>}
     */
    static async copyFile(from, to) {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(from)}`);
        if (!response.ok) {
            throw new Error('Failed to read source file');
        }

        const data = await response.json();

        // Write to
        const writeResponse = await fetch('/api/files/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: to,
                content: data.content,
                isDir: false
            })
        });

        if (!writeResponse.ok) {
            const error = await writeResponse.json();
            throw new Error(error.error || 'Failed to write file');
        }
    }

    /**
     * Move file from source to destination
     * @param {string} from - Source path
     * @param {string} to - Destination path
     * @returns {Promise<void>}
     */
    static async moveFile(from, to) {
        const response = await fetch('/api/files/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to move file');
        }
    }

    /**
     * Delete file or folder
     * @param {string} path - Path to delete
     * @returns {Promise<void>}
     */
    static async deleteFile(path) {
        const response = await fetch(`/api/files/delete?path=${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete');
        }
    }

    /**
     * Create new file
     * @param {string} path - File path
     * @param {string} content - File content (default empty)
     * @returns {Promise<void>}
     */
    static async createFile(path, content = '') {
        const response = await fetch('/api/files/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: path,
                content: content,
                isDir: false
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create file');
        }
    }

    /**
     * Create new folder
     * @param {string} path - Folder path
     * @returns {Promise<void>}
     */
    static async createFolder(path) {
        const response = await fetch('/api/files/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: path,
                content: '',
                isDir: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create folder');
        }
    }

    /**
     * Rename file or folder (wrapper around moveFile)
     * @param {string} oldPath - Current path
     * @param {string} newName - New name (not full path)
     * @returns {Promise<void>}
     */
    static async rename(oldPath, newName) {
        const newPath = oldPath.replace(/[^/]+$/, newName);
        return this.moveFile(oldPath, newPath);
    }

    /**
     * List files in directory
     * @param {string} path - Directory path
     * @returns {Promise<Object>} Object with path and files array
     */
    static async listFiles(path) {
        const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    /**
     * Get file info
     * @param {string} path - File path
     * @returns {Promise<Object>} File info object
     */
    static async getFileInfo(path) {
        // This would need a dedicated API endpoint
        // For now, we can get info from listFiles of parent directory
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const data = await this.listFiles(parentPath);

        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const fileInfo = data.files.find(f => f.name === fileName);

        if (!fileInfo) {
            throw new Error('File not found');
        }

        return fileInfo;
    }
}