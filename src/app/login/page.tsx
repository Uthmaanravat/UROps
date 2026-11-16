import { LoginForm } from "@/components/auth/LoginForm"
import { Suspense } from "react"
import { PwaLoadingScreen } from "@/components/pwa/PwaLoadingScreen"

export default function LoginPage({
    searchParams
}: {
    searchParams?: { returnTo?: string; message?: string }
}) {
    const returnTo = searchParams?.returnTo || ""
    const isLR = returnTo.includes("/app/lrbuilders")
    const isAW = returnTo.includes("/app/aerowash")

    const brandName = isLR ? "LR Builders" : (isAW ? "AeroWash" : "UROps")
    const brandSubtitle = isLR
        ? "Building & Operations Command Center"
        : isAW
        ? "Drone Operations Command Center"
        : "Professional Maintenance Management"
    const logoSrc = isLR
        ? "/icons/lrbuilders/icon-192x192.png"
        : isAW
        ? "/icons/aerowash/icon-192x192.png"
        : null

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md">
                <div className="text-center mb-8 flex flex-col items-center">
                    {logoSrc && (
                        <div className={`w-20 h-20 mb-4 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center ${
                            isLR ? "bg-white p-2 border border-zinc-700" : "bg-black border border-white/10"
                        }`}>
                            <img
                                src={logoSrc}
                                alt={brandName}
                                width={80}
                                height={80}
                                className="object-contain w-full h-full"
                            />
                        </div>
                    )}
                    <h1 className="text-3xl font-bold tracking-tight text-primary mb-1">
                        {brandName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {brandSubtitle}
                    </p>
                </div>
                <Suspense fallback={<PwaLoadingScreen app={isLR ? "lrbuilders" : (isAW ? "aerowash" : "urops")} />}>
                    <LoginForm />
                </Suspense>
                <div className="mt-6 text-center text-sm">
                    <p className="text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <a href="/signup" className="text-primary hover:underline">
                            Sign up
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
