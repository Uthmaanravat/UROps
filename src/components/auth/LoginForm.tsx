'use client'

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { signInAction } from "@/app/actions/auth"
import { PwaLoadingScreen } from "@/components/pwa/PwaLoadingScreen"

export function LoginForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState("")
    const [error, setError] = useState<string | null>(null)
    const searchParams = useSearchParams()
    const message = searchParams.get("message")
    const returnTo = searchParams.get("returnTo")
    const appQuery = searchParams.get("app")

    const [storedApp, setStoredApp] = useState<string | null>(null)

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem("urops_pwa_app")
            if (saved) setStoredApp(saved)
            if (returnTo?.includes("/app/lrbuilders") || appQuery === "lrbuilders") {
                sessionStorage.setItem("urops_pwa_app", "lrbuilders")
                setStoredApp("lrbuilders")
            } else if (returnTo?.includes("/app/aerowash") || appQuery === "aerowash") {
                sessionStorage.setItem("urops_pwa_app", "aerowash")
                setStoredApp("aerowash")
            }
        } catch {}
    }, [returnTo, appQuery])

    const isLR = Boolean(
        returnTo?.includes("/app/lrbuilders") ||
        appQuery === "lrbuilders" ||
        storedApp === "lrbuilders"
    )
    const isAW = Boolean(
        returnTo?.includes("/app/aerowash") ||
        appQuery === "aerowash" ||
        storedApp === "aerowash"
    )

    const targetApp: "aerowash" | "lrbuilders" | "urops" = isLR ? "lrbuilders" : (isAW ? "aerowash" : "urops")
    const appDisplayName = isLR ? "LR Builders" : (isAW ? "AeroWash" : "UROps")

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setLoadingMessage(`Signing in to ${appDisplayName}…`)
        setError(null)

        try {
            const formData = new FormData()
            formData.append("email", email)
            formData.append("password", password)

            const result = await signInAction(formData)

            if (result.success) {
                setLoadingMessage(`Loading ${appDisplayName}…`)

                let target: string = returnTo || ""
                if (!target) {
                    if (isLR) target = "/app/lrbuilders"
                    else if (isAW) target = "/app/aerowash"
                    else target = (result as any).redirectTo || "/dashboard"
                }

                try {
                    if (isLR) sessionStorage.setItem("urops_pwa_app", "lrbuilders")
                    if (isAW) sessionStorage.setItem("urops_pwa_app", "aerowash")
                } catch {}

                window.location.href = target || "/dashboard"
            } else {
                setError(result.error || "Invalid email or password")
                setLoading(false)
            }
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    if (loading) {
        return <PwaLoadingScreen app={targetApp} message={loadingMessage} />
    }

    return (
        <Card className="w-full max-w-md mx-auto border-white/10 bg-card shadow-2xl">
            <CardHeader>
                <CardTitle>{isLR ? "Log In to LR Builders" : (isAW ? "Log In to AeroWash" : "Log In")}</CardTitle>
                <CardDescription>
                    {isLR
                        ? "Enter your credentials to access LR Builders workspace."
                        : isAW
                        ? "Enter your credentials to access AeroWash workspace."
                        : "Enter your credentials to access your account."}
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4">
                    {message && (
                        <div className="p-3 rounded-md bg-primary/10 border border-primary text-primary text-sm">
                            {message}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button
                        type="submit"
                        className={`w-full font-semibold ${
                            isLR ? "bg-red-600 hover:bg-red-500 text-white" : (isAW ? "bg-orange-600 hover:bg-orange-500 text-white" : "")
                        }`}
                        disabled={loading}
                    >
                        {loading ? `Signing in to ${appDisplayName}…` : `Log In to ${appDisplayName}`}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
