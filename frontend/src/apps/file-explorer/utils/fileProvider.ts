import type { DocumentProvider } from '@apps/atol/core/types';
import { FileOperations } from './FileOperations';

/**
 * Atol document provider for an arbitrary user file, backed by the generic
 * file API (/api/files). Lets the File Explorer hand a path to Atol so the file
 * opens in a real editor (plain-text mode) instead of the read-only viewer.
 *
 * The agent's path allowlist still applies — this only reaches files the file
 * API already exposes (/home, /media, /mnt). System files like /etc/hosts use
 * their own dedicated provider, not this one.
 */
export function createFileProvider(path: string): DocumentProvider {
    return {
        id: `file:${path}`,
        title: path,
        mode: 'text',
        load(): Promise<string> {
            return FileOperations.readFile(path);
        },
        save(content: string): Promise<void> {
            return FileOperations.createFile(path, content);
        },
    };
}
