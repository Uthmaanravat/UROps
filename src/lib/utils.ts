import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencySymbol: string = "R") {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return `${currencySymbol}0.00`;
    }
    
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)

    return `${currencySymbol}${formatted}`
}

export function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, (txt) => {
        if (txt === "SOW") return "SOW";
        if (txt === "PO") return "PO";
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
