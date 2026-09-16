export type DraftType = 'QUOTATION' | 'INVOICE' | 'SOW' | 'WBP';

export interface DraftMetadata<T = any> {
    key: string;
    type: DraftType;
    id?: string; // e.g. 'new' or invoice/wbp/project ID
    title: string; // e.g. "Quotation Q-2026-026 - Boshard Construction" or "New Quotation"
    url: string; // e.g. "/invoices/new?type=QUOTE" or "/invoices/xyz"
    updatedAt: number; // Date.now()
    itemCount: number;
    total?: number;
    data: T;
}

export type DraftRecord<T = any> = DraftMetadata<T>;

const DRAFT_INDEX_KEY = 'urops_draft_index';

// Helper to safely get localStorage
function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

// Get the index of all known draft keys
function getDraftIndex(): string[] {
    const storage = getStorage();
    if (!storage) return [];
    try {
        const indexStr = storage.getItem(DRAFT_INDEX_KEY);
        return indexStr ? JSON.parse(indexStr) : [];
    } catch {
        return [];
    }
}

// Save the index of known draft keys
function setDraftIndex(keys: string[]) {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(DRAFT_INDEX_KEY, JSON.stringify(Array.from(new Set(keys))));
    } catch (e) {
        console.error('Failed to update draft index', e);
    }
}

export type DraftInput<T = any> = Omit<DraftMetadata<T>, 'updatedAt'> & {
    updatedAt?: number;
};

/**
 * Save a draft with metadata and update the central index
 */
export function saveDraft<T = any>(input: DraftInput<T>): void {
    const storage = getStorage();
    if (!storage) return;
    try {
        const metadata: DraftMetadata<T> = {
            id: 'new',
            ...input,
            updatedAt: input.updatedAt || Date.now(),
        };
        storage.setItem(metadata.key, JSON.stringify(metadata));
        const index = getDraftIndex();
        if (!index.includes(metadata.key)) {
            setDraftIndex([...index, metadata.key]);
        }
        // Dispatch custom event for same-tab reactivity
        window.dispatchEvent(new CustomEvent('urops_draft_updated', { detail: { key: metadata.key } }));
    } catch (e) {
        console.error('Failed to save draft', e);
    }
}

/**
 * Retrieve a specific draft by key
 */
export function getDraft<T = any>(key: string): DraftMetadata<T> | null {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const item = storage.getItem(key);
        if (!item) return null;
        return JSON.parse(item);
    } catch {
        return null;
    }
}

/**
 * Clear a specific draft and remove from index
 */
export function clearDraft(key: string): void {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.removeItem(key);
        const index = getDraftIndex();
        setDraftIndex(index.filter(k => k !== key));
        window.dispatchEvent(new CustomEvent('urops_draft_updated', { detail: { key } }));
    } catch (e) {
        console.error('Failed to clear draft', e);
    }
}

/**
 * List all active drafts, sorted with newest first
 */
export function listDrafts(filterType?: DraftType | 'INVOICE_OR_QUOTE' | 'SOW_OR_WBP'): DraftMetadata[] {
    const storage = getStorage();
    if (!storage) return [];

    const index = getDraftIndex();
    const drafts: DraftMetadata[] = [];
    const validKeys: string[] = [];

    // Also scan storage for any legacy keys that might not be in the index
    const allKeysMap: Record<string, boolean> = {};
    index.forEach(k => { allKeysMap[k] = true; });
    try {
        for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k && (k.startsWith('urops_draft_') || k.startsWith('wbp-draft-') || k.startsWith('sow-draft-') || k === 'quote-form-draft')) {
                allKeysMap[k] = true;
            }
        }
    } catch {}

    const allKeys = Object.keys(allKeysMap);
    for (let i = 0; i < allKeys.length; i++) {
        const key = allKeys[i];
        if (key === DRAFT_INDEX_KEY) continue;
        try {
            const raw = storage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);

            // Handle modern DraftMetadata format
            if (parsed && parsed.key && parsed.type && parsed.updatedAt) {
                if (filterType === 'INVOICE_OR_QUOTE') {
                    if (parsed.type === 'QUOTATION' || parsed.type === 'INVOICE') {
                        drafts.push(parsed);
                        validKeys.push(key);
                    }
                } else if (filterType === 'SOW_OR_WBP') {
                    if (parsed.type === 'SOW' || parsed.type === 'WBP') {
                        drafts.push(parsed);
                        validKeys.push(key);
                    }
                } else if (!filterType || parsed.type === filterType) {
                    drafts.push(parsed);
                    validKeys.push(key);
                }
                continue;
            }

            // Handle legacy quote-form-draft format
            if (key === 'quote-form-draft' && parsed.items && parsed.items.length > 0) {
                const legacyDraft: DraftMetadata = {
                    key: 'urops_draft_quote_new',
                    type: 'QUOTATION',
                    id: 'new',
                    title: parsed.projectName ? `Quote: ${parsed.projectName}` : 'New Quotation Draft',
                    url: '/invoices/new?type=QUOTE',
                    updatedAt: parsed.timestamp || Date.now(),
                    itemCount: parsed.items.length,
                    data: parsed
                };
                if (!filterType || filterType === 'QUOTATION' || filterType === 'INVOICE_OR_QUOTE') {
                    drafts.push(legacyDraft);
                    validKeys.push(key);
                }
            }
        } catch {
            // Ignore unparseable entries
        }
    }

    // Keep index clean
    if (validKeys.length !== index.length) {
        setDraftIndex(validKeys);
    }

    // Sort newest first
    return drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Format timestamp into human-readable relative time
 */
export function formatRelativeTime(timestamp: number): string {
    if (!timestamp) return 'recently';
    const now = Date.now();
    const diffSeconds = Math.round((now - timestamp) / 1000);
    
    if (diffSeconds < 45) return 'just now';
    if (diffSeconds < 90) return '1 minute ago';
    
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
        const d = new Date(timestamp);
        const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return diffHours === 1 ? `1 hour ago (${timeStr})` : `${diffHours} hours ago (${timeStr})`;
    }
    
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
}
