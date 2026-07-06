// Pure client-safe helpers for generating property-specific outreach drafts.

export interface ContactLogEntry {
    date: string
    method: "email" | "call" | "whatsapp" | "status"
    outcome: string
    draft_sent?: string | null
}

// Serialized shape passed from the server page to the client component.
export interface ProspectDTO {
    id: string
    seedId: string | null
    name: string
    location: string | null
    ownersEntity: string | null
    propertyManagerName: string | null
    propertyManagerEmail: string | null
    propertyManagerPhone: string | null
    receptionistEmail: string | null
    companyMainPhone: string | null
    category: string
    accessMoat: string | null
    whyDronesMatter: string | null
    estimatedValue: string
    status: string
    firstContactDate: string | null
    lastContactDate: string | null
    nextFollowupDate: string | null
    notes: string
    contactLog: ContactLogEntry[] | null
    source: string
    createdAt: string
    updatedAt: string
}

export interface SenderInfo {
    name: string
    phone: string
    title: string
    companyName: string
}

export interface EmailDraft {
    to: string | null
    toLabel: string
    subject: string
    body: string
    // "manager" = property manager email, "receptionist" = general inbox,
    // "phone_only" = no email on file, "incomplete" = no contact details at all
    contactStatus: "manager" | "receptionist" | "phone_only" | "incomplete"
}

function categoryHook(p: ProspectDTO): string {
    const name = p.name
    switch (p.category) {
        case "Water Facing":
            return `I noticed ${name}'s facade over the water. Traditional cleaning there needs marine permits, boats, and rope teams — we do it with drones, no marine logistics required.`
        case "Heritage":
            return `${name}'s heritage facade can't be drilled for anchors, and scaffolding risks damaging it. We clean heritage buildings safely with drones — no contact with the fabric of the building.`
        case "Rooftop Solar":
            return `Rooftop solar loses 15–25% of output to dirt and salt buildup. We maintain panels at 90%+ output with drone-based cleaning — no one walking on your array.`
        case "Multiplier":
            return `Across your portfolio there are facades that rope and scaffold teams struggle to reach. One drone-cleaning relationship covers all of them.`
        case "No Gondola":
            return `${name}'s glass isn't reachable by a gondola or BMU track. That's exactly the kind of building we specialize in — drone cleaning needs no roof rig at all.`
        default: // Niche
            return `Cleaning a structure like ${name} usually means expensive cranes or access equipment. We do it with drones at a fraction of the setup.`
    }
}

function multiplierHook(p: ProspectDTO, siblings: ProspectDTO[]): string {
    const names = [p, ...siblings].map(s => s.name).slice(0, 5)
    const listed = names.length > 1
        ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1]
        : names[0]
    const hardCases = [p, ...siblings]
        .filter(s => s.accessMoat)
        .slice(0, 2)
        .map(s => `${s.name} (${s.accessMoat})`)
        .join("; ")
    return (
        `I came across several of your properties in Cape Town — ${listed}. ` +
        `One relationship with ${p.ownersEntity} means drone cleaning across your whole portfolio.` +
        (hardCases ? ` Some of these can't be reached with rope or scaffold at all: ${hardCases}. We can.` : "")
    )
}

/**
 * Generates a property-specific email draft.
 * `allProspects` is used to detect multiplier owners (same ownersEntity on
 * 2+ prospects) so one owner gets one grouped email instead of five blasts.
 */
export function generateProspectEmail(
    p: ProspectDTO,
    allProspects: ProspectDTO[],
    sender: SenderInfo
): EmailDraft {
    // Contact cascade
    let to: string | null = null
    let toLabel = ""
    let greeting = "Hi there,"
    let contactStatus: EmailDraft["contactStatus"]

    const managerNameUsable = p.propertyManagerName &&
        !/^(facilities manager|property manager|manager)$/i.test(p.propertyManagerName.trim())

    if (p.propertyManagerEmail) {
        to = p.propertyManagerEmail
        toLabel = `${p.propertyManagerName || "Property Manager"} <${p.propertyManagerEmail}>`
        if (managerNameUsable) greeting = `Hi ${p.propertyManagerName},`
        contactStatus = "manager"
    } else if (p.receptionistEmail) {
        to = p.receptionistEmail
        toLabel = `Reception / general inbox <${p.receptionistEmail}>`
        contactStatus = "receptionist"
    } else if (p.propertyManagerPhone || p.companyMainPhone) {
        toLabel = `No email on file — call ${p.propertyManagerPhone || p.companyMainPhone}`
        contactStatus = "phone_only"
    } else {
        toLabel = "Contact details incomplete"
        contactStatus = "incomplete"
    }

    // Multiplier detection: same owner on 2+ prospects → one grouped email
    const siblings = p.ownersEntity
        ? allProspects.filter(o => o.id !== p.id && o.ownersEntity === p.ownersEntity)
        : []
    const isMultiplier = siblings.length >= 1 || p.category === "Multiplier"

    const hook = isMultiplier && siblings.length >= 1
        ? multiplierHook(p, siblings)
        : categoryHook(p)

    const why = p.whyDronesMatter ? `\n\n${p.whyDronesMatter}` : ""

    const askIntro = contactStatus === "receptionist"
        ? `Could you point me to the right person for building maintenance at ${p.name}? In short:`
        : hook

    const bodyParts = [
        greeting,
        "",
        contactStatus === "receptionist" ? `${askIntro}\n\n${hook}${why}` : `${hook}${why}`,
        "",
        `Up front, because you'll ask: we're SACAA-certified drone operators with our ROC, operator approvals, and insurance file ready to share before anything else.`,
        "",
        isMultiplier && siblings.length >= 1
            ? `Would a 10-minute call this week work? I'd like to discuss one contract that covers multiple assets.`
            : `Would a 10-minute call this week work?`,
        "",
        `Kind regards,`,
        sender.name,
        sender.title,
        sender.companyName,
        sender.phone
    ].filter(part => part !== null)

    const subject = isMultiplier && siblings.length >= 1
        ? `Drone facade & exterior cleaning across the ${p.ownersEntity} portfolio`
        : `Drone exterior cleaning for ${p.name}`

    return {
        to,
        toLabel,
        subject,
        body: bodyParts.join("\n"),
        contactStatus
    }
}

/** Escapes a CSV cell value. */
function csvCell(v: string | null | undefined): string {
    const s = (v ?? "").replace(/"/g, '""')
    return `"${s}"`
}

/** Builds a CSV export of prospects for backup/records. */
export function prospectsToCsv(prospects: ProspectDTO[]): string {
    const header = [
        "Name", "Location", "Owner", "Category", "Value", "Status", "Source",
        "PM Name", "PM Email", "PM Phone", "Reception Email", "Main Phone",
        "First Contact", "Last Contact", "Next Follow-up", "Notes"
    ].join(",")
    const rows = prospects.map(p => [
        csvCell(p.name), csvCell(p.location), csvCell(p.ownersEntity),
        csvCell(p.category), csvCell(p.estimatedValue), csvCell(p.status), csvCell(p.source),
        csvCell(p.propertyManagerName), csvCell(p.propertyManagerEmail), csvCell(p.propertyManagerPhone),
        csvCell(p.receptionistEmail), csvCell(p.companyMainPhone),
        csvCell(p.firstContactDate?.slice(0, 10)), csvCell(p.lastContactDate?.slice(0, 10)),
        csvCell(p.nextFollowupDate?.slice(0, 10)), csvCell(p.notes)
    ].join(","))
    return [header, ...rows].join("\n")
}
