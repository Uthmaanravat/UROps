import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const BUCKET_NAME = 'quotation-photos';

export function getSupabaseAdmin() {
    if (supabaseUrl && serviceRoleKey) {
        return createServiceClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }

    try {
        const ssrClient = createServerSupabaseClient();
        if (ssrClient) {
            return ssrClient;
        }
    } catch {
        // Fallback error thrown below if outside request context without service role key
    }

    throw new Error('Server-side Supabase credentials required for quotation-photos storage.');
}

export function assertQuotePhotoTenantPath(storagePath: string, companyId?: string) {
    if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) {
        throw new Error('Invalid storage path.');
    }
    if (companyId && !storagePath.startsWith(`${companyId}/`)) {
        throw new Error('Cross-tenant storage path access denied.');
    }
}

/**
 * Uploads a base64 or buffer photo to private quotation-photos bucket.
 * Path format: ${companyId}/${quoteId}/${filename}
 */
export async function uploadQuotePhoto(
    companyId: string,
    quoteId: string,
    filename: string,
    dataOrBuffer: string | Buffer
): Promise<string> {
    if (!companyId || !quoteId) {
        throw new Error('companyId and quoteId are required for photo upload.');
    }
    const supabase = getSupabaseAdmin();
    let buffer: Buffer;
    let contentType = 'image/jpeg';

    if (Buffer.isBuffer(dataOrBuffer)) {
        buffer = dataOrBuffer;
    } else if (typeof dataOrBuffer === 'string') {
        if (dataOrBuffer.startsWith('data:')) {
            const matches = dataOrBuffer.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                contentType = matches[1];
                buffer = Buffer.from(matches[2], 'base64');
            } else {
                buffer = Buffer.from(dataOrBuffer, 'base64');
            }
        } else {
            buffer = Buffer.from(dataOrBuffer, 'base64');
        }
    } else {
        throw new Error('Invalid photo data format');
    }

    const safeFilename = (filename || 'photo.jpg').replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${companyId}/${quoteId}/${safeFilename}`;
    assertQuotePhotoTenantPath(storagePath, companyId);

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
            contentType,
            upsert: true
        });

    if (error) {
        console.error('Failed to upload photo to Supabase storage:', error);
        throw error;
    }

    return storagePath;
}

/**
 * Creates a short-lived signed URL for a private storage path after verifying path safety.
 * If the path is already an absolute HTTP URL or data URL, returns it unchanged.
 */
export async function getSignedPhotoUrl(
    path: string,
    expiresIn = 900,
    companyId?: string
): Promise<string> {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    try {
        assertQuotePhotoTenantPath(path, companyId);
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(path, expiresIn);

        if (error || !data?.signedUrl) {
            console.error('Failed to create signed URL for path:', path, error);
            return path;
        }
        return data.signedUrl;
    } catch (err) {
        console.error('Error generating signed URL:', err);
        return path;
    }
}

/**
 * Resolves an array of photo objects with signed URLs for any private paths.
 */
export async function resolvePhotoUrls<T extends { url: string }>(
    photos: T[],
    companyId?: string
): Promise<T[]> {
    if (!photos || photos.length === 0) return [];
    return Promise.all(
        photos.map(async (photo) => {
            if (photo.url && !photo.url.startsWith('http://') && !photo.url.startsWith('https://') && !photo.url.startsWith('data:')) {
                const signedUrl = await getSignedPhotoUrl(photo.url, 900, companyId);
                return { ...photo, url: signedUrl };
            }
            return photo;
        })
    );
}

/**
 * Resolves a photo path or URL into a base64 data URL for PDF generation
 */
export async function resolvePhotoToBase64(
    pathOrUrl: string,
    companyId?: string
): Promise<string | null> {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('data:image/')) return pathOrUrl;

    try {
        const supabase = getSupabaseAdmin();
        if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
            assertQuotePhotoTenantPath(pathOrUrl, companyId);
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .download(pathOrUrl);
            if (data && !error) {
                const arrayBuffer = await data.arrayBuffer();
                const buf = Buffer.from(arrayBuffer);
                return `data:image/jpeg;base64,${buf.toString('base64')}`;
            }
        } else {
            const res = await fetch(pathOrUrl);
            const arrayBuffer = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuffer);
            return `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
    } catch (err) {
        console.error('Failed to convert photo to base64:', err);
    }
    return null;
}
