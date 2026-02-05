"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Square, Loader2, Wand2 } from "lucide-react"
import { transcribeAudio, parseScopeOfWork } from "@/app/actions/ai"

interface VoiceRecorderProps {
    onParsed: (items: any[]) => void
}

export function VoiceRecorder({ onParsed }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })
                await processAudio(audioBlob)
            }

            mediaRecorder.start()
            setIsRecording(true)
        } catch (error) {
            console.error("Error accessing microphone:", error)
            alert("Could not access microphone. Please ensure permissions are granted.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        }
    }

    const processAudio = async (blob: Blob) => {
        setIsProcessing(true)
        try {
            const formData = new FormData()
            formData.append("file", blob, "recording.webm")

            const transcriptionResult = await transcribeAudio(formData)
            if (!transcriptionResult.success || !transcriptionResult.text) {
                throw new Error(transcriptionResult.error || "Transcription failed")
            }

            const parsingResult = await parseScopeOfWork(transcriptionResult.text)
            if (!parsingResult.success) {
                throw new Error(parsingResult.error || "Parsing failed")
            }

            onParsed(parsingResult.items)
        } catch (error: any) {
            console.error("Processing error:", error)
            alert(`Failed to process voice note: ${error.message || "Unknown error"}`)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="flex items-center gap-2 p-4 border rounded-lg bg-secondary/20">
            <div className="flex-1">
                <p className="text-sm font-medium">Voice-to-Scope</p>
                <p className="text-xs text-muted-foreground">
                    Record items (e.g., &quot;Item 1: painting...&quot;) to auto-fill the scope.
                </p>
            </div>
            {isProcessing ? (
                <Button disabled variant="outline" size="sm">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI Parsing...
                </Button>
            ) : isRecording ? (
                <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="sm"
                    className="animate-pulse"
                >
                    <Square className="mr-2 h-4 w-4" />
                    Stop Recording
                </Button>
            ) : (
                <Button onClick={startRecording} variant="outline" size="sm" className="bg-lime-500 hover:bg-lime-600 text-black border-none">
                    <Mic className="mr-2 h-4 w-4" />
                    Start Voice Note
                </Button>
            )}
        </div>
    )
}
