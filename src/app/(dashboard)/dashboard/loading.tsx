export default function DashboardLoading() {
    return (
        <div className="space-y-6">
            <div className="h-9 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
            </div>

            <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse border-l-4 border-yellow-500" />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 space-y-4">
                    <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="h-48 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="col-span-3 space-y-4">
                    <div className="h-96 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
            </div>
        </div>
    )
}
