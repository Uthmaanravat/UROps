import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"

export const COMPLIANCE_BUCKET = "compliance-documents"

function getComplianceStorageClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (supabaseUrl && serviceRoleKey) {
        return createServiceClient(supabaseUrl, serviceRoleKey)
    }

    const ssrClient = createServerSupabaseClient()
    if (ssrClient) {
        return ssrClient
    }

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase credentials missing for compliance storage.")
    }
    return createServiceClient(supabaseUrl, anonKey)
}

export function sanitizeComplianceFileName(name: string): string {
    const cleaned = (name || "document.pdf")
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "")
    return cleaned || "document.pdf"
}

function isPreviewSchemaEnv(): boolean {
    return process.env.VERCEL_ENV === "preview" || process.env.USE_THROWAWAY_SCHEMA === "true"
}

export function assertTenantStoragePath(companyId: string, storagePath: string) {
    const validTenantPrefix =
        storagePath.startsWith(`${companyId}/`) ||
        storagePath.startsWith(`throwaway_preview/${companyId}/`)
    if (!companyId || !storagePath || !validTenantPrefix || storagePath.includes("..")) {
        throw new Error("Invalid or cross-tenant compliance document path.")
    }
}

export async function uploadComplianceFile(params: {
    companyId: string
    category: string
    docId: string
    fileName: string
    mimeType: string
    buffer: Buffer
}): Promise<string> {
    const supabase = getComplianceStorageClient()
    const safeName = sanitizeComplianceFileName(params.fileName)
    const rootPrefix = isPreviewSchemaEnv() ? `throwaway_preview/${params.companyId}` : params.companyId
    const storagePath = `${rootPrefix}/${params.category}/${params.docId}-${safeName}`

    const { error } = await supabase.storage
        .from(COMPLIANCE_BUCKET)
        .upload(storagePath, params.buffer, {
            contentType: params.mimeType || "application/pdf",
            upsert: true,
        })

    if (error) {
        console.error("[Compliance Storage] Upload failed:", error)
        throw new Error(error.message || "Failed to upload compliance document.")
    }

    return storagePath
}

export async function getComplianceSignedUrl(
    companyId: string,
    storagePath: string,
    expiresInSeconds = 300,
    downloadFileName?: string
): Promise<string | null> {
    assertTenantStoragePath(companyId, storagePath)
    const supabase = getComplianceStorageClient()
    const { data, error } = await supabase.storage
        .from(COMPLIANCE_BUCKET)
        .createSignedUrl(
            storagePath,
            expiresInSeconds,
            downloadFileName ? { download: downloadFileName } : undefined
        )

    if (error || !data?.signedUrl) {
        console.error("[Compliance Storage] Signed URL error:", error)
        return null
    }
    return data.signedUrl
}

export async function downloadComplianceBuffer(
    companyId: string,
    storagePath: string
): Promise<Buffer | null> {
    assertTenantStoragePath(companyId, storagePath)
    const supabase = getComplianceStorageClient()
    const { data, error } = await supabase.storage
        .from(COMPLIANCE_BUCKET)
        .download(storagePath)

    if (error || !data) {
        console.error("[Compliance Storage] Download failed:", storagePath, error)
        return null
    }

    const ab = await data.arrayBuffer()
    return Buffer.from(ab)
}

export async function deleteComplianceFile(companyId: string, storagePath: string): Promise<void> {
    assertTenantStoragePath(companyId, storagePath)
    const supabase = getComplianceStorageClient()
    const { error } = await supabase.storage
        .from(COMPLIANCE_BUCKET)
        .remove([storagePath])

    if (error) {
        console.warn("[Compliance Storage] Remove warning:", error)
    }
}
