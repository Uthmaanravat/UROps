export interface WorkSummary {
    work_description: string
    location_summary: string
    work_priority: string
    reason_for_cleaning: string
    estimated_window_count: string
}

export interface WorkSummaryInput {
    id: string
    buildingType?: string | null
    address?: string | null
    coastalBonus?: boolean | null
    status: string
    storeys?: number | null
    priorityLevel?: string | null
    windowHaziness?: number | null
    visibleStreaks?: number | null
    spotCoverage?: number | null
    frameDirtScore?: number | null
}

export function generateWorkSummary(lead: WorkSummaryInput): WorkSummary {
    // 1. Get Nice Building Type Label
    let bTypeLabel = "Commercial Site"
    if (lead.buildingType) {
        const bt = lead.buildingType.toLowerCase()
        if (bt.includes("office")) bTypeLabel = "Office Building"
        else if (bt.includes("retail")) bTypeLabel = "Retail Storefront"
        else if (bt.includes("house") || bt.includes("residential")) bTypeLabel = "Residential House"
        else if (bt.includes("hotel")) bTypeLabel = "Hotel Building"
        else if (bt.includes("apartment")) bTypeLabel = "Apartment Building"
        else if (bt.includes("industrial")) bTypeLabel = "Industrial Facility"
        else if (bt.includes("warehouse")) bTypeLabel = "Warehouse Facility"
        else if (bt.includes("mall") || bt.includes("shopping")) bTypeLabel = "Shopping Center"
        else if (bt.includes("restaurant")) bTypeLabel = "Restaurant"
        else bTypeLabel = lead.buildingType.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }

    // 2. Parse Neighborhood and Zone from Address
    let neighborhood = "Woodstock"
    let zone = "Cape Town"
    if (lead.address) {
        const parts = lead.address.split(",")
        if (parts.length >= 3) {
            neighborhood = parts[1].trim()
            zone = parts[2].trim()
        } else if (parts.length >= 2) {
            neighborhood = parts[1].trim()
        }
    }

    // 3. Location Summary: e.g. "Retail Storefront, Gardens, Cape Town"
    let location_summary = `${bTypeLabel}, ${neighborhood}, ${zone}`
    if (lead.coastalBonus) {
        location_summary += " (Coastal area)"
    }

    const isRejected = lead.status.toLowerCase() === "rejected"
    
    if (isRejected) {
        return {
            work_description: "Not Suitable for Service",
            location_summary,
            work_priority: "REJECTED",
            reason_for_cleaning: `Building is ${lead.storeys || 1} storey. Pressure washing recommended instead. Outside drone service area.`,
            estimated_window_count: "0"
        }
    }

    // Qualified Lead
    // Work Description (Window Cleaning - [Floor Count/Complex])
    let floorLabel = "Multiple Floors"
    if (lead.buildingType?.toLowerCase().includes("office")) {
        floorLabel = "Office Complex"
    }
    const work_description = `Window Cleaning - ${floorLabel}`

    // Work Priority
    const work_priority = (lead.priorityLevel || "low").toUpperCase()

    // Reason for cleaning
    let why = ""
    const haziness = lead.windowHaziness || 0.0
    const streaks = lead.visibleStreaks || 0
    const spot = lead.spotCoverage || 0.0
    const frame = lead.frameDirtScore || 0.0

    if (streaks > 0 || spot > 0.0) {
        why = `Ground-floor windows show ${streaks} visible streaks and water spots (${spot.toFixed(1)}% coverage).`
    } else if (haziness > 0.0 || frame > 0.0) {
        why = `Facade windows showing haze buildup (${haziness.toFixed(0)}%) + frame grime (${frame.toFixed(1)}%).`
    } else {
        why = `Facade showing standard atmospheric dust and environmental buildup.`
    }

    // Add building-specific context
    if (lead.buildingType?.toLowerCase().includes("retail")) {
        why += " High-traffic retail location requires clean facade for customer perception."
    } else if (lead.buildingType?.toLowerCase().includes("office")) {
        why += " Office location requires monthly maintenance schedule."
    }

    if (lead.coastalBonus) {
        why += " Coastal location (salt spray) requires monthly maintenance schedule."
    }

    // Estimated window count
    const storeyCount = lead.storeys || 3
    const min_win = storeyCount * (lead.buildingType?.toLowerCase().includes("office") ? 10 : 8)
    const max_win = storeyCount * (lead.buildingType?.toLowerCase().includes("office") ? 16 : 12)
    const floorDesc = storeyCount === 1 ? "1-storey" : `${storeyCount}-storey`
    const typeLower = lead.buildingType?.toLowerCase() || "building"
    const estimated_window_count = `${min_win}-${max_win} (${floorDesc} ${typeLower.includes("office") ? "office" : typeLower.includes("retail") ? "retail storefront" : typeLower})`

    return {
        work_description,
        location_summary,
        work_priority,
        reason_for_cleaning: why,
        estimated_window_count
    }
}
