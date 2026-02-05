"use client"

import { useState, useEffect, useCallback } from "react"
import React from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Loader2 } from "lucide-react"

interface VoiceInputProps {
    onResult: (text: string) => void
    isRecording?: boolean
    onToggle?: (recording: boolean) => void
    className?: string
}

export function VoiceInput({ onResult, isRecording: externalIsRecording, onToggle, className }: VoiceInputProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [recognition, setRecognition] = useState<any>(null)
    const [supported, setSupported] = useState(false)

    const handleStop = useCallback(() => {
        if (recognition) {
            recognition.stop()
            setIsRecording(false)
            onToggle?.(false)
        }
    }, [recognition, onToggle])

    const handleStart = useCallback(() => {
        if (recognition) {
            try {
                recognition.start()
                setIsRecording(true)
                onToggle?.(true)
            } catch (e) {
                console.error("Speech recognition error:", e)
            }
        }
    }, [recognition, onToggle])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (SpeechRecognition) {
                const searchVoice = new SpeechRecognition()
                searchVoice.continuous = true
                searchVoice.interimResults = true
                searchVoice.lang = 'en-US' // Default to English

                searchVoice.onresult = (event: any) => {
                    let finalTranscript = ''
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript
                        }
                    }
                    if (finalTranscript) {
                        onResult(finalTranscript)
                    }
                }

                searchVoice.onend = () => {
                    if (isRecording) {
                        handleStop()
                    }
                }

                setRecognition(searchVoice)
                setSupported(true)
            }
        }
    }, [onResult, isRecording, handleStop])

    const toggleRecording = () => {
        if (isRecording) {
            handleStop()
        } else {
            handleStart()
        }
    }

    // Sync with external state if provided
    useEffect(() => {
        if (typeof externalIsRecording === 'boolean' && externalIsRecording !== isRecording) {
            if (externalIsRecording) handleStart()
            else handleStop()
        }
    }, [externalIsRecording, isRecording, handleStart, handleStop])

    if (!supported) return null // Don't show if not supported

    return (
        <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className={`${className} ${isRecording ? "animate-pulse" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop Recording" : "Start Voice Input"}
        >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
    )
}
