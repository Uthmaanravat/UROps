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
    const [error, setError] = useState<string | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const recognitionRef = useRef<any>(null)
    const nativeResultRef = useRef<string>("")
    const isRecordingRef = useRef(false)
    const isMobileRef = useRef(false)
    const startTimeRef = useRef<number>(0)

    // Detect mobile/iOS on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const ua = navigator.userAgent
            isMobileRef.current = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
            console.log("Device detection - Is Mobile:", isMobileRef.current);
        }
    }, [])

    // Initialize Speech Recognition (Desktop/Non-Mobile only to avoid mic conflicts)
    useEffect(() => {
        if (typeof window !== 'undefined' && !isMobileRef.current) {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (SpeechRecognition) {
                console.log("Initializing native SpeechRecognition for desktop");
                const recognition = new SpeechRecognition()
                recognition.continuous = true
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

                    if (interimTranscript) {
                        setStatus(interimTranscript.length > 20 ? "..." + interimTranscript.slice(-20) : interimTranscript)
                    } else if (finalTranscript) {
                        setStatus("Captured!")
                        setTimeout(() => {
                            if (isRecordingRef.current) setStatus("Listening...")
                        }, 1000)
                    }
                }

                recognition.onend = () => console.log("Native recognition ended");
                recognition.onerror = (event: any) => {
                    console.error("Native Speech Recognition Error:", event.error);
                    if (event.error === 'network') setError("Network Error (Native)")
                }
                recognitionRef.current = recognition
            }
        } else if (isMobileRef.current) {
            console.log("Skipping native recognition - Mobile Mode (Mic conflict avoidance)");
        }
    }, [])

    const startRecording = async () => {
        console.log("startRecording called. Mobile mode:", isMobileRef.current);
        nativeResultRef.current = ""
        setError(null)
        setStatus("Starting...")
        startTimeRef.current = Date.now()

        // Feature detection alerts
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError("Mic access unavailable (Check HTTPS/Browser)")
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

            if (typeof MediaRecorder === 'undefined') {
                setError("MediaRecorder not supported")
                return
            }

            // Only start native recognition if it exists (Desktop)
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start()
                    console.log("Native recognition started");
                } catch (e) {
                    console.warn("Recognition start failed", e)
                }
            }

            let mediaRecorder: MediaRecorder | null = null;
            try {
                const isIOS = isMobileRef.current && /iPhone|iPad|iPod/i.test(navigator.userAgent);
                const preferredMime = isIOS ? "audio/mp4" : "audio/webm;codecs=opus";
                mediaRecorder = new MediaRecorder(stream, { mimeType: preferredMime });
            } catch (e) {
                try {
                    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
                } catch (e2) {
                    try {
                        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/mp4" });
                    } catch (e3) {
                        try {
                            mediaRecorder = new MediaRecorder(stream);
                        } catch (e4) {
                            setError("MediaRecorder init failed");
                            stream.getTracks().forEach(track => track.stop());
                            return;
                        }
                    }
                }
            }

            console.log("Using MIME Type for recording:", mediaRecorder.mimeType);

            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0)
                console.log("MediaRecorder stopped, processing audio. Total Size:", totalSize);

                const finalMimeType = mediaRecorder!.mimeType || (isMobileRef.current && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "audio/mp4" : "audio/webm")
                const audioBlob = new Blob(chunksRef.current, { type: finalMimeType })
                stream.getTracks().forEach(track => track.stop())

                if (totalSize < 500) {
                    console.warn("Audio captured is too small, likely silent/empty.");
                    setError("Empty audio (Too small)")
                    setIsProcessing(false)
                    setStatus("")
                    return
                }

                // Wait for any pending native results (desktop only)
                if (recognitionRef.current) {
                    await new Promise(r => setTimeout(r, 400))
                }

                if (!nativeResultRef.current || nativeResultRef.current.trim().length === 0) {
                    console.log("No native results (expected on mobile), using AI transcription");
                    await processAudioFallback(audioBlob)
                } else {
                    console.log("Using native results captured on desktop");
                    onResult(nativeResultRef.current.trim())
                    setIsProcessing(false)
                    setStatus("")
                }
            }

            // Start without timeslice to prevent chunk corruption on iOS Safari
            mediaRecorder.start()
            setIsRecording(true)
            onToggle?.(true)
            setStatus("Listening...")
        } catch (error: any) {
            console.error("Microphone access error:", error)
            setError(error.message || "Mic access denied")
            setStatus("Mic Error")
        }
    }

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log("Stopping recording...");
            mediaRecorderRef.current.stop()
            if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch (e) { }
            }
            setIsRecording(false)
            onToggle?.(false)
            setIsProcessing(true)
            setStatus("Finalizing...")
        } else {
            // Force reset if stuck
            setIsRecording(false)
            setIsProcessing(false)
            onToggle?.(false)
            setStatus("")
        }
    }, [onToggle])

    const processAudioFallback = async (blob: Blob) => {
        setStatus("Processing AI...")
        try {
            console.log("Sending to AI, blob size:", (blob.size / 1024).toFixed(2), "KB");
            const formData = new FormData()
            // Map MIME to extension
            const isMp4 = blob.type.includes('mp4') || blob.type.includes('m4a') || (isMobileRef.current && /iPhone|iPad|iPod/i.test(navigator.userAgent));
            const extension = isMp4 ? 'm4a' : 'webm'
            formData.append("file", blob, `recording.${extension}`)

            const result = await transcribeAudio(formData)
            if (result.success && result.text) {
                console.log("Transcription result:", result.text);
                onResult(result.text)
                setStatus("")
            } else {
                console.error("Transcription failed:", result.error)
                setError(result.error || "Transcription Failed")
                setStatus("")
            }
        } catch (error: any) {
            console.error("Processing error:", error)
            setError(error.message || "Server Error")
            setStatus("")
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant={isRecording ? "destructive" : error ? "outline" : "outline"}
                size="icon"
                className={`${className} ${isRecording ? "animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)] border-2 scale-110" : ""} ${error ? "border-red-500/50" : ""} h-8 w-8 md:h-10 md:w-10 transition-all`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                title={isRecording ? "Stop Recording" : "Start Voice Input"}
            >
                {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : isRecording ? (
                    <Square className="h-3 w-3 fill-current" />
                ) : (
                    <Mic className={`h-4 w-4 ${error ? "text-red-500" : ""}`} />
                )}
            </Button>
            {(status || error) && (
                <span className={`text-[9px] font-black uppercase tracking-tight ${error ? "text-red-500 bg-red-500/10" : "text-primary bg-primary/5"} px-2 py-1 rounded max-w-[120px] truncate`}>
                    {error ? `Err: ${error}` : status}
                </span>
            )}
        </div>
    )
}
