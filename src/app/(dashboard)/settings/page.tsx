import { getCompanySettings } from "./actions"
import { SettingsForm } from "@/components/settings/SettingsForm"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const settings = await getCompanySettings()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your company branding and details.
                </p>
            </div>

            <SettingsForm initialSettings={settings} />
        </div>
    )
}
