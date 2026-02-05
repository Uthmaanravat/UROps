import { SignUpForm } from "@/components/auth/SignUpForm"

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">
                        UROps
                    </h1>
                    <p className="text-muted-foreground">
                        Professional Maintenance Management
                    </p>
                </div>
                <SignUpForm />
                <div className="mt-6 text-center text-sm">
                    <p className="text-muted-foreground">
                        Already have an account?{" "}
                        <a href="/login" className="text-primary hover:underline">
                            Log in
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
