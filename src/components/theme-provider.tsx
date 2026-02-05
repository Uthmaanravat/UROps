"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = string

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({
    children,
    initialTheme
}: {
    children: React.ReactNode
    initialTheme: Theme
}) {
    const [theme, setTheme] = useState<Theme>(initialTheme)

    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark", "theme-blue", "theme-orange", "theme-violet")

        if (theme.includes("dark")) {
            root.classList.add("dark")
        } else {
            root.classList.add("light")
        }

        if (theme.includes("blue")) root.classList.add("theme-blue")
        if (theme.includes("orange")) root.classList.add("theme-orange")
        if (theme.includes("violet")) root.classList.add("theme-violet")
    }, [theme])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return context
}
