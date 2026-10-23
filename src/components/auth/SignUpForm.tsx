'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { signUpAction } from "@/app/actions/auth"
import { Badge } from "@/components/ui/badge"

interface SignUpFormProps {
    token: string
    email: string
    role: string
    companyName: string
}

export function SignUpForm({ token, email, role, companyName }: SignUpFormProps) {
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append("token", token)
            formData.append("name", name)
            formData.append("password", password)

            const result = await signUpAction(formData)

            if (result.success) {
                if ((result as any).needsConfirmation) {
                    router.push("/login?message=Check your email to confirm your account")
                } else {
                    router.push("/dashboard")
                }
            } else {
                setError(result.error || "An error occurred during registration.")
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto border-white/10 shadow-xl bg-card">
            <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Complete Registration</CardTitle>
                <CardDescription>
                    Create your login credentials for <span className="text-white font-medium">{companyName}</span>.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Invited Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            disabled
                            className="bg-muted/50 cursor-not-allowed text-muted-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="role">Assigned Role</Label>
                            <Badge variant="outline" className="border-primary/40 text-primary uppercase text-[10px] tracking-wider">
                                {role}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Role is defined by your invitation and cannot be changed here.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Create Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                        <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                            {error}
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full font-semibold" disabled={loading}>
                        {loading ? "Creating Account..." : "Create Account & Join"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
