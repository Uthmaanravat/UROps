/**
 * Terms and Conditions Parsing and Formatting Utilities
 *
 * Rules:
 * - Never generate, summarise, reword or infer terms text. Render exactly what the user entered.
 * - Number clauses sequentially: template clauses first, then custom clauses continuing from the last template clause number.
 */

export interface NumberedClause {
    clauseNumber: number;
    text: string;
    source: 'template' | 'custom';
}

/**
 * Parses raw text into individual clauses.
 * Accepts clauses separated by blank lines or line breaks.
 * Strips accidental duplicate leading numbering (e.g. "1. ", "1) ", "- ") so sequential numbering does not collide.
 */
export function parseClauses(text: string | null | undefined): string[] {
    if (!text || !text.trim()) return [];

    // Split by double newline (paragraphs) if present, otherwise single lines
    const trimmed = text.trim();
    const hasParagraphs = /\r?\n\s*\r?\n/.test(trimmed);
    const rawBlocks = hasParagraphs
        ? trimmed.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(b => b.length > 0)
        : trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    const clauses: string[] = [];

    for (const block of rawBlocks) {
        // Strip leading numbering or bullet markers if user typed them manually
        const cleaned = block.replace(/^(?:(?:\d+[\.\)]|\-|\*|•|Clause\s+\d+[:\.]?)\s*)/i, '').trim();
        if (cleaned.length > 0) {
            clauses.push(cleaned);
        }
    }

    return clauses;
}

/**
 * Combines template body and custom terms into sequentially numbered clauses.
 * Template clauses appear first (1..N), followed by custom clauses (N+1..M).
 */
export function buildNumberedClauses(
    templateBody: string | null | undefined,
    customBody: string | null | undefined
): NumberedClause[] {
    const templateClauses = parseClauses(templateBody);
    const customClauses = parseClauses(customBody);

    const result: NumberedClause[] = [];
    let counter = 1;

    for (const text of templateClauses) {
        result.push({
            clauseNumber: counter++,
            text,
            source: 'template'
        });
    }

    for (const text of customClauses) {
        result.push({
            clauseNumber: counter++,
            text,
            source: 'custom'
        });
    }

    return result;
}
