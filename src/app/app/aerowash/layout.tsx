import type { Metadata, Viewport } from "next"

export const viewport: Viewport = {
    themeColor: "#0A0A0A",
    width: "device-width",
    initialScale: 1,
}

export const metadata: Metadata = {
    title: {
        default: "AeroWash",
        template: "%s | AeroWash",
    },
    description: "AeroWash Drone Cleaning Solutions & Operations Command Center",
    manifest: "/manifest-aerowash.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "AeroWash",
    },
    icons: {
        icon: [
            { url: "/icons/aerowash/icon-192x192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/aerowash/icon-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [
            { url: "/icons/aerowash/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
    },
}

export default function AeroWashAppLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
