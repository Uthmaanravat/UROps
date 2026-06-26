'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"
import { exec } from "child_process"
import path from "path"
import { rejectQuoteAction } from "@/app/(dashboard)/invoices/pricing-actions"
import { createInvoiceAction } from "@/app/(dashboard)/invoices/actions"
import { sendInvoiceEmail } from "@/app/(dashboard)/invoices/email-actions"
import { get72HourForecast } from "@/lib/weather"

export async function dashboardRejectAction(id: string) {
    await rejectQuoteAction(id)
}

export async function overrideLeadStatusAction(leadId: string, status: string) {
    try {
        const companyId = await ensureAuth()
        
        // Verify lead belongs to company
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })
        
        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: { status }
        })

        revalidatePath("/dashboard")
        return { success: true, data: updatedLead }
    } catch (error: any) {
        console.error("Error overriding lead status:", error)
        return { success: false, error: error.message || "Failed to override status" }
    }
}

export async function deleteLeadAction(leadId: string) {
    try {
        const companyId = await ensureAuth()
        
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })
        
        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        await prisma.lead.delete({
            where: { id: leadId }
        })

        revalidatePath("/drone")
        revalidatePath("/dashboard")
        return { success: true }
    } catch (error: any) {
        console.error("Error deleting lead:", error)
        return { success: false, error: error.message || "Failed to delete lead" }
    }
}

export async function deleteLeadsBulkAction(leadIds: string[]) {
    try {
        const companyId = await ensureAuth()
        console.log("[SERVER ACTION] deleteLeadsBulkAction called:", {
            leadIdsCount: leadIds.length,
            companyId,
            leadIdsSample: leadIds.slice(0, 3)
        })
        
        // Verify all leads belong to company
        const leads = await prisma.lead.findMany({
            where: {
                id: { in: leadIds },
                companyId: companyId
            },
            select: { id: true }
        })
        
        const validLeadIds = leads.map(l => l.id)
        console.log("[SERVER ACTION] Validated leads count:", {
            validCount: validLeadIds.length
        })
        
        if (validLeadIds.length === 0) {
            return { success: false, error: "No valid leads found or unauthorized" }
        }

        const deleteResult = await prisma.lead.deleteMany({
            where: {
                id: { in: validLeadIds }
            }
        })

        revalidatePath("/drone")
        revalidatePath("/dashboard")
        return { success: true, count: deleteResult.count }
    } catch (error: any) {
        console.error("Error bulk deleting leads:", error)
        return { success: false, error: error.message || "Failed to bulk delete leads" }
    }
}

export async function addManualOptOutAction(email: string, reason: string) {
    try {
        const companyId = await ensureAuth()
        const emailClean = email.trim().toLowerCase()
        const parts = emailClean.split("@")
        const domain = parts[parts.length - 1] || ""

        // Insert opt out
        const optOut = await prisma.optOut.upsert({
            where: { email: emailClean },
            update: { domain, reason, companyId },
            create: { email: emailClean, domain, reason, companyId }
        })

        // Auto-flag any existing matching leads as opted_out
        await prisma.lead.updateMany({
            where: {
                companyId,
                OR: [
                    { contactEmail: emailClean },
                    { contactEmail: { endsWith: `@${domain}` } }
                ]
            },
            data: { status: "opted_out" }
        })

        revalidatePath("/dashboard")
        return { success: true, data: optOut }
    } catch (error: any) {
        console.error("Error adding manual opt-out:", error)
        return { success: false, error: error.message || "Failed to register unsubscribe" }
    }
}

export async function triggerOutreachAction(leadId: string) {
    try {
        const companyId = await ensureAuth()

        // Verify lead exists
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        // Exec python pipeline outreach trigger actively
        const pythonAppDir = "c:\\Users\\utira\\OneDrive\\Desktop\\My Apps\\New App"
        const cmd = `python -m outreach.send_outreach --lead-id ${leadId} --active-run`

        logger_exec(cmd, pythonAppDir)

        return { success: true, message: "Outreach triggered successfully." }
    } catch (error: any) {
        console.error("Error triggering outreach:", error)
        return { success: false, error: error.message || "Failed to trigger outreach" }
    }
}

// Helper to run python CLI script asynchronously
function logger_exec(cmd: string, cwd: string) {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Outreach Exec Error]: ${error.message}`)
            return
        }
        if (stderr) {
            console.error(`[Outreach Exec Stderr]: ${stderr}`)
        }
        console.log(`[Outreach Exec Success]:\n${stdout}`)
        
        // Force Next.js path cache revalidation once process completes
        revalidatePath("/drone")
        revalidatePath("/dashboard")
    })
}

export async function convertLeadToProjectAction(leadId: string) {
    try {
        const companyId = await ensureAuth()

        // 1. Fetch Lead
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        if (lead.projectId) {
            return { success: false, error: "Lead is already converted to a project" }
        }

        // 2. Find or Create Client
        let client = null
        if (lead.contactEmail) {
            client = await prisma.client.findFirst({
                where: {
                    companyId,
                    email: lead.contactEmail
                }
            })
        }

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: lead.companyName || lead.contactName || "New Client (Scouted)",
                    companyName: lead.companyName,
                    email: lead.contactEmail,
                    attentionTo: lead.contactName,
                    address: lead.address,
                    notes: `Created automatically from Drone Operations Scouting Lead ID: ${lead.id}`,
                    companyId
                }
            })
        }

        // 3. Create Project
        const isWindowLead = lead.windowHaziness !== null && lead.windowHaziness !== undefined;
        const projectName = isWindowLead 
            ? `Drone Window Cleaning - ${lead.companyName || lead.address || 'Scouted Site'}`
            : `Roof Restoration & Soft-wash - ${lead.companyName || lead.address || 'Scouted Site'}`;
        const projectDesc = isWindowLead 
            ? `Identified via autonomous drone window inspection. Haziness = ${(lead.windowHaziness ?? 0).toFixed(0)}%, Streaks = ${lead.visibleStreaks ?? 0}.`
            : `Identified via autonomous drone scouting. Algae/Growth Score = ${(lead.biologicalGrowthScore * 100).toFixed(0)}% and Surface Staining Score = ${(lead.surfaceStainingScore * 100).toFixed(0)}%.`;
        
        const project = await prisma.project.create({
            data: {
                name: projectName.slice(0, 100), // Safety length cap
                description: projectDesc,
                status: 'PLANNING',
                workflowStage: 'SOW',
                commercialStatus: 'AWAITING_PO',
                clientId: client.id,
                companyId
            }
        })

        // 4. Update Lead's project relationship and history timeline log
        const oldHistory = Array.isArray(lead.history) ? lead.history : []
        const updatedHistory = [
            ...oldHistory,
            {
                date: new Date().toISOString(),
                type: "system",
                content: `Lead converted to Job/Project: "${project.name}" under Client: "${client.name}"`
            }
        ]

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                projectId: project.id,
                status: "closed",
                history: updatedHistory
            }
        })

        revalidatePath("/drone")
        revalidatePath("/dashboard")
        return { success: true, data: project }
    } catch (error: any) {
        console.error("Error converting lead to project:", error)
        return { success: false, error: error.message || "Failed to convert lead to project" }
    }
}

export async function addLeadCallNoteAction(leadId: string, noteText: string) {
    try {
        const companyId = await ensureAuth()

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        const oldHistory = Array.isArray(lead.history) ? lead.history : []
        const updatedHistory = [
            ...oldHistory,
            {
                date: new Date().toISOString(),
                type: "note",
                content: noteText.trim()
            }
        ]

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                history: updatedHistory
            }
        })

        revalidatePath("/drone")
        revalidatePath("/dashboard")
        return { success: true, data: updatedLead }
    } catch (error: any) {
        console.error("Error adding lead call note:", error)
        return { success: false, error: error.message || "Failed to add note" }
    }
}

// Helper to compute AI dynamic pricing
function calculateLeadPricing(lead: {
    estimatedArea: number;
    roofPitch: string;
    serviceType: string;
    biologicalGrowthScore: number;
    surfaceStainingScore: number;
    windowHaziness?: number | null;
    visibleStreaks?: number | null;
    spotCoverage?: number | null;
    frameDirtScore?: number | null;
}) {
    // Determine if window lead
    const isWindowLead = lead.windowHaziness !== undefined && lead.windowHaziness !== null;

    // Base rate mapping (per m2)
    let baseRate = 15;
    if (isWindowLead) {
        baseRate = 20; // Standard window pure water wash
        if (lead.serviceType === "chemical") {
            baseRate = 30; // Spot-free chemical wash
        } else if (lead.serviceType === "solar") {
            baseRate = 45; // Premium solar panel wash
        }
    } else {
        if (lead.serviceType === "chemical") {
            baseRate = 22;
        } else if (lead.serviceType === "solar") {
            baseRate = 30;
        }
    }

    // Pitch/Access multiplier
    let pitchMultiplier = 1.0;
    if (lead.roofPitch === "medium") {
        pitchMultiplier = 1.25;
    } else if (lead.roofPitch === "steep") {
        pitchMultiplier = 1.5;
    }

    // Grime multiplier based on CV results
    let grimeScore = 0.0;
    if (isWindowLead) {
        const hazinessNormalized = (lead.windowHaziness ?? 0) / 100.0;
        const spotNormalized = (lead.spotCoverage ?? 0) / 100.0;
        const frameNormalized = (lead.frameDirtScore ?? 0) / 100.0;
        const streaksNormalized = lead.visibleStreaks ? Math.min(1.0, lead.visibleStreaks / 20.0) : 0.0;
        grimeScore = Math.max(hazinessNormalized, spotNormalized, frameNormalized, streaksNormalized);
    } else {
        grimeScore = Math.max(lead.biologicalGrowthScore, lead.surfaceStainingScore);
    }

    let grimeMultiplier = 1.0;
    if (grimeScore >= 0.70) {
        grimeMultiplier = 1.4;
    } else if (grimeScore >= 0.50) {
        grimeMultiplier = 1.2;
    }

    const unitPrice = baseRate * pitchMultiplier * grimeMultiplier;
    const subtotal = lead.estimatedArea * unitPrice;
    const tax = subtotal * 0.15;
    const total = subtotal + tax;

    // Estimate Job Difficulty
    let difficulty = "Moderate";
    if (lead.roofPitch === "steep" || grimeScore >= 0.70) {
        difficulty = "Difficult";
    } else if (lead.roofPitch === "flat" && grimeScore < 0.50) {
        difficulty = "Easy";
    }

    // Estimate Job Duration in Hours
    let duration = 4; // Base 4 hours
    duration += Math.ceil(lead.estimatedArea / 250);
    if (lead.roofPitch === "steep") duration += 2;
    if (grimeScore >= 0.70) duration += 2;

    return {
        unitPrice,
        subtotal,
        tax,
        total,
        difficulty,
        duration
    };
}

export async function updateLeadPricingAction(
    leadId: string,
    estimatedArea: number,
    roofPitch: string,
    serviceType: string
) {
    try {
        const companyId = await ensureAuth()

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                estimatedArea,
                roofPitch,
                serviceType
            }
        })

        revalidatePath("/drone")
        return { success: true, data: updatedLead }
    } catch (error: any) {
        console.error("Error updating lead pricing parameters:", error)
        return { success: false, error: error.message || "Failed to update pricing" }
    }
}

export async function generateAndSendLeadQuoteAction(leadId: string) {
    try {
        const companyId = await ensureAuth()

        // 1. Fetch Lead
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        if (lead.projectId) {
            return { success: false, error: "Lead has already been converted or quoted" }
        }

        // 2. Find or Create Client
        let client = null
        if (lead.contactEmail) {
            client = await prisma.client.findFirst({
                where: {
                    companyId,
                    email: lead.contactEmail
                }
            })
        }

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: lead.companyName || lead.contactName || "New Client (Scouted)",
                    companyName: lead.companyName,
                    email: lead.contactEmail,
                    attentionTo: lead.contactName,
                    address: lead.address,
                    notes: `Created automatically from Drone Operations Scouting Lead ID: ${lead.id}`,
                    companyId
                }
            })
        }

        // 3. Compute dynamic pricing
        const pricing = calculateLeadPricing(lead)

        // 4. Create Project in QUOTED status
        const isWindowLead = lead.windowHaziness !== null && lead.windowHaziness !== undefined;
        const projectName = isWindowLead 
            ? `Drone Window Cleaning - ${lead.companyName || lead.address || 'Scouted Site'}`
            : `Roof Restoration & Cleaning - ${lead.companyName || lead.address || 'Scouted Site'}`;
        const projectDesc = isWindowLead 
            ? `Identified via autonomous drone window inspection. Haziness = ${(lead.windowHaziness ?? 0).toFixed(0)}%, Streaks = ${lead.visibleStreaks ?? 0}. Calculated Area: ${lead.estimatedArea} m², Access: ${lead.roofPitch.toUpperCase()}, Service: ${lead.serviceType}.`
            : `Identified via autonomous drone scouting. Algae/Growth = ${(lead.biologicalGrowthScore * 100).toFixed(0)}%, Staining = ${(lead.surfaceStainingScore * 100).toFixed(0)}%. Calculated Area: ${lead.estimatedArea} m², Pitch: ${lead.roofPitch.toUpperCase()}, Service: ${lead.serviceType}.`;

        const project = await prisma.project.create({
            data: {
                name: projectName.slice(0, 100),
                description: projectDesc,
                status: 'QUOTED',
                workflowStage: 'QUOTATION',
                commercialStatus: 'AWAITING_PO',
                clientId: client.id,
                companyId
            }
        })

        // 5. Create Quote (Invoice of type 'QUOTE')
        const serviceTypeName = isWindowLead ? (
            lead.serviceType === "chemical" ? "Spot-Free Facade Chemical Wash" :
            lead.serviceType === "solar" ? "Premium Solar Panel Cleaning" :
            "Standard Window Wash (Pure Water)"
        ) : (
            lead.serviceType === "chemical" ? "Moss & Algae Chemical Treatment" :
            lead.serviceType === "solar" ? "Solar Premium Roof Cleaning & Soft-wash" :
            "Standard Roof Soft-wash Cleaning"
        );

        const accessLabel = isWindowLead ? "Access" : "Pitch";
        const quoteItems = [
            {
                description: `${serviceTypeName} (Area: ${lead.estimatedArea} m², ${accessLabel}: ${lead.roofPitch.toUpperCase()})`,
                quantity: 1,
                unitPrice: pricing.subtotal,
                area: lead.address || "",
                unit: "job"
            }
        ]

        const quoteRes = await createInvoiceAction({
            clientId: client.id,
            projectId: project.id,
            date: new Date().toISOString().split('T')[0],
            items: quoteItems,
            site: lead.address || undefined,
            reference: `Drone Lead #${lead.id.substring(0, 8).toUpperCase()}`,
            projectName: project.name,
            type: 'QUOTE'
        })

        if (!quoteRes) {
            throw new Error("Failed to create quote record")
        }

        // Fetch quote details to get its quoteNumber
        const quote = await prisma.invoice.findUnique({
            where: { id: quoteRes }
        })

        const quoteNumberStr = quote?.quoteNumber || `Q-${quoteRes.substring(0, 8).toUpperCase()}`;

        // 5b. Check Weather Forecast for Urgency Copy
        const forecast = await get72HourForecast(lead.latitude, lead.longitude)
        const hasIdealWindow = forecast.some(f => f.isIdeal)
        const idealDates = forecast.filter(f => f.isIdeal).map(f => {
            const d = new Date(f.date)
            return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        }).join(", ")

        let weatherUrgencyCopy = ""
        if (hasIdealWindow) {
            weatherUrgencyCopy = `Our drone flight dispatch has identified ideal weather window(s) on ${idealDates} (winds under 22km/h and 0% rain chance) for an immediate soft-wash cleaning and inspection with zero operations downtime.`
        } else {
            weatherUrgencyCopy = `Note: Current 3-day weather forecasts show temporary flight limits (winds > 22km/h or rain). We are monitoring the window to schedule your soft-wash sequence as soon as conditions clear.`
        }

        let dustRiskCopy = ""
        if (lead.highDust) {
            dustRiskCopy = `Additionally, our geospatial analysis tags your facility within a high-dust industrial zone. Accelerated particulate accumulation on roof membranes degrades insulation efficiency and accelerates structural decay, making regular soft-wash treatment highly recommended.`
        }

        const clientName = lead.contactName || "Property Manager"
        const addressStr = lead.address || "your facility"
        
        const customBody = `Dear ${clientName},

I hope this email finds you well.

This is the Outreach Coordinator for UR Aerial Solutions. Following our recent drone-based computer vision survey of building envelopes in your area, we have compiled a Property Health Snapshot for your facility at:
${addressStr}

Our computer vision analysis detected significant organic growth/staining, and we have generated Quote ${quoteNumberStr} for R${pricing.total.toFixed(2)} (inclusive of 15% VAT).

${weatherUrgencyCopy}

${dustRiskCopy}

Soft-wash drone cleaning is 3x faster, requires zero scaffolding, and eliminates structural risk. You can view the quote details and approve SOW directly at the link below:
http://localhost:3000/invoices/${quoteRes}

Please let us know if you have a quick 5 minutes to discuss this schedule this week.

Best regards,
The UR Aerial Solutions Team
Cape Town, South Africa
outreach@uraerials.co.za | www.uraerials.co.za`

        // 6. Send the quote email with customized body
        const emailRes = await sendInvoiceEmail(quoteRes, undefined, customBody)
        let emailLogMsg = ""
        if (emailRes.success) {
            emailLogMsg = "and successfully emailed to client via Resend"
        } else {
            emailLogMsg = `but email dispatch returned warning/error: ${emailRes.error || "provider missing"}`
        }

        // 7. Update Lead's project relationship and history timeline log
        const oldHistory = Array.isArray(lead.history) ? lead.history : []
        const updatedHistory = [
            ...oldHistory,
            {
                date: new Date().toISOString(),
                type: "system",
                content: `Quote ${quoteNumberStr} generated for R${pricing.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (Difficulty: ${pricing.difficulty}, Duration: ${pricing.duration}h) ${emailLogMsg}.`
            }
        ]

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                projectId: project.id,
                status: "quote_sent",
                history: updatedHistory
            }
        })

        revalidatePath("/drone")
        revalidatePath("/dashboard")
        revalidatePath("/invoices")
        revalidatePath("/projects")

        return { success: true, data: { project, quote: quoteRes } }
    } catch (error: any) {
        console.error("Error generating and sending lead quote:", error)
        return { success: false, error: error.message || "Failed to generate quote" }
    }
}

export async function toggleLeadHighDustAction(leadId: string, highDust: boolean) {
    try {
        const companyId = await ensureAuth()

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: { highDust }
        })

        revalidatePath("/drone")
        return { success: true, data: updatedLead }
    } catch (error: any) {
        console.error("Error toggling lead high dust status:", error)
        return { success: false, error: error.message || "Failed to update high dust status" }
    }
}

export async function getLeadWeatherForecastAction(leadId: string) {
    try {
        const companyId = await ensureAuth()

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return { success: false, error: "Lead not found or unauthorized" }
        }

        const forecast = await get72HourForecast(lead.latitude, lead.longitude)
        return { success: true, forecast }
    } catch (error: any) {
        console.error("Error fetching lead weather forecast:", error)
        return { success: false, error: error.message || "Failed to fetch weather forecast" }
    }
}
