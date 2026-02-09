export default function GlobalDashboardLoading() {
    return (
        <div className="flex animate-pulse flex-col gap-4 p-4 md:p-6">
            <div className="h-8 w-48 rounded bg-muted/20" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted/20" />
                ))}
            </div>
            <div className="h-64 flex-1 rounded-xl bg-muted/20" />
        </div>
    );
}
