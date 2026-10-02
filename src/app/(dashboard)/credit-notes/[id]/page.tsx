import { notFound } from "next/navigation"
import { getCreditNoteByIdAction } from "@/app/actions/credit-notes"
import { getCompanySettings } from "@/app/(dashboard)/settings/actions"
import { CreditNoteViewer } from "@/components/credit-notes/CreditNoteViewer"

export const dynamic = 'force-dynamic'

export default async function CreditNoteDetailPage({ params }: { params: { id: string } }) {
    const [creditNote, companySettings] = await Promise.all([
        getCreditNoteByIdAction(params.id),
        getCompanySettings()
    ])

    if (!creditNote) {
        notFound()
    }

    return (
        <CreditNoteViewer
            creditNote={creditNote}
            companySettings={companySettings}
        />
    )
}
