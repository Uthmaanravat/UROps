"use client"

import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Download, FileCheck, CreditCard, ArrowLeft, Trash2, Mail, FileText } from "lucide-react"
import Link from "next/link"
import jsPDF from "jspdf"
import { drawPdfHeader } from "@/lib/pdf-utils"
import autoTable from "jspdf-autotable"
import { convertToInvoiceAction, recordPaymentAction, deleteInvoiceAction } from "@/app/(dashboard)/invoices/actions"
import { sendInvoiceEmail } from "@/app/(dashboard)/invoices/email-actions"
import { updateInvoiceItemsAction, finalizeQuoteAction, approveQuoteAction, updateInvoiceNoteAction } from "@/app/(dashboard)/invoices/pricing-actions"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function InvoiceViewer({ invoice, companySettings }: { invoice: any, companySettings?: any }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    // Use local state for items to allow instant UI updates for grouping/calculations
    const [items, setItems] = useState<any[]>(invoice.items);
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

    // Add new Item Handler
    const handleAddItem = () => {
        const newItem = {
            id: `new-${Date.now()}`,
            description: "New Item",
            quantity: 1,
            unitPrice: 0,
            unit: "ea",
            area: "GENERAL / UNGROUPED",
            total: 0
        };
        setItems([...items, newItem]);
    };
    const [recipientEmails, setRecipientEmails] = useState(invoice.client.email || "");

    const isPricingMode = (invoice.type === 'QUOTE' || invoice.type === 'INVOICE') && invoice.status === 'DRAFT';

    const handleItemUpdate = (id: string, field: string, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalculate line total if price/qty changes
                if (field === 'unitPrice' || field === 'quantity') {
                    updated.total = updated.quantity * updated.unitPrice;
                }
                return updated;
            }
            return item;
        }));
    };

    const [note, setNote] = useState(invoice.notes || "");

    const saveChanges = async () => {
        setLoading(true);
        // Map local items to the format expected by the server action
        const updates = items.map(item => ({
            id: item.id,
            description: item.description,
            area: item.area,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice
        }));

        const promises = [];
        if (updates.length > 0) {
            promises.push(updateInvoiceItemsAction(invoice.id, updates));
        }

        // Always save note if it's different
        if (note !== invoice.notes) {
            promises.push(updateInvoiceNoteAction(invoice.id, note));
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }

        setLoading(false);
        router.refresh();
    }

    const handleApprove = async () => {
        if (!confirm("Approve this Quote? This will lock it and generate a Draft Invoice.")) return;
        setLoading(true);
        await saveChanges();
        await approveQuoteAction(invoice.id);
        setLoading(false);
        router.refresh(); // Refresh to show new status
        // router.push(`/work-breakdown-pricing`); // Maybe stay on page or go to list?
        // Actually, flow says "Move project to Invoice stage".
        // The user might want to stay on the invoice page which is now an invoice.
    }

    // Default company details if not set
    const company = {
        name: companySettings?.name || "LR Builders & Maintenance Pty (Ltd)",
        address: companySettings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: companySettings?.email || "Loedvi@lrbuilders.co.za",
        phone: companySettings?.phone || "082 448 7490",
        logoUrl: companySettings?.logoUrl || "",
        vatNumber: companySettings?.taxId || "",
        paymentTerms: companySettings?.paymentTerms || "",
        bankDetails: companySettings?.bankDetails || "Name: LR Builders & Maintenance Pty (Ltd), Bank: FNB, Acc No.: 63114141714, Branch Code: 200510"
    };

    const handleSendEmail = async () => {
        if (!recipientEmails) {
            alert("Please provide at least one email address.");
            return;
        }

        const emails = recipientEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
        if (emails.length === 0) {
            alert("Invalid email format.");
            return;
        }

        setLoading(true);
        const res = await sendInvoiceEmail(invoice.id, emails);
        setLoading(false);
        if (res.success) {
            alert("Email sent successfully!");
            setIsEmailDialogOpen(false);
            router.refresh();
        } else {
            alert(res.error || "Failed to send email");
        }
    }

    const currencySymbol = companySettings?.currency || "R";

    const generatePDF = async () => {
        const doc = new jsPDF();
        const currencySymbol = companySettings?.currency || "R";

        // 1. Header Bar (Shared)
        const numberLabel = invoice.quoteNumber && (invoice.quoteNumber.startsWith('Q-') || invoice.quoteNumber.startsWith('INV-'))
            ? invoice.quoteNumber
            : (invoice.type === 'QUOTE' ? `Q-${invoice.quoteNumber || invoice.number}` : `INV-${invoice.number.toString().padStart(4, '0')}`);
        await drawPdfHeader(doc, company, invoice.type === 'QUOTE' ? 'QUOTATION' : 'TAX INVOICE', numberLabel);

        // 2. Metadata Section (Black text)
        doc.setTextColor(20, 20, 30); // Dark Navy for contrast
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        let metaY = 55;
        doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-GB')}`, 14, metaY);

        let detailY = metaY + 12;
        if (invoice.project?.name) {
            doc.setFont("helvetica", "bold");
            doc.text(`Project: ${invoice.project.name}`, 14, detailY);
            doc.setFont("helvetica", "normal");
            detailY += 5;
        }
        if (invoice.site) {
            doc.setFont("helvetica", "bold");
            doc.text(`Site: ${invoice.site}`, 14, detailY);
            doc.setFont("helvetica", "normal");
            detailY += 5;
        }
        if (invoice.reference) {
            doc.setFont("helvetica", "bold");
            doc.text(`Ref: ${invoice.reference}`, 14, detailY);
            doc.setFont("helvetica", "normal");
            detailY += 5;
        }
        metaY = detailY - 12; // Adjust for next sections

        // Bill To
        doc.setFontSize(10);
        doc.text(`Bill To:`, 14, metaY + 15);
        doc.setFont("helvetica", "bold");
        const billToName = invoice.client.companyName || invoice.client.name;
        doc.text(billToName, 14, metaY + 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const billToLines = doc.splitTextToSize(invoice.client.address || "", 80);
        doc.text(billToLines, 14, metaY + 25);

        // Client legal details
        let legalY = metaY + 27 + (billToLines.length * 4);
        doc.setFontSize(8);
        if (invoice.client.vatNumber) {
            doc.text(`VAT: ${invoice.client.vatNumber}`, 14, legalY);
            legalY += 4;
        }
        if (invoice.client.registrationNumber) {
            doc.text(`Reg: ${invoice.client.registrationNumber}`, 14, legalY);
        }

        // Company Contact on Right
        doc.text(company.phone, 196, metaY, { align: 'right' });
        doc.text(company.email, 196, metaY + 5, { align: 'right' });
        if (company.vatNumber) {
            doc.text(`VAT: ${company.vatNumber}`, 196, metaY + 10, { align: 'right' });
        }
        const compAddr = doc.splitTextToSize(company.address, 70);
        doc.text(compAddr, 196, company.vatNumber ? metaY + 17 : metaY + 12, { align: 'right' });

        // 3. Table with Area Grouping
        const tableBody: any[] = [];
        const grouped = invoice.items.reduce((acc: any, item: any) => {
            const area = item.area?.trim() || "GENERAL / UNGROUPED";
            if (!acc[area]) acc[area] = [];
            acc[area].push(item);
            return acc;
        }, {});

        Object.entries(grouped).forEach(([area, areaItems]: [string, any]) => {
            // Add Header Row for Area
            tableBody.push([{ content: `AREA: ${area}`, colSpan: 5, styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' } }]);

            // Add Items for this Area
            areaItems.forEach((item: any) => {
                const desc = item.notes ? `${item.description}\n(Notes: ${item.notes})` : item.description;
                tableBody.push([
                    desc,
                    item.quantity,
                    item.unit || '',
                    formatCurrency(item.unitPrice, currencySymbol),
                    formatCurrency(item.total, currencySymbol)
                ]);
            });
        });

        autoTable(doc, {
            head: [['Description', 'Qty', 'Unit', 'Price', 'Total']],
            body: tableBody,
            startY: metaY + 45,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [163, 230, 53], fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 100 } }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // 4. Summary
        doc.setFontSize(9);
        doc.text(`Subtotal:`, 140, finalY);
        doc.text(formatCurrency(invoice.subtotal, currencySymbol), 196, finalY, { align: 'right' });

        doc.text(`VAT (15%):`, 140, finalY + 5);
        doc.text(formatCurrency(invoice.taxAmount, currencySymbol), 196, finalY + 5, { align: 'right' });

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Total Due:`, 140, finalY + 12);
        doc.text(formatCurrency(invoice.total, currencySymbol), 196, finalY + 12, { align: 'right' });

        // 5. Notes & Banking
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        let currentY = finalY + 25;

        if (note) {
            doc.setFont("helvetica", "bold");
            doc.text("Notes:", 14, currentY);
            doc.setFont("helvetica", "normal");
            const noteLines = doc.splitTextToSize(note, 180);
            doc.text(noteLines, 14, currentY + 5);
            currentY += (noteLines.length * 5) + 10;
        }

        doc.setFont("helvetica", "bold");
        doc.text("Banking Details:", 14, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(company.bankDetails, 14, currentY + 5);

        doc.save(`${invoice.type}_${invoice.number}.pdf`);
    }

    const handleConvert = async () => {
        const poNumber = prompt("Please enter the Client PO Number (Optional):");
        if (poNumber === null) return;

        if (!confirm("Convert this Quote to an Invoice?")) return;
        setLoading(true);
        await convertToInvoiceAction(invoice.id, poNumber);
        setLoading(false);
        router.refresh();
    }

    const handlePayment = async () => {
        const amountStr = prompt("Enter payment amount:", (invoice.total - invoice.payments.reduce((acc: number, p: any) => acc + p.amount, 0)).toFixed(2));
        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) return;

        setLoading(true);
        await recordPaymentAction({ invoiceId: invoice.id, amount, method: "CASH", date: new Date().toISOString() });
        setLoading(false);
        router.refresh();
    }

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete this ${invoice.type.toLowerCase()}? This cannot be undone.`)) return;
        setLoading(true);
        try {
            await deleteInvoiceAction(invoice.id);
        } catch (error) {
            alert("Failed to delete. Please try again.");
            setLoading(false);
        }
    }

    const paidAmount = invoice.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
    const balance = invoice.total - paidAmount;
    const isPaid = balance <= 0.01;

    // Recalculate totals from local items
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const taxAmount = subtotal * 0.15;
    const total = subtotal + taxAmount;

    return (
        <div className="max-w-5xl mx-auto space-y-6 px-4 md:px-0 pb-20">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4 print:hidden">
                <Link href="/work-breakdown-pricing">
                    <Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Back to List</Button>
                </Link>
                <div className="flex gap-2 flex-wrap justify-center">
                    <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={loading}>
                                <Mail className="mr-2 h-4 w-4" /> Email
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Send via Email</DialogTitle>
                                <DialogDescription>
                                    Send this {invoice.type.toLowerCase()} directly to the client. You can enter multiple emails separated by commas.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="emails">Recipient Emails</Label>
                                    <Input
                                        id="emails"
                                        placeholder="e.g. client@example.com, accounting@example.com"
                                        value={recipientEmails}
                                        onChange={(e) => setRecipientEmails(e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">Separate multiple addresses with commas.</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSendEmail} disabled={loading || !recipientEmails}>
                                    {loading ? "Sending..." : "Send Now"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" onClick={generatePDF}>
                        <Download className="mr-2 h-4 w-4" /> Download PDF
                    </Button>
                    {invoice.type === 'QUOTE' && invoice.status !== 'INVOICED' && (
                        <Button onClick={handleConvert} disabled={loading}>
                            <FileCheck className="mr-2 h-4 w-4" /> Convert to Invoice
                        </Button>
                    )}
                    {invoice.type === 'INVOICE' && !isPaid && (
                        <Button onClick={handlePayment} disabled={loading}>
                            <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                        </Button>
                    )}
                    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                </div>
            </div>

            {/* Preview Area - Overhauled to Premium Dark Theme */}
            <div className="bg-[#0F172A] text-white p-8 shadow-2xl min-h-[1000px] font-sans relative border-0 rounded-2xl overflow-hidden ring-1 ring-white/10">
                {isPaid && invoice.type === 'INVOICE' && (
                    <div className="absolute top-48 right-48 border-[12px] border-primary/20 text-primary/20 font-black text-9xl p-8 rotate-[-20deg] uppercase pointer-events-none select-none tracking-tighter">
                        PAID
                    </div>
                )}

                {/* Modern Navy Header */}
                <div className="bg-[#1E293B] -mx-8 -mt-8 p-12 mb-12 flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-8">
                        {company.logoUrl ? (
                            <img src={company.logoUrl} alt="Logo" className="h-24 w-auto object-contain brightness-110" />
                        ) : (
                            <div className="h-20 w-20 bg-primary flex items-center justify-center font-black text-[#0F172A] text-3xl rounded-xl shadow-2xl rotate-3">LR</div>
                        )}
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-white">{company.name}</h1>
                            <div className="flex gap-4 mt-2">
                                <p className="text-gray-400 text-sm font-medium">{company.phone}</p>
                                <span className="text-gray-600">•</span>
                                <p className="text-gray-400 text-sm font-medium">{company.email}</p>
                                {company.vatNumber && (
                                    <>
                                        <span className="text-gray-600">•</span>
                                        <p className="text-gray-400 text-sm font-medium uppercase tracking-tighter">VAT: {company.vatNumber}</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-black uppercase tracking-[0.2em] text-primary">{invoice.type === 'QUOTE' ? 'QUOTATION' : 'TAX INVOICE'}</h2>
                        <p className="text-gray-500 font-mono mt-2 text-lg">
                            {invoice.quoteNumber && (invoice.quoteNumber.startsWith('Q-') || invoice.quoteNumber.startsWith('INV-'))
                                ? invoice.quoteNumber
                                : (invoice.type === 'QUOTE' ? `Q-${invoice.quoteNumber || invoice.number}` : `INV-${invoice.number.toString().padStart(4, '0')}`)}
                        </p>
                    </div>
                </div>

                {/* Metadata & Billing */}
                <div className="grid grid-cols-2 gap-16 mb-16">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Bill To</h3>
                            <div className="text-2xl font-black text-white">{invoice.client.companyName || invoice.client.name}</div>
                            {invoice.client.attentionTo && <div className="text-base font-bold text-gray-400 mt-1 italic">Attn: {invoice.client.attentionTo}</div>}
                        </div>
                        <div className="text-gray-400 leading-relaxed font-medium bg-white/5 p-4 rounded-xl border border-white/5 whitespace-pre-wrap">{invoice.client.address}</div>

                        <div className="flex gap-6">
                            {invoice.client.vatNumber && (
                                <div className="bg-white/5 px-3 py-1 rounded-md border border-white/5">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-2">VAT</span>
                                    <span className="text-xs font-bold text-gray-300">{invoice.client.vatNumber}</span>
                                </div>
                            )}
                            {invoice.client.registrationNumber && (
                                <div className="bg-white/5 px-3 py-1 rounded-md border border-white/5">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-2">REG</span>
                                    <span className="text-xs font-bold text-gray-300">{invoice.client.registrationNumber}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col justify-end items-end space-y-4">
                        <div className="bg-[#1E293B] p-6 rounded-2xl w-full max-w-sm border border-white/5 space-y-3">
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Date Issued</span>
                                <span className="font-bold text-white">{new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                            </div>
                            {invoice.project?.name && (
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                    <span className="text-primary font-bold uppercase tracking-widest text-[10px]">Project</span>
                                    <span className="font-bold text-white">{invoice.project.name}</span>
                                </div>
                            )}
                            {invoice.site && (
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                    <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Site Location</span>
                                    <span className="font-bold text-white italic">{invoice.site}</span>
                                </div>
                            )}
                            {invoice.reference && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Reference</span>
                                    <span className="font-bold text-white">{invoice.reference}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Table - Modern High-Contrast Style */}
                <div className="mb-16 min-h-[400px]">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="py-6 text-left font-black text-[11px] uppercase tracking-[0.2em] text-gray-500">Service Description</th>
                                <th className="py-6 text-center w-24 font-black text-[11px] uppercase tracking-[0.2em] text-gray-500">Qty</th>
                                <th className="py-6 text-right w-36 font-black text-[11px] uppercase tracking-[0.2em] text-gray-500">Unit Price</th>
                                <th className="py-6 text-right w-40 font-black text-[11px] uppercase tracking-[0.2em] text-gray-500">Line Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {(() => {
                                const grouped = items.reduce((acc: any, item: any) => {
                                    const area = item.area?.trim() || "GENERAL / UNGROUPED"
                                    if (!acc[area]) acc[area] = []
                                    acc[area].push(item)
                                    return acc
                                }, {})

                                return Object.entries(grouped).map(([area, areaItems]: [string, any]) => (
                                    <>
                                        <tr key={`header-${area}`} className="bg-white/5 border-y border-white/5">
                                            <td colSpan={4} className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                                    {isPricingMode ? (
                                                        <Input
                                                            value={area === "GENERAL / UNGROUPED" ? "" : area}
                                                            onChange={(e) => {
                                                                // Update ALL items in this group
                                                                const newArea = e.target.value;
                                                                setItems(prev => prev.map(i => {
                                                                    const iArea = i.area?.trim() || "GENERAL / UNGROUPED";
                                                                    if (iArea === area) {
                                                                        return { ...i, area: newArea };
                                                                    }
                                                                    return i;
                                                                }));
                                                            }}
                                                            className="h-6 w-64 bg-transparent border-none text-[10px] font-black uppercase tracking-[0.2em] text-primary italic focus:ring-0 px-0"
                                                            placeholder="ENTER AREA NAME"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary italic">Area: {area}</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {areaItems.map((item: any) => (
                                            <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="py-8 pr-12">
                                                    {isPricingMode ? (
                                                        <div className="flex gap-4">
                                                            <div className="flex-1">
                                                                <Textarea
                                                                    value={item.description}
                                                                    onChange={(e) => handleItemUpdate(item.id, 'description', e.target.value)}
                                                                    className="min-h-[60px] bg-transparent border-white/10 focus:border-primary text-lg font-bold text-white tracking-tight resize-none p-2"
                                                                    placeholder="Item Description"
                                                                />
                                                            </div>
                                                            <div className="w-1/3 max-w-[150px]">
                                                                <Input
                                                                    value={item.area || ""}
                                                                    onChange={(e) => handleItemUpdate(item.id, 'area', e.target.value)}
                                                                    className="h-full bg-transparent border-white/10 focus:border-primary text-xs font-bold text-primary uppercase tracking-widest"
                                                                    placeholder="AREA"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-lg font-bold text-white tracking-tight">{item.description}</div>
                                                    )}
                                                </td>
                                                <td className="py-8 text-center align-top">
                                                    {isPricingMode ? (
                                                        <div className="flex flex-col gap-2 items-center">
                                                            <Input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleItemUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                                className="w-16 h-8 text-center bg-transparent border-white/10 font-bold"
                                                            />
                                                            <Input
                                                                value={item.unit || ""}
                                                                onChange={(e) => handleItemUpdate(item.id, 'unit', e.target.value)}
                                                                placeholder="Unit"
                                                                className="w-16 h-6 text-center text-[10px] uppercase bg-transparent border-none opacity-50"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-base font-black text-gray-400">{item.quantity} <span className="text-[10px] uppercase ml-1 opacity-50">{item.unit || "ea"}</span></span>
                                                    )}
                                                </td>
                                                <td className="py-8 text-right align-top">
                                                    {isPricingMode ? (
                                                        <div className="inline-flex items-center gap-1 bg-white/5 p-2 rounded-lg border border-white/10">
                                                            <span className="text-gray-500 font-bold text-sm">{currencySymbol}</span>
                                                            <input
                                                                type="number"
                                                                className="w-24 bg-transparent text-right text-white font-bold outline-none no-spinner"
                                                                value={item.unitPrice}
                                                                onChange={(e) => handleItemUpdate(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-base font-bold text-white">{formatCurrency(item.unitPrice, currencySymbol)}</span>
                                                    )}
                                                </td>
                                                <td className="py-8 text-right font-black text-lg text-white align-top">
                                                    {formatCurrency(item.quantity * item.unitPrice, currencySymbol)}
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                ))
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Footer UI - Modernized with conditional payment terms Logic */}
                <div className="grid grid-cols-2 gap-20 mt-16 pt-16 border-t border-white/10">
                    <div className="space-y-10">
                        <div className="bg-white/5 p-8 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6 flex items-center gap-3">
                                <FileText className="h-4 w-4" /> Professional Notes
                            </h4>
                            {isPricingMode ? (
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add specialized terms, site conditions, or project requirements..."
                                    className="w-full min-h-[160px] bg-transparent text-gray-300 text-base border-none focus:ring-0 resize-none font-medium leading-relaxed placeholder:opacity-20"
                                />
                            ) : (
                                <div className="text-base font-bold text-gray-300 leading-relaxed whitespace-pre-wrap italic">
                                    {note || "No specific project notes applied to this document."}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Settlement Details</h4>
                            <div className="text-sm font-bold leading-loose font-mono text-gray-400 bg-white/5 p-6 rounded-2xl border border-white/5">
                                {company.bankDetails}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4 bg-white/[0.02] p-8 rounded-3xl border border-white/5">
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-gray-500 font-bold">Document Subtotal</span>
                                <span className="font-bold text-white">{formatCurrency(subtotal, currencySymbol)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-gray-500 font-bold">VAT (15%)</span>
                                <span className="font-bold text-white">{formatCurrency(taxAmount, currencySymbol)}</span>
                            </div>
                            <div className="h-px bg-white/10 my-4" />
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-black uppercase tracking-[0.2em] text-primary">Balance Due</span>
                                <span className="text-5xl font-black text-white tracking-tighter">{formatCurrency(total, currencySymbol)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isPricingMode && (
                    <div className="mt-12 flex justify-between gap-3 print:hidden">
                        <Button variant="secondary" onClick={handleAddItem} disabled={loading} className="h-14 px-8 border-2 border-dashed border-white/20">
                            + Add Line Item
                        </Button>
                        <div className="flex gap-3">
                            <Button size="lg" variant="outline" onClick={saveChanges} disabled={loading} className="h-14 px-8 border-2">
                                {loading ? "Saving..." : "Save Draft Changes"}
                            </Button>
                            <Button size="lg" onClick={handleApprove} disabled={loading} className="h-14 px-10 bg-blue-600 hover:bg-blue-700 font-bold shadow-xl">
                                {loading ? "Processing..." : "Approve & Generate Invoice"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
