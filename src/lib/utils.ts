import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencySymbol: string = "R") {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return `${currencySymbol}0.00`;
    }
    
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)

    return `${currencySymbol}${formatted}`
}

export function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, (txt) => {
        if (txt === "SOW") return "SOW";
        if (txt === "PO") return "PO";
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

export const LINE_ITEM_REASONS = [
    "Wear and Tear",
    "Damage",
    "Malfunction",
    "Preventative Maintenance",
    "Client Request",
    "Weather / Storm Damage",
    "Regulatory / Compliance",
    "End of Life / Replacement"
] as const;

export type LineItemReason = typeof LINE_ITEM_REASONS[number];

export function compareItemCodes(a?: string | null, b?: string | null): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.trim().localeCompare(b.trim(), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Checks if the justification reason (e.g. "Damage", "Wear and Tear") is already
 * explicitly stated inside the item's description text (e.g. "- Due to Damage").
 * This prevents duplicating justifications on quotes/invoices like:
 * "Replace Door Hinges - Due to Damage \n(Due to: Damage)"
 */
export function isReasonAlreadyInDescription(description?: string | null, reason?: string | null): boolean {
    if (!description || !reason) return false;
    const cleanReason = reason.replace(/^due to:?\s*/i, '').trim().toLowerCase().replace(/&/g, 'and');
    if (!cleanReason) return false;

    const cleanDesc = description.toLowerCase().replace(/&/g, 'and');

    // 1. Direct match: contains "due to <reason>" or "due to: <reason>" or "due to - <reason>"
    if (
        cleanDesc.includes(`due to ${cleanReason}`) ||
        cleanDesc.includes(`due to: ${cleanReason}`) ||
        cleanDesc.includes(`due to - ${cleanReason}`) ||
        cleanDesc.includes(`due to:${cleanReason}`)
    ) {
        return true;
    }

    // 2. Flexible regex matching "due to ... <reason>"
    const escapedReason = cleanReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`due\\s+to[:\\s\\-\\(\\[]*${escapedReason}`, 'i').test(cleanDesc)) {
        return true;
    }

    // 3. Suffix format like "- Damage", "(Damage)", ": Damage", "– Damage" at end of line/string
    if (new RegExp(`[\\-\\–\\—\\(:\\|]\\s*${escapedReason}\\s*\\)?$`, 'i').test(cleanDesc)) {
        return true;
    }

    // 4. Any "due to" clause in the description that mentions the reason word
    if (/due\s+to\b/i.test(cleanDesc) && cleanDesc.includes(cleanReason)) {
        return true;
    }

    return false;
}
