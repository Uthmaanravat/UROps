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

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const settings = await prisma.companySettings.findUnique({
        where: { id: "default" }
    });
    const initialTheme = (settings?.theme as "light" | "dark") || "dark";

    return (
        <html lang="en" className={initialTheme}>
            <body className={inter.className}>
                <ThemeProvider initialTheme={initialTheme}>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
