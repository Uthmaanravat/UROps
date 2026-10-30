"use client"

export interface QueuedJobPhoto {
    id: string
    projectId: string
    kind: "ELEVATION_BEFORE" | "ELEVATION_AFTER" | "ISSUE"
    elevationKey?: string
    caption?: string
    dataUrl: string
    takenAt: string
    attempts: number
    lastError?: string
}

const DB_NAME = "urops_offline_queue_v1"
const STORE_NAME = "pending_photos"
export const PHOTO_QUEUE_EVENT = "urops-photo-queue-changed"

function emitQueueChange() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PHOTO_QUEUE_EVENT))
    }
}

function openQueueDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !("indexedDB" in window)) {
            reject(new Error("IndexedDB unavailable"))
            return
        }
        const req = window.indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
                store.createIndex("by_project", "projectId", { unique: false })
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"))
    })
}

export async function enqueueOfflinePhoto(photo: QueuedJobPhoto): Promise<void> {
    const db = await openQueueDb()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite")
        tx.objectStore(STORE_NAME).put(photo)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
    db.close()
    emitQueueChange()
}

export async function listQueuedPhotos(projectId?: string): Promise<QueuedJobPhoto[]> {
    try {
        const db = await openQueueDb()
        const items = await new Promise<QueuedJobPhoto[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly")
            const store = tx.objectStore(STORE_NAME)
            const req = projectId
                ? store.index("by_project").getAll(projectId)
                : store.getAll()
            req.onsuccess = () => resolve((req.result as QueuedJobPhoto[]) || [])
            req.onerror = () => reject(req.error)
        })
        db.close()
        return items.sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    } catch {
        return []
    }
}

export async function removeQueuedPhoto(id: string): Promise<void> {
    try {
        const db = await openQueueDb()
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            tx.objectStore(STORE_NAME).delete(id)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
        db.close()
        emitQueueChange()
    } catch {
        // Ignore
    }
}

export async function recordQueuedPhotoFailure(id: string, errorMessage: string): Promise<void> {
    try {
        const db = await openQueueDb()
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            const getReq = store.get(id)
            getReq.onsuccess = () => {
                const existing = getReq.result as QueuedJobPhoto | undefined
                if (existing) {
                    store.put({
                        ...existing,
                        attempts: (existing.attempts || 0) + 1,
                        lastError: errorMessage
                    })
                }
            }
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
        db.close()
        emitQueueChange()
    } catch {
        // Ignore
    }
}

/**
 * Compresses camera / gallery images on Android phones down to ~100-180 KB JPEG
 * so uploads work reliably over slow cellular connections.
 */
export function compressJobPhotoFile(
    file: File,
    maxDimension = 1280,
    quality = 0.75
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error("Failed to read image file"))
        reader.onload = () => {
            const src = reader.result as string
            const img = new Image()
            img.onerror = () => resolve(src)
            img.onload = () => {
                try {
                    let width = img.naturalWidth || img.width
                    let height = img.naturalHeight || img.height
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width)
                            width = maxDimension
                        } else {
                            width = Math.round((width * maxDimension) / height)
                            height = maxDimension
                        }
                    }
                    const canvas = document.createElement("canvas")
                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext("2d")
                    if (!ctx) {
                        resolve(src)
                        return
                    }
                    ctx.imageSmoothingEnabled = true
                    ctx.imageSmoothingQuality = "high"
                    ctx.drawImage(img, 0, 0, width, height)
                    resolve(canvas.toDataURL("image/jpeg", quality))
                } catch {
                    resolve(src)
                }
            }
            img.src = src
        }
        reader.readAsDataURL(file)
    })
}
