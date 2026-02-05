"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { uploadQuotationAction } from "@/app/(dashboard)/knowledge/actions"

export function UploadQuotesButton() {
    const router = useRouter()
    const [uploading, setUploading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setStatus('idle')

        try {
            const formData = new FormData()
            formData.append('file', file)

            const result = await uploadQuotationAction(formData)

            if (result.success) {
                setStatus('success')
                router.refresh()
                setTimeout(() => setStatus('idle'), 3000)
            } else {
                setStatus('error')
                setErrorMsg(result.error || "Unknown error")
                setTimeout(() => setStatus('idle'), 5000)
            }
        } catch (err) {
            console.error(err)
            setStatus('error')
            setErrorMsg(err instanceof Error ? err.message : "Upload failed")
            setTimeout(() => setStatus('idle'), 5000)
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.xlsx"
            />
            <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={status === 'success' ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20"}
            >
                {uploading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Quotation...
                    </>
                ) : status === 'success' ? (
                    <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Quotation Learned!
                    </>
                ) : status === 'error' ? (
                    <>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Upload Failed
                    </>
                ) : (
                    <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Old Quotations
                    </>
                )}
            </Button>
            {status === 'error' && errorMsg && (
                <div className="bg-red-500/10 border border-red-500 p-3 rounded-lg mt-2 text-right max-w-[300px]">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
                        Upload Failed
                    </p>
                    <p className="text-[10px] text-red-400 font-medium break-words">
                        {errorMsg}
                    </p>
                </div>
            )}
            {status === 'success' && (
                <p className="text-xs font-bold text-green-500 uppercase tracking-widest mt-1">
                    Knowledge Base Updated!
                </p>
            )}
            {uploading && (
                <p className="text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest">
                    AI is extracting line items and pricing...
                </p>
            )}
        </div>
    )
}
