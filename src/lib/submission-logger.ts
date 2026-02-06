import { prisma } from "@/lib/prisma"
import { getAuthCompanyId } from "@/lib/auth-actions"

export type SubmissionType = 'SOW' | 'QUOTATION' | 'INVOICE' | 'WBP'

export interface LogSubmissionParams {
    type: SubmissionType
    documentId: string
    documentRef?: string
    projectId?: string
    clientId?: string
    submittedBy: 'ADMIN' | 'MANAGER'
    message: string
    metadata?: any
}

/**
 * Log a submission event to the database
 * This creates an explicit record of what was submitted
 */
export async function logSubmission(params: LogSubmissionParams) {
    const companyId = await getAuthCompanyId()
    if (!companyId) throw new Error("Unauthorized: No company ID found")

    const log = await prisma.submissionLog.create({
        data: {
            companyId,
            type: params.type,
            documentId: params.documentId,
            documentRef: params.documentRef,
            projectId: params.projectId,
            clientId: params.clientId,
            submittedBy: params.submittedBy,
            message: params.message,
            metadata: params.metadata
        },
        include: {
            project: true,
            client: true
        }
    })

    return log
}

/**
 * Get all submissions of a specific type
 */
export async function getSubmissionsByType(type: SubmissionType) {
    return await prisma.submissionLog.findMany({
        where: { type },
        include: {
            project: true,
            client: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Get all submissions
 */
export async function getAllSubmissions() {
    return await prisma.submissionLog.findMany({
        include: {
            project: true,
            client: true
        },
        orderBy: { createdAt: 'desc' }
    })
}
