"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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
    const [status, setStatus] = useState<string>("")
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const recognitionRef = useRef<any>(null)
    const nativeResultRef = useRef<string>("")
    const isRecordingRef = useRef(false)

    // Sync ref with state
    useEffect(() => {
        isRecordingRef.current = isRecording
    }, [isRecording])

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition()
                recognition.continuous = true // Changed to true for better long-form capture
                recognition.interimResults = true
                recognition.lang = 'en-ZA'

                recognition.onresult = (event: any) => {
                    let finalTranscript = ""
                    let interimTranscript = ""
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        const transcript = event.results[i][0].transcript
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript
                        } else {
                            interimTranscript += transcript
                        }
                    }

                    if (finalTranscript) {
                        nativeResultRef.current += (nativeResultRef.current ? " " : "") + finalTranscript
                    }

                    // Show real-time feedback in the status
                    if (interimTranscript) {
                        setStatus(interimTranscript.length > 20 ? "..." + interimTranscript.slice(-20) : interimTranscript)
                    } else if (finalTranscript) {
                        setStatus("Captured!")
                        setTimeout(() => {
                            if (isRecordingRef.current) setStatus("Listening...")
                        }, 1000)
                    }
                }

                recognition.onend = () => {
                    console.log("Native recognition ended");
                }

                recognition.onerror = (event: any) => {
                    console.error("Native Speech Recognition Error:", event.error)
                    if (event.error === 'network') {
                        setStatus("Network Error (Native)")
                    }
                }

                recognitionRef.current = recognition
            }
        }
    }, [])

    const startRecording = async () => {
        console.log("startRecording called");
        nativeResultRef.current = ""
        setStatus("Ready...")

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start()
                    setStatus("Listening...")
                } catch (e) {
                    console.warn("Recognition start failed", e)
                }
            }

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "audio/webm"

            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: mimeType })
                stream.getTracks().forEach(track => track.stop())

                // Small delay to allow recognition.onresult to finish if it's lagging
                await new Promise(r => setTimeout(r, 300))

                if (!nativeResultRef.current || nativeResultRef.current.trim().length === 0) {
                    console.log("No native result, using AI fallback");
                    await processAudioFallback(audioBlob)
                } else {
                    console.log("Using native result:", nativeResultRef.current);
                    onResult(nativeResultRef.current.trim())
                    setIsProcessing(false)
                    setStatus("")
                }
            }

            mediaRecorder.start(1000)
            setIsRecording(true)
            onToggle?.(true)
        } catch (error) {
            console.error("Microphone access error:", error)
            alert("Could not access microphone.")
            setStatus("Mic Error")
        }
    }

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
            if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch (e) { }
            }
            setIsRecording(false)
            onToggle?.(false)
            setIsProcessing(true) // Start the "processing" state until onstop finishes
            setStatus("Finalizing...")
        }
    }, [onToggle])

    const processAudioFallback = async (blob: Blob) => {
        setStatus("Using AI Fallback...")
        try {
            const formData = new FormData()
            const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
            formData.append("file", blob, `recording.${extension}`)

            const result = await transcribeAudio(formData)
            if (result.success && result.text) {
                onResult(result.text)
            } else {
                console.error("Transcription failed:", result.error)
            }
        } catch (error) {
            console.error("Processing error:", error)
        } finally {
            setIsProcessing(false)
            setStatus("")
        }
    }

    return (
        <div className="flex items-center gap-2">
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
            {status && (
                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse whitespace-nowrap">
                    {status}
                </span>
            )}
        </div>
    )
}
