const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/InvoiceViewer.tsx', 'utf8');

// 1. Add generateAeroWashQuotePdf import if missing
if (!code.includes('generateAeroWashQuotePdf')) {
  code = code.replace(
    'import { formatCurrency, LINE_ITEM_REASONS, compareItemCodes, isReasonAlreadyInDescription, cn } from "@/lib/utils"',
    'import { formatCurrency, LINE_ITEM_REASONS, compareItemCodes, isReasonAlreadyInDescription, cn } from "@/lib/utils"\nimport { generateAeroWashQuotePdf } from "@/lib/aerowash-quote-pdf"'
  );
}

// 2. Add hasUserEditedRef and justSavedRef
if (!code.includes('hasUserEditedRef = useRef')) {
  code = code.replace(
    'const initialLoaded = useRef(false);',
    'const initialLoaded = useRef(false);\n    const hasUserEditedRef = useRef(false);\n    const justSavedRef = useRef(false);'
  );
}

// 3. Set hasUserEditedRef.current = true in updateItems
code = code.replace(
  'const updateItems = useCallback((newItems: any[]) => {\n        itemsRef.current = newItems;\n        setItems(newItems);\n    }, []);',
  'const updateItems = useCallback((newItems: any[]) => {\n        hasUserEditedRef.current = true;\n        itemsRef.current = newItems;\n        setItems(newItems);\n    }, []);'
);

// 4. Update mount effect to auto-clear draft if no diff
const oldMountCheck = `            if (hasItemDiff || hasSiteDiff || hasRefDiff || hasQuoteNumDiff || hasNoteDiff || hasDateDiff) {
                setPendingDraft(saved);
            }
        }`;

const newMountCheck = `            if (hasItemDiff || hasSiteDiff || hasRefDiff || hasQuoteNumDiff || hasNoteDiff || hasDateDiff) {
                setPendingDraft(saved);
            } else {
                clearDraft(DRAFT_KEY);
            }
        }`;

code = code.replace(oldMountCheck, newMountCheck);

// 5. Update auto-save effect condition: require hasUserEditedRef.current && !justSavedRef.current
const oldAutoSaveCheck = `if (!initialLoaded.current || isRestoring.current || loading || pendingDraft || isDiscardedRef.current) return;`;

const newAutoSaveCheck = `if (!initialLoaded.current || isRestoring.current || loading || pendingDraft || isDiscardedRef.current || !hasUserEditedRef.current || justSavedRef.current) return;`;

code = code.replace(oldAutoSaveCheck, newAutoSaveCheck);

// 6. In saveChanges: set justSavedRef.current = true and hasUserEditedRef.current = false
const oldSaveCommit = `            // Clear draft upon successful server commit
            clearDraft(DRAFT_KEY);
            setPendingDraft(null);
            setLastSavedTimestamp(null);
            setSaveError(null);`;

const newSaveCommit = `            // Clear draft upon successful server commit
            clearDraft(DRAFT_KEY);
            setPendingDraft(null);
            setLastSavedTimestamp(null);
            setSaveError(null);
            hasUserEditedRef.current = false;
            justSavedRef.current = true;
            setTimeout(() => { justSavedRef.current = false; }, 3000);`;

code = code.replace(oldSaveCommit, newSaveCommit);

// 7. Update handleDiscardDraft
code = code.replace(
  'const handleDiscardDraft = () => {\n        isDiscardedRef.current = true;',
  'const handleDiscardDraft = () => {\n        isDiscardedRef.current = true;\n        hasUserEditedRef.current = false;'
);

// 8. In generatePDF, route AeroWash documents to generateAeroWashQuotePdf
const oldGeneratePdfStart = `        const isAeroWashQuote = (companySettings?.theme === 'dark-orange' || companySettings?.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9') && invoice.type === 'QUOTE';`;

const newGeneratePdfStart = `        const isAeroWashDocument = (companySettings?.theme === 'dark-orange' || companySettings?.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' || companySettings?.name?.toLowerCase().includes('aerowash'));

        if (isAeroWashDocument) {
            const aeroDoc = await generateAeroWashQuotePdf({
                invoice: {
                    ...invoice,
                    number: invoice.number,
                    quoteNumber,
                    date,
                    type: invoice.type,
                    site,
                    reference,
                    notes: note,
                    subtotal,
                    taxAmount,
                    total,
                    items: items.map(i => ({
                        ...i,
                        total: i.total !== undefined ? i.total : ((i.quantity || 1) * (i.unitPrice || 0))
                    })),
                    client: {
                        name: invoice.client?.name || "",
                        companyName: invoice.client?.companyName || invoice.client?.name || "",
                        address: invoice.client?.address || "",
                        attentionTo: attentionTo || invoice.client?.attentionTo,
                        email: invoice.client?.email,
                        phone: invoice.client?.phone,
                        vatNumber: invoice.client?.vatNumber
                    },
                    metadata: invoice.metadata,
                    terms: (invoice as any).terms?.map((t: any) => ({ bodySnapshot: t.bodySnapshot || t.template?.body || "" }))
                },
                company: {
                    name: company.name,
                    address: company.address,
                    phone: company.phone,
                    email: company.email,
                    website: company.website,
                    logoUrl: company.logoUrl,
                    vatNumber: company.taxId,
                    registrationNumber: company.registrationNumber,
                    vatRegistrationDate: companySettings?.vatRegistrationDate,
                    vatRate: companySettings?.vatRate,
                    bankDetails: company.bankDetails
                },
                companySettings: {
                    theme: companySettings?.theme,
                    currency: currencySymbol,
                    taxId: companySettings?.taxId
                }
            });
            const filename = \`\${numberLabel}.pdf\`;
            aeroDoc.save(filename);
            return;
        }

        const isAeroWashQuote = false;`;

code = code.replace(oldGeneratePdfStart, newGeneratePdfStart);

// 9. Update LineItemEditor invocation to pass justificationEnabled
code = code.replace(
  'isInvoice={invoice.type === \'INVOICE\'}\n                                />',
  'isInvoice={invoice.type === \'INVOICE\'}\n                                    justificationEnabled={companySettings?.justificationEnabled !== false}\n                                />'
);

fs.writeFileSync('src/components/invoices/InvoiceViewer.tsx', code, 'utf8');
console.log('Successfully patched InvoiceViewer.tsx');
