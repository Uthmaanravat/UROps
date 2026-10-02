export function calculateTenderRateYear(tenderStartDate: string | Date, documentDate: string | Date): 1 | 2 | 3 {
    const start = new Date(tenderStartDate)
    const doc = new Date(documentDate)

    if (isNaN(start.getTime()) || isNaN(doc.getTime())) return 1

    const diffYears = (doc.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

    if (diffYears < 1) return 1
    if (diffYears < 2) return 2
    return 3
}

export function formatTenderDocumentNumber(
    prefix: string = "CCT-T",
    type: "QUOTE" | "INVOICE",
    year: number,
    sequence: number
): string {
    const docYear = year || new Date().getFullYear()
    const seqStr = String(sequence).padStart(3, "0")
    if (type === "INVOICE") {
        return `${prefix}I-${docYear}-${seqStr}`
    }
    return `${prefix}-${docYear}-${seqStr}`
}
