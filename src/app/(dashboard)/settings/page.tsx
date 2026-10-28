import { getCompanySettings } from "./actions"
import { SettingsForm } from "@/components/settings/SettingsForm"
import Link from "next/link"
import { Building2, ShieldCheck, Users, Layers } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const settings = await getCompanySettings()
    const isAeroWash = settings?.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' || settings?.theme === 'dark-orange'

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage your company branding, financial details, quotation terms, and team members.
                    </p>
                </div>

                <div className="flex items-center gap-2 p-1 rounded-xl bg-black/40 border border-white/10 flex-wrap">
                    <Link
                        href="/settings"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-black flex items-center gap-1.5 shadow-sm"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        Company &amp; Branding
                    </Link>
                    <Link
                        href="/settings/terms"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Quotation Terms
                    </Link>
                    {isAeroWash && (
                        <Link
                            href="/settings/catalogue"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                        >
                            <Layers className="h-3.5 w-3.5" />
                            AeroWash Catalogue
                        </Link>
                    )}
                    <Link
                        href="/settings/team"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                        <Users className="h-3.5 w-3.5" />
                        Team
                    </Link>
                </div>
            </div>

            <SettingsForm initialSettings={settings} />
        </div>
    )
}
