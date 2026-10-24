export type RecurrenceFrequency =
    | 'NONE'
    | 'MONTHLY'
    | 'EVERY_2_MONTHS'
    | 'QUARTERLY'
    | 'TWICE_A_YEAR'
    | 'YEARLY'
    | 'EVERY_2_YEARS'
    | 'CUSTOM'

export function calculateRecurringDates(
    startDate: Date,
    frequency: RecurrenceFrequency,
    options?: {
        interval?: number
        intervalUnit?: 'weeks' | 'months'
        count?: number
        untilDate?: Date
    }
): Date[] {
    if (frequency === 'NONE') return [new Date(startDate)]

    const dates: Date[] = []
    const start = new Date(startDate)
    const limitDate = options?.untilDate || new Date(new Date(start).setFullYear(start.getFullYear() + 1))
    const maxVisits = options?.count || 24

    let cur = new Date(start)
    let visitCount = 0

    while (cur <= limitDate && visitCount < maxVisits) {
        dates.push(new Date(cur))
        visitCount++

        const next = new Date(cur)
        switch (frequency) {
            case 'MONTHLY':
                next.setMonth(next.getMonth() + 1)
                break
            case 'EVERY_2_MONTHS':
                next.setMonth(next.getMonth() + 2)
                break
            case 'QUARTERLY':
                next.setMonth(next.getMonth() + 3)
                break
            case 'TWICE_A_YEAR':
                next.setMonth(next.getMonth() + 6)
                break
            case 'YEARLY':
                next.setFullYear(next.getFullYear() + 1)
                break
            case 'EVERY_2_YEARS':
                next.setFullYear(next.getFullYear() + 2)
                break
            case 'CUSTOM':
                if (options?.intervalUnit === 'weeks') {
                    next.setDate(next.getDate() + (options.interval || 1) * 7)
                } else {
                    next.setMonth(next.getMonth() + (options?.interval || 1))
                }
                break
            default:
                return dates
        }
        cur = next
    }

    return dates
}
