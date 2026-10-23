import { getTermsTemplatesAction } from "./actions"
import { QuotationTermsManager } from "@/components/settings/QuotationTermsManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function QuotationTermsPage() {
    const templates = await getTermsTemplatesAction()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/settings">
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quotation Terms</h1>
                    <p className="text-muted-foreground text-sm">
                        Settings &gt; Quotation Terms — Manage clauses and terms templates per business.
                    </p>
                </div>
            </div>

            <QuotationTermsManager initialTemplates={templates as any} />
        </div>
    )
}
