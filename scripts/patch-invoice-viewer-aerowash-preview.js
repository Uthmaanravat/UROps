const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/InvoiceViewer.tsx', 'utf8');

// 1. Add AeroWashDocumentPreview import
if (!code.includes('AeroWashDocumentPreview')) {
  code = code.replace(
    'import { generateAeroWashQuotePdf } from "@/lib/aerowash-quote-pdf"',
    'import { generateAeroWashQuotePdf } from "@/lib/aerowash-quote-pdf"\nimport { AeroWashDocumentPreview } from "@/components/invoices/AeroWashDocumentPreview"'
  );
}

// 2. Define isAeroWashDocument near other flags (around line 520)
if (!code.includes('const isAeroWashDocument =')) {
  code = code.replace(
    'const DRAFT_KEY = `urops_draft_invoice_${invoice.id}`;',
    'const isAeroWashDocument = (companySettings?.theme === "dark-orange" || companySettings?.companyId === "70af7281-072d-4ed5-9f2e-af4d93e99ea9" || companySettings?.name?.toLowerCase().includes("aerowash"));\n    const DRAFT_KEY = `urops_draft_invoice_${invoice.id}`;'
  );
}

// 3. Render AeroWashDocumentPreview when !isEditingInvoiceItems && isAeroWashDocument
const targetElse = `                ) : (
                    <div className="mb-10 min-h-[400px] overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">`;

const replacementElse = `                ) : isAeroWashDocument ? (
                    <AeroWashDocumentPreview
                        invoice={invoice}
                        company={company}
                        companySettings={companySettings}
                        items={items}
                        subtotal={subtotal}
                        total={total}
                        taxAmount={taxAmount}
                        isVatRegistered={isVatRegistered}
                        vatRate={vatRate}
                        currencySymbol={currencySymbol}
                        quoteNumber={quoteNumber}
                        date={date}
                        site={site}
                        reference={reference}
                        notes={note}
                        attentionTo={attentionTo}
                        isLocked={isLocked}
                        onEditItems={() => setIsEditingInvoiceItems(true)}
                    />
                ) : (
                    <div className="mb-10 min-h-[400px] overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">`;

const hasCRLF = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');
const normTarget = targetElse.replace(/\r\n/g, '\n');
const normReplace = replacementElse.replace(/\r\n/g, '\n');

if (norm.includes(normTarget)) {
  norm = norm.replace(normTarget, normReplace);
  fs.writeFileSync('src/components/invoices/InvoiceViewer.tsx', hasCRLF ? norm.replace(/\n/g, '\r\n') : norm, 'utf8');
  console.log('Successfully patched InvoiceViewer with AeroWashDocumentPreview');
} else {
  console.error('Target not found in InvoiceViewer.tsx');
}
