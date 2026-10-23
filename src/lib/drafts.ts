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
    companyId?: string; // Explicit business attribution
    data: T;
}

export type DraftRecord<T = any> = DraftMetadata<T>;

export const KNOWN_LR_BUILDERS_ID = '299c43ec-9578-4c45-91cb-a881a539e25d';
export const KNOWN_AEROWASH_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

// Helper to safely get localStorage
function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/**
 * Get active business ID from localStorage
 */
export function getActiveCompanyId(): string | null {
    const storage = getStorage();
    if (!storage) return null;
    try {
        return storage.getItem('urops_active_company_id');
    } catch {
        return null;
    }
}

/**
 * Set active business ID in localStorage
 */
export function setActiveCompanyId(companyId: string): void {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem('urops_active_company_id', companyId);
        window.dispatchEvent(new CustomEvent('urops_draft_updated'));
    } catch (e) {
        console.error('Failed to set active company id', e);
    }
}

/**
 * Clear draft state and active company on logout
 */
export function clearDraftStateOnLogout(): void {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.removeItem('urops_active_company_id');
        window.dispatchEvent(new CustomEvent('urops_draft_updated'));
    } catch (e) {
        console.error('Failed to clear draft state on logout', e);
    }
}

/**
 * Build a business-namespaced key: urops:<businessId>:draft:<key>
 */
export function getNamespacedKey(rawKey: string, companyId?: string): string {
    const cId = companyId || getActiveCompanyId();
    if (!cId) return rawKey;

    if (rawKey.startsWith(`urops:${cId}:draft:`)) {
        return rawKey;
    }

    // Clean any prior namespace or prefix
    const cleanKey = rawKey
        .replace(/^urops:[^:]+:draft:/, '')
        .replace(/^urops_draft_/, '');

    return `urops:${cId}:draft:${cleanKey}`;
}

/**
 * Get per-business draft index key
 */
function getDraftIndexKey(companyId?: string): string | null {
    const cId = companyId || getActiveCompanyId();
    if (!cId) return null;
    return `urops:${cId}:draft:index`;
}

/**
 * Get the index of draft keys for a specific company
 */
function getDraftIndex(companyId?: string): string[] {
    const storage = getStorage();
    if (!storage) return [];
    const indexKey = getDraftIndexKey(companyId);
    if (!indexKey) return [];

    try {
        const indexStr = storage.getItem(indexKey);
        return indexStr ? JSON.parse(indexStr) : [];
    } catch {
        return [];
    }
}

/**
 * Save the draft keys index for a specific company
 */
function setDraftIndex(keys: string[], companyId?: string): void {
    const storage = getStorage();
    if (!storage) return;
    const indexKey = getDraftIndexKey(companyId);
    if (!indexKey) return;

    try {
        storage.setItem(indexKey, JSON.stringify(Array.from(new Set(keys))));
    } catch (e) {
        console.error('Failed to update draft index', e);
    }
}

/**
 * One-time migration for existing un-namespaced drafts
 * - Attributes Boshard Construction drafts (Q-2026-027, Q-2026-030, Q-2026-031) to LR Builders (299c43ec...)
 * - Quarantines un-attributable drafts without deleting any data
 */
export function runDraftMigration(): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        const migrationDone = storage.getItem('urops_draft_migration_v1_done');
        if (migrationDone) return;

        console.log('[UROps] Running one-time draft migration to namespaced storage...');

        const keysToProcess: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k && (k.startsWith('urops_draft_') || k.startsWith('sow-draft-') || k.startsWith('wbp-draft-') || k === 'quote-form-draft')) {
                keysToProcess.push(k);
            }
        }

        // Also check legacy central index if present
        const legacyIndexRaw = storage.getItem('urops_draft_index');
        if (legacyIndexRaw) {
            try {
                const legacyIndex: string[] = JSON.parse(legacyIndexRaw);
                legacyIndex.forEach(k => {
                    if (!keysToProcess.includes(k)) keysToProcess.push(k);
                });
            } catch {}
        }

        for (const rawKey of keysToProcess) {
            const rawVal = storage.getItem(rawKey);
            if (!rawVal) continue;

            let parsed: any = null;
            try {
                parsed = JSON.parse(rawVal);
            } catch {
                continue;
            }

            const payloadStr = JSON.stringify(parsed).toLowerCase();

            // Determine attribution
            let targetCompanyId: string | null = null;

            // Check Boshard Construction or LR Builders quotes
            const isBoshard = payloadStr.includes('boshard') ||
                payloadStr.includes('q-2026-027') ||
                payloadStr.includes('q-2026-030') ||
                payloadStr.includes('q-2026-031');

            if (isBoshard) {
                targetCompanyId = KNOWN_LR_BUILDERS_ID;
            } else if (parsed.companyId === KNOWN_LR_BUILDERS_ID || parsed.data?.companyId === KNOWN_LR_BUILDERS_ID) {
                targetCompanyId = KNOWN_LR_BUILDERS_ID;
            } else if (parsed.companyId === KNOWN_AEROWASH_ID || parsed.data?.companyId === KNOWN_AEROWASH_ID || payloadStr.includes('aerowash') || payloadStr.includes('drone')) {
                targetCompanyId = KNOWN_AEROWASH_ID;
            }

            const cleanSubKey = rawKey.replace(/^urops_draft_/, '').replace(/^urops:[^:]+:draft:/, '');

            if (targetCompanyId) {
                const namespacedKey = `urops:${targetCompanyId}:draft:${cleanSubKey}`;
                const migratedDraft: DraftMetadata = {
                    key: namespacedKey,
                    type: parsed.type || 'QUOTATION',
                    id: parsed.id || 'new',
                    title: parsed.title || 'Draft',
                    url: parsed.url || '/invoices',
                    updatedAt: parsed.updatedAt || parsed.timestamp || Date.now(),
                    itemCount: parsed.itemCount || (parsed.items ? parsed.items.length : 0),
                    total: parsed.total,
                    companyId: targetCompanyId,
                    data: parsed.data || parsed
                };

                storage.setItem(namespacedKey, JSON.stringify(migratedDraft));
                const companyIndex = getDraftIndex(targetCompanyId);
                if (!companyIndex.includes(namespacedKey)) {
                    setDraftIndex([...companyIndex, namespacedKey], targetCompanyId);
                }
            } else {
                // Quarantine unattributable drafts: keep safe, but do not show in any workspace
                const quarantineKey = `urops:quarantine:draft:${cleanSubKey}`;
                storage.setItem(quarantineKey, rawVal);
            }
        }

        storage.setItem('urops_draft_migration_v1_done', 'true');
        console.log('[UROps] Draft migration completed.');
    } catch (e) {
        console.error('Error during draft migration:', e);
    }
}

export type DraftInput<T = any> = Omit<DraftMetadata<T>, 'updatedAt'> & {
    updatedAt?: number;
    companyId?: string;
};

/**
 * Save a draft with business-namespaced key and per-business index
 */
export function saveDraft<T = any>(input: DraftInput<T>): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        runDraftMigration();

        const cId = input.companyId || getActiveCompanyId();
        const namespacedKey = cId ? getNamespacedKey(input.key, cId) : input.key;

        const metadata: DraftMetadata<T> = {
            id: 'new',
            ...input,
            key: namespacedKey,
            companyId: cId || undefined,
            updatedAt: input.updatedAt || Date.now(),
        };

        storage.setItem(namespacedKey, JSON.stringify(metadata));

        if (cId) {
            const index = getDraftIndex(cId);
            if (!index.includes(namespacedKey)) {
                setDraftIndex([...index, namespacedKey], cId);
            }
        }

        // Dispatch custom event for same-tab reactivity
        window.dispatchEvent(new CustomEvent('urops_draft_updated', { detail: { key: namespacedKey, companyId: cId } }));
    } catch (e) {
        console.error('Failed to save draft', e);
    }
}

/**
 * Retrieve a specific draft by key
 */
export function getDraft<T = any>(key: string, companyId?: string): DraftMetadata<T> | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
        runDraftMigration();

        const cId = companyId || getActiveCompanyId();
        const namespacedKey = cId ? getNamespacedKey(key, cId) : key;

        let item = storage.getItem(namespacedKey);
        // Fallback to raw key if caller passed exact key
        if (!item && key !== namespacedKey) {
            item = storage.getItem(key);
        }
        if (!item) return null;

        const parsed = JSON.parse(item);
        // If companyId is known, verify isolation
        if (cId && parsed.companyId && parsed.companyId !== cId) {
            return null; // Reject cross-tenant read
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Clear a specific draft and remove from per-business index
 */
export function clearDraft(key: string, companyId?: string): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        const cId = companyId || getActiveCompanyId();
        const namespacedKey = cId ? getNamespacedKey(key, cId) : key;

        storage.removeItem(namespacedKey);
        if (key !== namespacedKey) {
            storage.removeItem(key);
        }

        if (cId) {
            const index = getDraftIndex(cId);
            setDraftIndex(index.filter(k => k !== namespacedKey && k !== key), cId);
        }

        window.dispatchEvent(new CustomEvent('urops_draft_updated', { detail: { key: namespacedKey, companyId: cId } }));
    } catch (e) {
        console.error('Failed to clear draft', e);
    }
}

/**
 * List all active drafts for the active business, sorted newest first
 */
export function listDrafts(
    filterType?: DraftType | 'INVOICE_OR_QUOTE' | 'SOW_OR_WBP',
    companyId?: string
): DraftMetadata[] {
    const storage = getStorage();
    if (!storage) return [];

    runDraftMigration();

    const cId = companyId || getActiveCompanyId();
    if (!cId) return []; // Isolated: if no company active, show zero drafts

    const index = getDraftIndex(cId);
    const drafts: DraftMetadata[] = [];
    const validKeys: string[] = [];

    for (let i = 0; i < index.length; i++) {
        const key = index[i];
        try {
            const raw = storage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);

            // Isolation check: ensure draft belongs to this company
            if (parsed && (!parsed.companyId || parsed.companyId === cId)) {
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
            }
        } catch {
            // Ignore unparseable entries
        }
    }

    if (validKeys.length !== index.length) {
        setDraftIndex(validKeys, cId);
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
