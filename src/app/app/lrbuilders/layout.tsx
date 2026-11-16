import type { Metadata, Viewport } from "next"

export const viewport: Viewport = {
    themeColor: "#FFFFFF",
    width: "device-width",
    initialScale: 1,
}

export const metadata: Metadata = {
    title: {
        default: "LR Builders",
        template: "%s | LR Builders",
    },
    description: "LR Builders Project & Operations Command Center",
    manifest: "/manifest-lrbuilders.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "LR Builders",
    },
    icons: {
        icon: [
            { url: "/icons/lrbuilders/icon-192x192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/lrbuilders/icon-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [
            { url: "/icons/lrbuilders/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
    },
}

export default function LRBuildersAppLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
