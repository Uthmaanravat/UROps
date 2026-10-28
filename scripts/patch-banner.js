const fs = require('fs');
let code = fs.readFileSync('src/components/drafts/DraftResumeBanner.tsx', 'utf8');

// 1. Add clearAllDrafts to import
code = code.replace(
  'import { listDrafts, clearDraft, formatRelativeTime, DraftMetadata } from "@/lib/drafts";',
  'import { listDrafts, clearDraft, clearAllDrafts, formatRelativeTime, DraftMetadata } from "@/lib/drafts";'
);

// 2. Add handleDiscardAll
const discardMethod = `    const handleDiscard = (e: React.MouseEvent, key: string, draftTitle: string) => {`;
const newDiscardAll = `    const handleDiscardAll = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Clear all pending drafts stored in this browser session? This cannot be undone.")) {
            clearAllDrafts();
            refreshDrafts();
        }
    };

    const handleDiscard = (e: React.MouseEvent, key: string, draftTitle: string) => {`;
code = code.replace(discardMethod, newDiscardAll);

// 3. Add Clear All button in header
const headerTarget = `                        <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>
                    </div>
                </div>
            </div>`;

const headerReplacement = `                        <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDiscardAll}
                        className="h-8 px-2.5 text-[11px] font-bold text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1.5 border border-white/5 hover:border-rose-500/20"
                        title="Clear all stored drafts"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Clear All</span>
                    </Button>
                </div>
            </div>`;

code = code.replace(headerTarget, headerReplacement);

fs.writeFileSync('src/components/drafts/DraftResumeBanner.tsx', code, 'utf8');
console.log('Successfully patched DraftResumeBanner.tsx');
