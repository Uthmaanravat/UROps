"use client"

import React from "react"
import { Wind, CloudRain, AlertTriangle, CheckCircle2, ShieldAlert, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EvaluatedFlightWeather } from "@/lib/weather"

export function WeatherBadge({
    weather,
    compact = false,
    className
}: {
    weather?: EvaluatedFlightWeather | null
    compact?: boolean
    className?: string
}) {
    if (!weather || !weather.forecast) {
        if (compact) return null
        return (
            <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-white/5 text-slate-400 border border-white/10", className)}>
                <Wind className="h-3.5 w-3.5 opacity-60" />
                Forecast pending (16d window)
            </span>
        )
    }

    const f = weather.forecast
    const metricsText = `${f.windSpeedKmh} km/h (gusts ${f.windGustsKmh}) · ${f.rainMm} mm`

    if (weather.status === 'UNCONFIGURED') {
        return (
            <div
                title={weather.unconfiguredNotice}
                className={cn(
                    "inline-flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30",
                    className
                )}
            >
                <Settings2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>{metricsText}</span>
                {!compact && (
                    <span className="text-[10px] font-semibold text-amber-200/90 underline decoration-dotted">
                        — Set limits from the JTC10 specification and ABEOD operations manual
                    </span>
                )}
            </div>
        )
    }

    const styles =
        weather.status === 'NO_FLY'
            ? "bg-red-500/15 text-red-300 border-red-500/40"
            : weather.status === 'MARGINAL'
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"

    const Icon =
        weather.status === 'NO_FLY'
            ? ShieldAlert
            : weather.status === 'MARGINAL'
                ? AlertTriangle
                : CheckCircle2

    return (
        <div
            title={weather.reasons.join(" • ")}
            className={cn(
                "inline-flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border",
                styles,
                className
            )}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="uppercase tracking-wider font-black">{weather.badgeLabel}</span>
            <span className="opacity-85 font-semibold">· {f.windSpeedKmh}/{f.windGustsKmh} km/h</span>
            {f.rainMm > 0 && (
                <span className="inline-flex items-center gap-0.5 opacity-90">
                    <CloudRain className="h-3 w-3" /> {f.rainMm}mm
                </span>
            )}
            {weather.sprayDriftWarning && weather.status === 'NO_FLY' && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-200 border border-amber-400/30">
                    + Spray Drift
                </span>
            )}
        </div>
    )
}
