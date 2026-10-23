import { getCompanySettings } from "./actions"
import { SettingsForm } from "@/components/settings/SettingsForm"
import Link from "next/link"
import { Building2, ShieldCheck } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const settings = await getCompanySettings()

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage your company branding, financial details, and quotation terms.
                    </p>
                </div>

                <div className="flex items-center gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
                    <Link
                        href="/settings"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-black flex items-center gap-1.5 shadow-sm"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        Company & Branding
                    </Link>
                    <Link
                        href="/settings/terms"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                        <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
                        Quotation Terms
                    </Link>
                </div>
            </div>

            <SettingsForm initialSettings={settings} />
        </div>
    )
}
