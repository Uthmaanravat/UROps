import { validateInviteTokenAction } from "@/app/actions/auth"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { ShieldAlert } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function SignUpPage({
    searchParams,
}: {
    searchParams: { token?: string }
}) {
    const token = searchParams.token

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-card shadow-2xl text-center space-y-5">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">Invite Only</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Registration for UROps is restricted to invited team members. If your organization is already using UROps, ask an administrator to send you an invitation link.
                        </p>
                    </div>
                    <div className="pt-2">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-black hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const validation = await validateInviteTokenAction(token)

    if (!validation.valid) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <div className="w-full max-w-md p-8 rounded-2xl border border-destructive/20 bg-card shadow-2xl text-center space-y-5">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">Invalid Invitation</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {validation.error || "This invitation token is invalid or has expired."}
                        </p>
                    </div>
                    <div className="pt-2">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                        >
                            Return to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-primary mb-1">
                        UROps
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Join <span className="font-semibold text-white">{validation.companyName}</span> as a <span className="font-semibold text-primary">{validation.role}</span>
                    </p>
                </div>
                <SignUpForm
                    token={token}
                    email={validation.email!}
                    role={validation.role!}
                    companyName={validation.companyName!}
                />
                <div className="mt-6 text-center text-sm">
                    <p className="text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="text-primary hover:underline">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
