'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Dashboard Error:', error)
    }, [error])

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center">
            <div className="max-w-md space-y-4 p-8 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900">
                <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Dashboard Error</h2>
                <p className="text-muted-foreground text-sm">
                    We encountered an issue loading this part of your dashboard.
                </p>
                {error.digest && (
                    <div className="text-[10px] font-mono text-muted-foreground/50 break-all">
                        Digest: {error.digest}
                    </div>
                )}
                <div className="text-xs text-red-500/70 font-mono text-left bg-black/5 p-2 rounded max-h-32 overflow-auto">
                    {error.message}
                </div>
                <Button onClick={() => reset()} className="w-full">Try Again</Button>
            </div>
        </div>
    )
}
