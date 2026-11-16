import { headers } from "next/headers"
import { PwaLoadingScreen } from "@/components/pwa/PwaLoadingScreen"

export default function RootLoading() {
    let app: "aerowash" | "lrbuilders" | "urops" = "urops"

    try {
        const headersList = headers()
        const pathname = headersList.get("x-pathname") || ""
        const nextUrl = headersList.get("next-url") || ""
        const referer = headersList.get("referer") || ""
        const explicitWorkspace = headersList.get("x-workspace") || ""

        if (
            explicitWorkspace === "lrbuilders" ||
            pathname.includes("/app/lrbuilders") ||
            nextUrl.includes("/app/lrbuilders") ||
            referer.includes("/app/lrbuilders")
        ) {
            app = "lrbuilders"
        } else if (
            explicitWorkspace === "aerowash" ||
            pathname.includes("/app/aerowash") ||
            nextUrl.includes("/app/aerowash") ||
            referer.includes("/app/aerowash")
        ) {
            app = "aerowash"
        } else {
            app = "aerowash"
        }
    } catch {}

    return <PwaLoadingScreen app={app} />
}
