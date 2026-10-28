const fs = require('fs');
let code = fs.readFileSync('src/lib/drafts.ts', 'utf8');
if (!code.includes('clearAllDrafts')) {
  const target = 'export function clearDraft(';
  const addition = `/**
 * Clear all drafts for the active business
 */
export function clearAllDrafts(companyId?: string): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        const cId = companyId || getActiveCompanyId();
        if (cId) {
            const index = getDraftIndex(cId);
            for (const key of index) {
                storage.removeItem(key);
            }
            setDraftIndex([], cId);
        }
        window.dispatchEvent(new CustomEvent('urops_draft_updated'));
    } catch (e) {
        console.error('Failed to clear all drafts', e);
    }
}

`;
  code = code.replace(target, addition + target);
  fs.writeFileSync('src/lib/drafts.ts', code, 'utf8');
  console.log('Added clearAllDrafts to drafts.ts');
} else {
  console.log('Already present');
}
