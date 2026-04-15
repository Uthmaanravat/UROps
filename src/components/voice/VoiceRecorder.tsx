"use client"

import { useState, useRef, useEffect } from "react"
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
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try { mediaRecorderRef.current.stop(); } catch (e) {}
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

            let mimeType = '';
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                const types = isSafari 
                    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac']
                    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
                
                for (const t of types) {
                    if (MediaRecorder.isTypeSupported(t)) {
                        mimeType = t;
                        break;
                    }
                }
            }

            let mediaRecorder: MediaRecorder | null = null;
            try {
                mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            } catch (e) {
                try {
                    mediaRecorder = new MediaRecorder(stream);
                } catch (e2) {
                    alert("MediaRecorder initialization failed.");
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
            }

            mediaRecorderRef.current = mediaRecorder
            streamRef.current = stream
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const rawMimeType = mediaRecorder!.mimeType || mimeType || "audio/webm"
                // Strip codecs=opus from type as OpenAI API expects basic MIME type
                const cleanMimeType = rawMimeType.split(';')[0]
                const audioBlob = new Blob(chunksRef.current, { type: cleanMimeType })
                // Stop tracks safely here, once data is fully acquired
                stream.getTracks().forEach(track => track.stop());
                await processAudio(audioBlob)
            }

            // Start without timeslice to prevent chunk corruption on iOS Safari
            mediaRecorder.start()
            setIsRecording(true)
        } catch (error) {
            console.error("Error accessing microphone:", error)
            alert("Could not access microphone. Please ensure permissions are granted and no other app is using it.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            // Stream stopping now handled safely inside onstop
        }
    }

    const processAudio = async (blob: Blob) => {
        setIsProcessing(true)
        try {
            const formData = new FormData()
            const isMp4 = blob.type.includes('mp4') || blob.type.includes('m4a') || blob.type.includes('aac');
            const extension = isMp4 ? 'm4a' : 'webm'
            formData.append("file", blob, `recording.${extension}`)

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
