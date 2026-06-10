import type { ApiErrorResponse, FileInfo, ListFilesResponse, ReadFileResponse } from '@/types/api';

/**
 * FileOperations Utility
 * Handles all file system operations (copy, move, delete, create, etc.)
 */
export class FileOperations {

    /**
     * Read file content
     */
    static async readFile(path: string): Promise<string> {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as ReadFileResponse;
        return data.content;
    }

    /**
     * Copy file from source to destination
     */
    static async copyFile(from: string, to: string): Promise<void> {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(from)}`);
        if (!response.ok) {
            throw new Error('Failed to read source file');
        }

        const data = await response.json() as ReadFileResponse;

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
            const error = await writeResponse.json() as ApiErrorResponse;
            throw new Error(error.error || 'Failed to write file');
        }
    }

    /**
     * Move file from source to destination
     */
    static async moveFile(from: string, to: string): Promise<void> {
        const response = await fetch('/api/files/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
        });

        if (!response.ok) {
            const error = await response.json() as ApiErrorResponse;
            throw new Error(error.error || 'Failed to move file');
        }
    }

    /**
     * Delete file or folder
     */
    static async deleteFile(path: string): Promise<void> {
        const response = await fetch(`/api/files/delete?path=${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json() as ApiErrorResponse;
            throw new Error(error.error || 'Failed to delete');
        }
    }

    /**
     * Create new file
     */
    static async createFile(path: string, content: string = ''): Promise<void> {
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
            const error = await response.json() as ApiErrorResponse;
            throw new Error(error.error || 'Failed to create file');
        }
    }

    /**
     * Create new folder
     */
    static async createFolder(path: string): Promise<void> {
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
            const error = await response.json() as ApiErrorResponse;
            throw new Error(error.error || 'Failed to create folder');
        }
    }

    /**
     * Rename file or folder (wrapper around moveFile)
     */
    static async rename(oldPath: string, newName: string): Promise<void> {
        const newPath = oldPath.replace(/[^/]+$/, newName);
        return this.moveFile(oldPath, newPath);
    }

    /**
     * List files in directory
     */
    static async listFiles(path: string): Promise<ListFilesResponse> {
        const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as ListFilesResponse;
        return data;
    }

    /**
     * Get file info
     */
    static async getFileInfo(path: string): Promise<FileInfo> {
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
