// Reports page error component
// Reports page error component (Client component)
"use client";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== 'production';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md space-y-4 p-8 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Reports Error</h1>
        <p className="text-muted-foreground text-sm">
          An error occurred while loading the reports page.
        </p>
        {isDev && (
          <p className="text-sm text-red-800 dark:text-red-300 break-all mt-2">
            {error.message}
          </p>
        )}
        {error.digest && (
          <div className="text-[10px] font-mono text-muted-foreground/50 break-all">
            Digest: {error.digest}
          </div>
        )}
        <div className="flex gap-2 justify-center mt-4">
          <a href="/dashboard/reports" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100">
            Try Again
          </a>
        </div>
      </div>
    </div>
  );
}
