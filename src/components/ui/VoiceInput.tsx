"use client"

import { useState, useEffect, useCallback, useRef, memo } from "react"
import React from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff } from "lucide-react"
import { toTitleCase } from "@/lib/utils"

interface VoiceInputProps {
    onResult: (text: string) => void
    isRecording?: boolean
    onToggle?: (recording: boolean) => void
    className?: string
}

export const VoiceInput = memo(({ onResult, isRecording: externalIsRecording, onToggle, className }: VoiceInputProps) => {
    const [isRecording, setIsRecording] = useState(false)
    const [supported, setSupported] = useState(false)
    const recognitionRef = useRef<any>(null)
    const onResultRef = useRef(onResult)
    const onToggleRef = useRef(onToggle)

    // Keep refs up to date without triggering effects
    useEffect(() => {
        onResultRef.current = onResult
        onToggleRef.current = onToggle
    }, [onResult, onToggle])

    // Lazy initialization of the recognition engine
    const initRecognition = useCallback(() => {
        if (typeof window === 'undefined' || recognitionRef.current) return recognitionRef.current

        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) return null

        const searchVoice = new SpeechRecognition()
        searchVoice.continuous = true
        searchVoice.interimResults = true
        searchVoice.lang = 'en-ZA'

        searchVoice.onresult = (event: any) => {
            let finalTranscript = ''
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript
                }
            }
            if (finalTranscript) {
                onResultRef.current(toTitleCase(finalTranscript))
            }
        }

        searchVoice.onend = () => {
            setIsRecording(false)
            onToggleRef.current?.(false)
        }

        recognitionRef.current = searchVoice
        setSupported(true)
        return searchVoice
    }, [])

    // Check support on mount but don't initialize instance yet
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (SpeechRecognition) setSupported(true)
        }
    }, [])

    const handleStop = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            setIsRecording(false)
            onToggleRef.current?.(false)
        }
    }, [])

    const handleStart = useCallback(() => {
        const recognition = initRecognition()
        if (recognition) {
            try {
                recognition.start()
                setIsRecording(true)
                onToggleRef.current?.(true)
            } catch (e) {
                console.error("Speech recognition error:", e)
            }
        }
    }, [initRecognition])

    const toggleRecording = useCallback(() => {
        if (isRecording) handleStop()
        else handleStart()
    }, [isRecording, handleStop, handleStart])

    // Sync with external state if provided
    useEffect(() => {
        if (typeof externalIsRecording === 'boolean' && externalIsRecording !== isRecording) {
            if (externalIsRecording) handleStart()
            else handleStop()
        }
    }, [externalIsRecording, isRecording, handleStart, handleStop])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [])

    if (!supported) return null

    return (
        <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className={`${className} ${isRecording ? "animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop Recording" : "Start Voice Input"}
        >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
    )
})

VoiceInput.displayName = "VoiceInput"
