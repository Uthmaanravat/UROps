"use client"

import { useState } from "react"
import { DroneDashboardClient } from "@/components/dashboard/DroneDashboardClient"
import { ProspectsClient } from "@/components/dashboard/ProspectsClient"
import { type ProspectDTO, type SenderInfo } from "@/lib/prospect-email"
import { Target, ScanSearch } from "lucide-react"
import { InfoTooltip } from "@/components/ui/InfoTooltip"

interface DroneWorkspaceProps {
    prospects: ProspectDTO[]
    sender: SenderInfo
    scannerData: {
        leads: any[]
        optOuts: any[]
    }
}

export function DroneWorkspace({ prospects, sender, scannerData }: DroneWorkspaceProps) {
    const [tab, setTab] = useState<"prospects" | "scanner">("prospects")

    const tabBar = (
        <div className="flex items-center gap-1 bg-[#14141E]/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-2xl">
            <button
                onClick={() => setTab("prospects")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${tab === "prospects" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
            >
                <Target className="h-3.5 w-3.5" /> Prospects
            </button>
            <button
                onClick={() => setTab("scanner")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${tab === "scanner" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
            >
                <ScanSearch className="h-3.5 w-3.5" /> Scanner
            </button>
        </div>
    )

    if (tab === "scanner") {
        // Scanner keeps its own full header — just float the tab switcher above it.
        return (
            <div className="space-y-4">
                <div className="flex justify-end">{tabBar}</div>
                <DroneDashboardClient data={scannerData} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center">
                        Drone Prospects
                        <InfoTooltip content="Your 37 core high-moat prospects plus new discoveries — outreach drafts, statuses, and follow-up tracking." />
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">
                        Fable-37 core prospects, discoveries, outreach & follow-up tracking
                    </p>
                </div>
                {tabBar}
            </div>

            <ProspectsClient prospects={prospects} sender={sender} />
        </div>
    )
}
