import type { DocumentProvider } from '@apps/atol/core/types';

/**
 * Atol document provider for `/etc/hosts`, backed by the dedicated, validated
 * agent endpoint (NOT the generic file API). Atol opened with this provider
 * becomes the hosts editor.
 */
export function createHostsProvider(): DocumentProvider {
    return {
        id: 'system-hosts',
        title: '/etc/hosts',
        mode: 'text',
        async load(): Promise<string> {
            const res = await fetch('/api/system/hosts', { credentials: 'same-origin' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json() as { content: string };
            return data.content ?? '';
        },
        async save(content: string): Promise<void> {
            const res = await fetch('/api/system/hosts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ content }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
        },
    };
}
