'use client'

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Check, ClipboardList, TrendingUp, Users, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

const steps = [
    {
        title: "Welcome to UROps!",
        description: "Professional Maintenance Business Management made easy. Let's get you started.",
        icon: <Shield className="w-12 h-12 text-primary" />,
        items: [
            "Manage clients and projects in one place",
            "Generate SOWs and Quotations quickly",
            "Track invoices and payments efficiently"
        ]
    },
    {
        title: "Clients & Projects",
        description: "Everything starts with a client. Add your clients and create projects for them.",
        icon: <Users className="w-12 h-12 text-primary" />,
        items: [
            "Store detailed client information",
            "Create projects to organize scope",
            "Link SOWs directly to projects"
        ]
    },
    {
        title: "SOW & Quotations",
        description: "Define the work and get approval. Our AI helps you price your services.",
        icon: <ClipboardList className="w-12 h-12 text-primary" />,
        items: [
            "PMs enter Scope of Work (SOW)",
            "Admins review and add pricing",
            "Generate beautiful PDF quotations"
        ]
    },
    {
        title: "Pricing Intelligence",
        description: "Learn from your history. Our AI analyzes old quotes to suggest typical prices.",
        icon: <TrendingUp className="w-12 h-12 text-primary" />,
        items: [
            "Upload old PDFs to 'Learn' prices",
            "Manage a standard catalog of pricing",
            "Get suggested prices during quoting"
        ]
    }
]

export function OnboardingGuide({ onComplete }: { onComplete: () => Promise<void> }) {
    const [currentStep, setCurrentStep] = useState(0)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            startTransition(async () => {
                await onComplete()
            })
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const step = steps[currentStep]

    return (
        <Card className="w-full max-w-2xl mx-auto border-primary/20 bg-background/50 backdrop-blur-md">
            <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                    {step.icon}
                </div>
                <CardTitle className="text-3xl text-primary font-bold">{step.title}</CardTitle>
                <CardDescription className="text-lg">{step.description}</CardDescription>
            </CardHeader>
            <CardContent className="py-6">
                <ul className="space-y-4">
                    {step.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                <Check className="w-4 h-4" />
                            </div>
                            <span className="text-lg">{item}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-primary/10 pt-6">
                <div className="flex gap-2">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i === currentStep ? 'bg-primary' : 'bg-primary/20'}`}
                        />
                    ))}
                </div>
                <div className="flex gap-3">
                    {currentStep > 0 && (
                        <Button variant="outline" onClick={handleBack} disabled={isPending}>
                            Back
                        </Button>
                    )}
                    <Button onClick={handleNext} className="min-w-[100px]" disabled={isPending}>
                        {isPending ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span>
                                Processing...
                            </>
                        ) : (
                            currentStep === steps.length - 1 ? "Get Started" : "Next"
                        )}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
