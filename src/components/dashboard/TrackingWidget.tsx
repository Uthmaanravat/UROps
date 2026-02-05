"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, FileCheck, DollarSign, ClipboardList } from "lucide-react"
import Link from "next/link"

interface TrackingCounts {
    sow: number
    quotation: number
    invoice: number
    payment: number
}

export function TrackingWidget({ counts }: { counts: TrackingCounts }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/work-breakdown-pricing">
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">SOW</CardTitle>
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.sow}</div>
                        <p className="text-xs text-muted-foreground">Scopes Submitted</p>
                    </CardContent>
                </Card>
            </Link>

            <Link href="/invoices?type=QUOTE&status=SENT">
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quotations</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.quotation}</div>
                        <p className="text-xs text-muted-foreground">Quotes Sent</p>
                    </CardContent>
                </Card>
            </Link>

            <Link href="/invoices?type=INVOICE">
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Invoices</CardTitle>
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.invoice}</div>
                        <p className="text-xs text-muted-foreground">Invoices Issued</p>
                    </CardContent>
                </Card>
            </Link>

            <Link href="/payments">
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Payments</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.payment}</div>
                        <p className="text-xs text-muted-foreground">Completed / Paid</p>
                    </CardContent>
                </Card>
            </Link>
        </div>
    )
}
