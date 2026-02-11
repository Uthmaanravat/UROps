"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Square, Loader2 } from "lucide-react"
import { transcribeAudio } from "@/app/actions/ai"

interface VoiceFieldInputProps {
    onResult: (text: string) => void
    isRecording?: boolean
    onToggle?: (recording: boolean) => void
    className?: string
}

export function VoiceFieldInput({ onResult, isRecording: externalIsRecording, onToggle, className }: VoiceFieldInputProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

            // Mobile compatibility: check supported types
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "audio/webm"

            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: mimeType })
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())
                await processAudio(audioBlob)
            }

            mediaRecorder.start(1000)
            setIsRecording(true)
            onToggle?.(true)
        } catch (error) {
            console.error("Error accessing microphone:", error)
            alert("Could not access microphone. Please ensure permissions are granted.")
        }
    }

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            onToggle?.(false)
        }
    }, [onToggle])

    const processAudio = async (blob: Blob) => {
        setIsProcessing(true)
        try {
            const formData = new FormData()
            // Ensure extension matches possible blob types
            const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
            formData.append("file", blob, `recording.${extension}`)

            const result = await transcribeAudio(formData)
            if (result.success && result.text) {
                onResult(result.text)
            } else {
                console.error("Transcription failed:", result.error)
                alert(result.error || "Failed to transcribe audio. Please try again.")
            }
        } catch (error) {
            console.error("Processing error:", error)
        } finally {
            setIsProcessing(false)
        }
    }

    // Handle external toggle if needed
    // Note: We mostly rely on internal state but respect props if needed for complex coordination

    return (
        <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className={`${className} ${isRecording ? "animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            title={isRecording ? "Stop Recording" : "Start Voice Input"}
        >
            {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
                <Square className="h-3 w-3 fill-current" />
            ) : (
                <Mic className="h-4 w-4" />
            )}
        </Button>
    )
}
