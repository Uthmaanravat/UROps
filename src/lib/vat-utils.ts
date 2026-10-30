/**
 * VAT calculation and eligibility utilities.
 * Handles South African VAT readiness rules:
 * - VAT applies only if taxId / VAT number is set
 * - If vatRegistrationDate is set, VAT applies only to documents dated on or after that date
 * - When not VAT registered (or dated prior to registration date), documents display "INVOICE"
 * - When VAT registered, documents display "TAX INVOICE" and list AeroWash + Client VAT numbers
 */

export interface VatSettings {
    taxId?: string | null;
    vatRegistrationDate?: Date | string | null;
    vatRate?: number | string | null;
}

/**
 * Checks whether VAT is effective for a document based on its date and company settings.
 */
export function isVatEffective(
    docDate: Date | string | null | undefined,
    settings?: VatSettings | null
): boolean {
    if (!settings?.taxId || !settings.taxId.trim()) {
        return false;
    }

    if (!settings.vatRegistrationDate) {
        return true;
    }

    try {
        const d = docDate ? new Date(docDate) : new Date();
        const regDate = new Date(settings.vatRegistrationDate);

        // Normalize to YYYY-MM-DD calendar comparison
        const dStr = d.toISOString().slice(0, 10);
        const regStr = regDate.toISOString().slice(0, 10);

        return dStr >= regStr;
    } catch {
        return false;
    }
}

/**
 * Returns the effective VAT percentage rate (default 15.0).
 */
export function getVatRate(settings?: VatSettings | null): number {
    if (!settings || settings.vatRate === undefined || settings.vatRate === null || settings.vatRate === '') {
        return 15.0;
    }
    const parsed = Number(settings.vatRate);
    return isNaN(parsed) ? 15.0 : parsed;
}

/**
 * Computes tax amount and total given a subtotal, VAT eligibility and rate.
 */
export function calculateVatAndTotal(
    subtotal: number,
    isEffective: boolean,
    vatRatePercent: number = 15.0
): { taxRate: number; taxAmount: number; total: number } {
    if (!isEffective) {
        return {
            taxRate: 0,
            taxAmount: 0,
            total: subtotal
        };
    }

    const rateFraction = vatRatePercent / 100;
    const taxAmount = subtotal * rateFraction;
    const total = subtotal + taxAmount;

    return {
        taxRate: rateFraction,
        taxAmount,
        total
    };
}

/**
 * Returns document title/heading:
 * - QUOTE -> "QUOTATION"
 * - INVOICE (VAT registered) -> "TAX INVOICE"
 * - INVOICE (Not VAT registered) -> "INVOICE"
 */
export function getDocumentHeading(
    docType: 'QUOTE' | 'INVOICE' | string,
    isEffective: boolean
): string {
    if (docType === 'QUOTE') {
        return 'QUOTATION';
    }
    return isEffective ? 'TAX INVOICE' : 'INVOICE';
}


/**
 * Returns standardized VAT notice text for footers, forms and documents:
 * - VAT registered: "Line item prices exclude VAT. VAT ([rate]%) is added to the total below."
 * - Not registered: "[Company name] is not VAT-registered. No VAT charged."
 */
export function getVatNoticeText(
    companyName: string | null | undefined,
    isEffective: boolean,
    vatRatePercent: number | string = 15.0
): string {
    const cleanName = companyName?.trim() || "Company";
    const numRate = Number(vatRatePercent) || 15;
    if (isEffective) {
        return `Line item prices exclude VAT. VAT (${numRate}%) is added to the total below.`;
    }
    return `${cleanName} is not VAT-registered. No VAT charged.`;
}


/**
 * Determines if a line item is an intentional zero-charge / included service
 * (e.g., Site Visit & Facade Assessment, Service Photo Record).
 */
export function isNoChargeItem(item: any): boolean {
    if (!item) return false;
    const meta = (item.metadata || item.internalMetadata || {}) as any;
    if (meta.isNoCharge || meta.isIncluded) return true;
    const label = String(meta.label || '').trim().toLowerCase();
    if (label === 'no charge' || label === 'included') return true;
    if (meta.itemNumber === 11 || meta.itemNumber === 14) return true;

    const desc = String(item.description || '').toLowerCase();
    const name = String(item.name || '').toLowerCase();
    const notes = String(item.notes || '').toLowerCase();
    const combined = `${name} ${desc} ${notes}`;
    if (combined.includes('site visit & facade assessment') || combined.includes('service photo record')) {
        return true;
    }
    if (combined.includes('no charge') || combined.includes('included')) {
        return true;
    }
    return false;
}

export function isInvalidLineItem(item: any): boolean {
    if (!item) return true;
    const qty = Number(item.quantity);
    if (!qty || isNaN(qty) || qty <= 0) return true;
    const price = Number(item.unitPrice ?? item.amount ?? 0);
    if (isNaN(price) || price < 0) return true;
    if (price === 0) {
        return !isNoChargeItem(item);
    }
    return false;
}
