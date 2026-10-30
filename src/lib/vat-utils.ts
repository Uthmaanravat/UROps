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
