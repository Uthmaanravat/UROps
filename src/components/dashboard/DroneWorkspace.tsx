"use client"

import { useState } from "react"
import { DroneDashboardClient } from "@/components/dashboard/DroneDashboardClient"
import { ProspectsClient } from "@/components/dashboard/ProspectsClient"
import { type ProspectDTO, type SenderInfo } from "@/lib/prospect-email"
import { Target, ScanSearch, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DroneWorkspaceProps {
    prospects: ProspectDTO[]
    sender: SenderInfo
    scannerData: {
        leads: any[]
        optOuts: any[]
    }
    quotes?: any[]
    clients?: any[]
    projects?: any[]
}

export function DroneWorkspace({
    prospects,
    sender,
    scannerData,
    quotes = [],
    clients = [],
    projects = []
}: DroneWorkspaceProps) {
    const [view, setView] = useState<"pipeline" | "scanner">("pipeline")

    if (view === "scanner") {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => setView("pipeline")}
                        className="text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Sales Pipeline
                    </Button>
                    <div className="flex items-center gap-1 bg-[#14141E]/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
                        <button
                            onClick={() => setView("pipeline")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white"
                        >
                            <Target className="h-3.5 w-3.5" /> Pipeline
                        </button>
                        <button
                            onClick={() => setView("scanner")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-primary text-black"
                        >
                            <ScanSearch className="h-3.5 w-3.5" /> Scanner
                        </button>
                    </div>
                </div>
                <DroneDashboardClient data={scannerData} />
            </div>
        )
    }

    return (
        <ProspectsClient
            prospects={prospects}
            sender={sender}
            quotes={quotes}
            clients={clients}
            projects={projects}
            onOpenScanner={() => setView("scanner")}
        />
    )
}
