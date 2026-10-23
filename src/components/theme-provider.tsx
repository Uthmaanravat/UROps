"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = string

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme, companyId?: string) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyThemeClasses(t: string) {
    if (typeof window === "undefined") return
    const root = window.document.documentElement
    root.classList.remove("light", "dark", "theme-blue", "theme-orange", "theme-violet")

    if (t.includes("dark")) {
        root.classList.add("dark")
    } else {
        root.classList.add("light")
    }

    if (t.includes("blue")) root.classList.add("theme-blue")
    if (t.includes("orange")) root.classList.add("theme-orange")
    if (t.includes("violet")) root.classList.add("theme-violet")
}

export function ThemeProvider({
    children,
    initialTheme
}: {
    children: React.ReactNode
    initialTheme: Theme
}) {
    const [theme, setThemeState] = useState<Theme>(initialTheme)

    // Load active company theme from localStorage on initial mount
    useEffect(() => {
        try {
            const activeCompanyId = localStorage.getItem("urops_active_company_id")
            const savedTheme = activeCompanyId 
                ? localStorage.getItem(`urops_theme_${activeCompanyId}`)
                : localStorage.getItem("urops_theme")

            if (savedTheme) {
                setThemeState(savedTheme)
                applyThemeClasses(savedTheme)
            } else {
                applyThemeClasses(initialTheme)
            }
        } catch (e) {
            applyThemeClasses(initialTheme)
        }
    }, [initialTheme])

    const setTheme = useCallback((newTheme: Theme, companyId?: string) => {
        setThemeState(newTheme)
        applyThemeClasses(newTheme)
        try {
            if (companyId) {
                localStorage.setItem(`urops_theme_${companyId}`, newTheme)
                localStorage.setItem("urops_active_company_id", companyId)
            }
            localStorage.setItem("urops_theme", newTheme)
        } catch (e) {
            console.error("Failed to persist theme to localStorage", e)
        }
    }, [])

    useEffect(() => {
        applyThemeClasses(theme)
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

