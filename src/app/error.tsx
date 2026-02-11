'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Root Error:', error)
    }, [error])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <div className="max-w-md space-y-4 p-8 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900">
                <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Application Error</h1>
                <p className="text-muted-foreground text-sm">
                    A critical error occurred while loading the application.
                </p>
                {error.digest && (
                    <div className="text-[10px] font-mono text-muted-foreground/50 break-all">
                        Error ID: {error.digest}
                    </div>
                )}
                <div className="flex gap-2 justify-center">
                    <Button onClick={() => reset()} variant="outline">Try again</Button>
                    <Button onClick={() => window.location.href = '/'}>Back to Home</Button>
                </div>
            </div>
        </div>
    )
}
