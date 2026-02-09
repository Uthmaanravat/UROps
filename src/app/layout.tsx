import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "UROps",
    description: "Professional Maintenance Business Software",
    manifest: "/manifest.json",
    icons: {
        icon: "/icon.png",
        apple: "/apple-icon.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#0f172a",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // For app-like feel
};

import { ThemeProvider } from "@/components/theme-provider";
import { prisma } from "@/lib/prisma";
import { getAuthCompanyId } from "@/lib/auth-actions";
import { SessionMonitor } from "@/components/auth/SessionMonitor";

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const companyId = await getAuthCompanyId();
    console.log("RootLayout: Fetching settings for companyId:", companyId || "FIRST_AVAILABLE")

    // If we have a companyId (logged in), use it. 
    // Otherwise fallback to the first settings record (for login/branding)
    const settings = companyId
        ? await prisma.companySettings.findUnique({ where: { companyId } })
        : await prisma.companySettings.findFirst();

    console.log("RootLayout: Settings found:", settings ? "YES" : "NO")
    const initialTheme = (settings?.theme as "light" | "dark") || "dark";

    return (
        <html lang="en" className={initialTheme}>
            <body className={inter.className}>
                <SessionMonitor />
                <ThemeProvider initialTheme={initialTheme}>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
