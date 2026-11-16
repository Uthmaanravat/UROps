"use client"

import React from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"

export interface PwaLoadingScreenProps {
    app?: "aerowash" | "lrbuilders" | "urops"
    message?: string
}

export function PwaLoadingScreen({
    app = "urops",
    message
}: PwaLoadingScreenProps) {
    const isAeroWash = app === "aerowash"
    const isLRBuilders = app === "lrbuilders"

    const displayName = isAeroWash ? "AeroWash" : (isLRBuilders ? "LR Builders" : "UROps")
    const displayMessage = message || (isAeroWash ? "Loading AeroWash…" : (isLRBuilders ? "Loading LR Builders…" : "Loading UROps…"))
    const logoSrc = isAeroWash
        ? "/icons/aerowash/icon-192x192.png"
        : isLRBuilders
        ? "/icons/lrbuilders/icon-192x192.png"
        : "/icons/icon-192x192.png"
    const spinnerColor = isAeroWash
        ? "text-orange-500"
        : isLRBuilders
        ? "text-red-500"
        : "text-primary"

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A] text-zinc-100 p-6 select-none"
            style={{ backgroundColor: "#0A0A0A" }}
        >
            <div className="flex flex-col items-center max-w-xs text-center animate-in fade-in duration-200">
                {/* App Brand Logo */}
                <div className={`w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center ${
                    isLRBuilders ? "bg-white p-2 border border-zinc-700" : "bg-black border border-white/10"
                }`}>
                    <img
                        src={logoSrc}
                        alt={displayName}
                        width={96}
                        height={96}
                        className="object-contain w-full h-full"
                    />
                </div>

                {/* Animated Spinner */}
                <div className="flex items-center justify-center mb-3">
                    <Loader2 className={`w-7 h-7 animate-spin ${spinnerColor}`} />
                </div>

                {/* Loading Status Text */}
                <p className="text-sm font-semibold tracking-wide text-zinc-300 animate-pulse">
                    {displayMessage}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                    Command Center
                </p>
            </div>
        </div>
    )
}
