import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth-actions"
import {
    ALL_COMPLIANCE_CATEGORY_META,
    type AllComplianceCategory,
    evaluateComplianceDocument,
    evaluateDroneMaintenance,
    evaluateVendorPackReadiness,
} from "@/lib/compliance-status"
import { downloadComplianceBuffer, sanitizeComplianceFileName } from "@/lib/compliance-storage"
import { generateVendorComplianceSummaryPdfBuffer } from "@/lib/vendor-pack-pdf"

export const dynamic = "force-dynamic"

function getExtension(fileName: string, mimeType: string): string {
    const m = fileName?.match(/\.[a-zA-Z0-9]{2,5}$/)
    if (m) return m[0].toLowerCase()
    if (mimeType === "image/png") return ".png"
    if (mimeType === "image/webp") return ".webp"
    if (mimeType === "image/jpeg") return ".jpg"
    return ".pdf"
}

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser()
        if (!authUser || !authUser.companyId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
        }
        if (authUser.role === "CREW") {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
        }

        const companyId = authUser.companyId
        const { searchParams } = new URL(request.url)
        const allowIncomplete = searchParams.get("allowIncomplete") === "1"
        const excludeExpired = searchParams.get("excludeExpired") === "1"

        const [company, settings, allActiveDocs, drones, flightSums] = await Promise.all([
            prisma.company.findUnique({ where: { id: companyId } }),
            prisma.companySettings.findUnique({ where: { companyId } }),
            prisma.complianceDocument.findMany({
                where: { companyId, isArchived: false },
                include: { pilotUser: { select: { id: true, name: true, email: true } } },
                orderBy: [{ vendorPackOrder: "asc" }, { createdAt: "asc" }],
            }),
            prisma.drone.findMany({
                where: { companyId, isActive: true },
                orderBy: { name: "asc" },
            }),
            prisma.flightLogEntry.groupBy({
                by: ["droneId"],
                where: { companyId, droneId: { not: null } },
                _sum: { durationMinutes: true },
            }),
        ])

        const now = new Date()
        const readiness = evaluateVendorPackReadiness(allActiveDocs, now)

        if (!readiness.isReady && !allowIncomplete) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Vendor Pack has missing or expired statutory documents.",
                    readiness,
                },
                { status: 409 }
            )
        }

        let packDocs = allActiveDocs.filter(d => d.includeInVendorPack)
        if (excludeExpired) {
            packDocs = packDocs.filter(d => evaluateComplianceDocument(d, now).severity !== "EXPIRED")
        }

        const minsMap = new Map<string, number>()
        for (const r of flightSums) {
            if (r.droneId) minsMap.set(r.droneId, r._sum.durationMinutes || 0)
        }

        const evaluatedDrones = drones.map(dr => {
            const st = evaluateDroneMaintenance(dr, minsMap.get(dr.id) || 0, now)
            return {
                name: dr.name,
                model: dr.model,
                serialNumber: dr.serialNumber,
                sacaaRegNumber: dr.sacaaRegNumber,
                airworthinessLabel: st.label,
                totalAirframeMinutes: st.totalAirframeMinutes,
            }
        })

        const rplDocs = allActiveDocs.filter(d => d.category === "RPL")
        const pilotsSummary = rplDocs.map(r => {
            const st = evaluateComplianceDocument(r, now)
            return {
                name: r.pilotUser?.name || r.title,
                email: r.pilotUser?.email || "—",
                rplReference: r.referenceNumber,
                rplExpiry: r.expiryDate,
                rplStatusLabel: st.label,
            }
        })

        const companyName = settings?.name || company?.name || "AeroWash"
        const companySlug = sanitizeComplianceFileName(companyName).replace(/\.[^.]+$/, "") || "AeroWash"
        const dateStamp = now.toISOString().split("T")[0]

        const zip = new JSZip()

        // 1. Auto-generated 00 Compliance Summary PDF
        const summaryPdfBuffer = generateVendorComplianceSummaryPdfBuffer({
            companyName,
            registrationNumber: settings?.registrationNumber,
            taxId: settings?.taxId,
            address: settings?.address,
            phone: settings?.phone,
            email: settings?.email,
            website: settings?.website,
            bankDetails: settings?.bankDetails,
            documents: packDocs.map(d => ({
                category: d.category,
                title: d.title,
                referenceNumber: d.referenceNumber,
                issuingAuthority: d.issuingAuthority,
                issuedDate: d.issuedDate,
                expiryDate: d.expiryDate,
                pilotName: d.pilotUser?.name || null,
            })),
            drones: evaluatedDrones,
            pilots: pilotsSummary,
            generatedAt: now,
        })

        zip.file(`00_${companySlug}_Vendor_Compliance_Summary.pdf`, summaryPdfBuffer)

        // 2. Download and attach each included ComplianceDocument in numbered order
        let indexCounter = 1
        for (const doc of packDocs) {
            const buf = await downloadComplianceBuffer(companyId, doc.storagePath)
            if (!buf) continue

            const meta =
                ALL_COMPLIANCE_CATEGORY_META[doc.category as AllComplianceCategory] ||
                ALL_COMPLIANCE_CATEGORY_META.OTHER
            const ext = getExtension(doc.fileName, doc.mimeType)
            const baseCatName = meta.vendorPrefix.replace(/^\d+_/, "")
            const suffix = doc.pilotUser?.name
                ? `_${sanitizeComplianceFileName(doc.pilotUser.name)}`
                : doc.category === "OTHER"
                ? `_${sanitizeComplianceFileName(doc.title)}`
                : ""
            const numberedName = `${String(indexCounter).padStart(2, "0")}_${baseCatName}${suffix}${ext}`

            zip.file(numberedName, buf)
            indexCounter += 1
        }

        const zipBuffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        })

        // Audit log record
        await prisma.companyAuditLog
            .create({
                data: {
                    companyId,
                    actorUserId: authUser.id,
                    actorName: authUser.name || authUser.email,
                    action: "VENDOR_PACK_DOWNLOADED",
                    details: {
                        documentsIncluded: indexCounter - 1,
                        allowIncomplete,
                        excludeExpired,
                        generatedAt: now.toISOString(),
                    },
                },
            })
            .catch(() => null)

        const downloadName = `${companySlug}_Vendor_Compliance_Pack_${dateStamp}.zip`

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${downloadName}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (e: any) {
        console.error("[VendorPack API] Failed to generate ZIP:", e)
        return NextResponse.json(
            { ok: false, error: e.message || "Failed to generate Vendor Pack ZIP" },
            { status: 500 }
        )
    }
}
