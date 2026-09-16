"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ItemPositionInputProps {
    position: number; // 1-based position (e.g. 1, 2, 3...)
    totalItems: number; // Total number of items in list
    onMove: (targetPosition: number) => void;
    className?: string;
    disabled?: boolean;
}

export function ItemPositionInput({
    position,
    totalItems,
    onMove,
    className = "",
    disabled = false
}: ItemPositionInputProps) {
    const [inputValue, setInputValue] = useState<string>(String(position));
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep input in sync with external position changes when not actively focused
    useEffect(() => {
        if (!isFocused) {
            setInputValue(String(position));
        }
    }, [position, isFocused]);

    const commitChange = () => {
        setIsFocused(false);
        const trimmed = inputValue.trim();
        if (!trimmed) {
            setInputValue(String(position));
            return;
        }

        const parsed = parseInt(trimmed, 10);
        if (isNaN(parsed)) {
            setInputValue(String(position));
            return;
        }

        // Clamp target position between 1 and totalItems
        const clamped = Math.max(1, Math.min(totalItems, parsed));
        setInputValue(String(clamped));

        if (clamped !== position) {
            onMove(clamped);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commitChange();
            inputRef.current?.blur();
        } else if (e.key === "Escape") {
            e.preventDefault();
            setInputValue(String(position));
            setIsFocused(false);
            inputRef.current?.blur();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const target = Math.max(1, position - 1);
            if (target !== position) {
                onMove(target);
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const target = Math.min(totalItems, position + 1);
            if (target !== position) {
                onMove(target);
            }
        }
    };

    const isModified = isFocused && inputValue.trim() !== "" && parseInt(inputValue, 10) !== position;

    return (
        <div className="relative inline-flex items-center group/pos">
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputValue}
                disabled={disabled}
                onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ""))}
                onFocus={(e) => {
                    setIsFocused(true);
                    e.target.select();
                }}
                onBlur={commitChange}
                onKeyDown={handleKeyDown}
                aria-label={`Item position ${position} of ${totalItems}`}
                title={`Item #${position} of ${totalItems}. Type a number (1-${totalItems}) and press Enter to move.`}
                className={cn(
                    "w-9 md:w-10 h-7 text-center font-black text-xs rounded-md transition-all select-all",
                    "bg-[#14141E] border border-white/15 text-white/90 shadow-inner",
                    "hover:border-primary/60 hover:text-white hover:bg-white/[0.04]",
                    "focus:border-primary focus:bg-primary/10 focus:text-primary focus:ring-1 focus:ring-primary/40 focus:outline-none",
                    "selection:bg-primary selection:text-black",
                    isModified && "border-primary text-primary bg-primary/10 ring-1 ring-primary/40",
                    className
                )}
            />
        </div>
    );
}
