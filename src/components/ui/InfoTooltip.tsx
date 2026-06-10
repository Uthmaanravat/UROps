"use client"

import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { HelpCircle } from "lucide-react"

interface InfoTooltipProps {
    content: string
}

export function InfoTooltip({ content }: InfoTooltipProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button 
                    type="button" 
                    className="text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none ml-1.5 inline-flex items-center align-middle"
                    aria-label="More information"
                >
                    <HelpCircle className="h-3.5 w-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent 
                side="top" 
                align="center"
                className="bg-[#14141E]/95 border border-white/10 text-white rounded-xl shadow-2xl p-3 text-xs leading-normal max-w-xs backdrop-blur-md"
            >
                {content}
            </PopoverContent>
        </Popover>
    )
}
