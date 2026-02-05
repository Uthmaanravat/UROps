"use client"

import { Check, Circle } from "lucide-react"

interface WorkflowTrackerProps {
    currentStage: 'SOW' | 'QUOTATION' | 'INVOICE' | 'PAYMENT' | 'COMPLETED'
}

const stages = [
    { id: 'SOW', label: 'Scope of Work' },
    { id: 'QUOTATION', label: 'Quotation' },
    { id: 'INVOICE', label: 'Invoicing' },
    { id: 'PAYMENT', label: 'Payment' },
    { id: 'COMPLETED', label: 'Complete' }
]

export function WorkflowTracker({ currentStage }: WorkflowTrackerProps) {
    const currentIndex = stages.findIndex(s => s.id === currentStage)

    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 -z-10" />
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-500"
                    style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
                />

                {stages.map((stage, index) => {
                    const isCompleted = index < currentIndex
                    const isCurrent = index === currentIndex

                    return (
                        <div key={stage.id} className="flex flex-col items-center bg-transparent group">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all 
                                ${isCompleted ? 'bg-primary border-primary text-primary-foreground shadow-[0_0_20px_rgba(163,255,0,0.3)]' :
                                        isCurrent ? 'bg-[#1A1A2E] border-primary text-primary shadow-[0_0_30px_rgba(163,255,0,0.5)] scale-110 z-10' :
                                            'bg-[#1A1A2E] border-white/10 text-white/20'}`}
                            >
                                {isCompleted ? <Check className="w-5 h-5 font-black" /> : <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                            </div>
                            <span className={`mt-3 text-[10px] uppercase tracking-widest font-black transition-colors ${isCurrent ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-white/20'}`}>
                                {stage.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
