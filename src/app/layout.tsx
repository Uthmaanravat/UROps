import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "UROps",
    description: "Professional Maintenance Business Software",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    let initialTheme = "dark";
    let themeClass = "dark";

    try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { companyId: true }
            });

            if (dbUser?.companyId) {
                const settings = await prisma.companySettings.findUnique({
                    where: { companyId: dbUser.companyId },
                    select: { theme: true, companyId: true, name: true }
                });

                if (settings) {
                    if (settings.theme === "dark-orange" || settings.companyId === "70af7281-072d-4ed5-9f2e-af4d93e99ea9" || settings.name.toLowerCase().includes("aerowash")) {
                        initialTheme = "dark-orange";
                        themeClass = "dark theme-orange";
                    } else if (settings.theme === "dark" || settings.name.toLowerCase().includes("lr")) {
                        initialTheme = "dark-lime";
                        themeClass = "dark theme-lime";
                    } else if (settings.theme?.includes("blue")) {
                        initialTheme = settings.theme;
                        themeClass = "dark theme-blue";
                    } else if (settings.theme?.includes("violet")) {
                        initialTheme = settings.theme;
                        themeClass = "dark theme-violet";
                    }
                }
            }
        }
    } catch (e) {
        // Fallback to neutral dark gracefully
    }

    return (
        <html lang="en" className={themeClass} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                        (function() {
                            try {
                                var activeCompanyId = localStorage.getItem("urops_active_company_id");
                                var savedTheme = activeCompanyId 
                                    ? localStorage.getItem("urops_theme_" + activeCompanyId) 
                                    : localStorage.getItem("urops_theme");
                                if (savedTheme) {
                                    var root = document.documentElement;
                                    root.classList.remove("theme-orange", "theme-lime", "theme-blue", "theme-violet");
                                    if (savedTheme.indexOf("orange") !== -1) {
                                        root.classList.add("theme-orange");
                                    } else if (savedTheme.indexOf("lime") !== -1 || savedTheme === "dark") {
                                        root.classList.add("theme-lime");
                                    } else if (savedTheme.indexOf("blue") !== -1) {
                                        root.classList.add("theme-blue");
                                    } else if (savedTheme.indexOf("violet") !== -1) {
                                        root.classList.add("theme-violet");
                                    }
                                }
                            } catch(e) {}
                        })();
                        `
                    }}
                />
            </head>
            <body className={inter.className}>
                <ThemeProvider initialTheme={initialTheme}>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
