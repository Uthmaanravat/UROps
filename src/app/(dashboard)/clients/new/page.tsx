import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewClientPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/clients">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">Add New Client</h1>
            </div>

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <form action={createClient} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Display Name *</Label>
                        <Input id="name" name="name" placeholder="e.g. LR Builders" required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Legal Company Name</Label>
                            <Input id="companyName" name="companyName" placeholder="e.g. LR Builders (Pty) Ltd" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="attentionTo">Attention To</Label>
                            <Input id="attentionTo" name="attentionTo" placeholder="e.g. Mr. Smith" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" name="email" type="email" placeholder="john@example.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" name="phone" type="tel" placeholder="+27 82 123 4567" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vatNumber">VAT Number</Label>
                            <Input id="vatNumber" name="vatNumber" placeholder="e.g. 4123456789" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="registrationNumber">Business Registration #</Label>
                            <Input id="registrationNumber" name="registrationNumber" placeholder="e.g. 2024/123456/07" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vendorNumber">Vendor Number (If applicable)</Label>
                        <Input id="vendorNumber" name="vendorNumber" placeholder="e.g. V-12345" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Physical Address</Label>
                        <Input id="address" name="address" placeholder="123 Maintenance Street" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Additional Information / Notes</Label>
                        <textarea
                            id="notes"
                            name="notes"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="e.g. Primary contact: Sarah, preferred site access times etc."
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Link href="/clients">
                            <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                        <Button type="submit">Create Client</Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
