import { prisma } from "@/lib/prisma"
import seedFile from "@/data/fable37-prospects.json"

interface SeedProspect {
    id: string
    name: string
    location?: string | null
    owners_entity?: string | null
    property_manager_name?: string | null
    property_manager_email?: string | null
    property_manager_phone?: string | null
    receptionist_email?: string | null
    company_main_phone?: string | null
    category?: string | null
    access_moat?: string | null
    why_drones_matter?: string | null
    estimated_value?: string | null
    notes?: string | null
}

/**
 * Idempotently imports the Fable-37 prospect list for a company.
 * Only inserts seed ids that don't exist yet, so statuses/notes/contact
 * logs on already-imported prospects are never touched.
 */
export async function ensureFable37Seeded(companyId: string): Promise<number> {
    const seeds = ((seedFile as any).fable_37_prospects || []) as SeedProspect[]
    const validSeeds = seeds.filter(s => s && s.id && s.name)
    if (validSeeds.length === 0) return 0

    const existing = await prisma.prospect.findMany({
        where: { companyId, seedId: { in: validSeeds.map(s => s.id) } },
        select: { seedId: true }
    })
    const existingIds = new Set(existing.map(e => e.seedId))
    const missing = validSeeds.filter(s => !existingIds.has(s.id))
    if (missing.length === 0) return 0

    const result = await prisma.prospect.createMany({
        data: missing.map(s => ({
            seedId: s.id,
            name: s.name,
            location: s.location ?? null,
            ownersEntity: s.owners_entity ?? null,
            propertyManagerName: s.property_manager_name ?? null,
            propertyManagerEmail: s.property_manager_email ?? null,
            propertyManagerPhone: s.property_manager_phone ?? null,
            receptionistEmail: s.receptionist_email ?? null,
            companyMainPhone: s.company_main_phone ?? null,
            category: s.category ?? "Niche",
            accessMoat: s.access_moat ?? null,
            whyDronesMatter: s.why_drones_matter ?? null,
            estimatedValue: s.estimated_value ?? "medium",
            notes: s.notes ?? "",
            status: "new",
            source: "fable_37",
            contactLog: [],
            companyId
        })),
        skipDuplicates: true
    })
    return result.count
}
