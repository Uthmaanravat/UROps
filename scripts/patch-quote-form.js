const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/QuoteForm.tsx', 'utf8');

// 1. Add getWorkspaceCatalogAction import
code = code.replace(
  'createInvoiceAction, getQuoteSequenceAction, getInvoiceSequenceAction',
  'createInvoiceAction, getQuoteSequenceAction, getInvoiceSequenceAction, getWorkspaceCatalogAction'
);

// 2. Update loadCatalog to use getWorkspaceCatalogAction and activeCatalog for AeroWash
const oldCatalog = `    // Full catalog from database
    const [rawCatalog, setRawCatalog] = useState<any[]>([])

    // Load full catalog once
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const data = await getFixedPriceItemsAction()
                setRawCatalog(data)
            } catch (err) {
                console.error("Failed to load catalog", err)
            }
        }
        loadCatalog()
    }, [])

    // Filter catalog strictly based on workType
    // Tender: ONLY that tender's items
    // General: ONLY general items (no tenderId), global + this client's general items
    const activeCatalog = useMemo(() => {
        if (workType === "TENDER") {
            return rawCatalog.filter((item: any) => item.tenderId === selectedTenderId)
        }
        return rawCatalog.filter((item: any) => !item.tenderId && (!item.clientId || item.clientId === clientId))
    }, [rawCatalog, workType, selectedTenderId, clientId])`;

const newCatalog = `    // Full catalog from database
    const [rawCatalog, setRawCatalog] = useState<any[]>([])

    // Load full catalog once
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const data = await getWorkspaceCatalogAction()
                setRawCatalog(data)
            } catch (err) {
                console.error("Failed to load catalog", err)
            }
        }
        loadCatalog()
    }, [])

    // Filter catalog strictly based on workspace and workType
    const activeCatalog = useMemo(() => {
        if (isAeroWashWorkspace) {
            return rawCatalog
        }
        if (workType === "TENDER") {
            return rawCatalog.filter((item: any) => item.tenderId === selectedTenderId)
        }
        return rawCatalog.filter((item: any) => !item.tenderId && (!item.clientId || item.clientId === clientId))
    }, [rawCatalog, workType, selectedTenderId, clientId, isAeroWashWorkspace])`;

// 3. Update LineItemEditor invocation to pass justificationEnabled
const oldLineItemEditor = `<LineItemEditor
                                items={items}
                                onChange={setItems}
                                catalog={activeCatalog}
                                workType={workType}
                                rateYear={effectiveRateYear}
                                isAdmin={isAdmin}
                                highlightIndex={highlightIndex}
                            />`;

const newLineItemEditor = `<LineItemEditor
                                items={items}
                                onChange={setItems}
                                catalog={activeCatalog}
                                workType={workType}
                                rateYear={effectiveRateYear}
                                isAdmin={isAdmin}
                                highlightIndex={highlightIndex}
                                justificationEnabled={companySettings?.justificationEnabled !== false && !isAeroWashWorkspace}
                            />`;

const hasCRLF = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');
const normOldCat = oldCatalog.replace(/\r\n/g, '\n');
const normNewCat = newCatalog.replace(/\r\n/g, '\n');
const normOldEditor = oldLineItemEditor.replace(/\r\n/g, '\n');
const normNewEditor = newLineItemEditor.replace(/\r\n/g, '\n');

if (norm.includes(normOldCat)) {
  norm = norm.replace(normOldCat, normNewCat);
}
if (norm.includes(normOldEditor)) {
  norm = norm.replace(normOldEditor, normNewEditor);
}

fs.writeFileSync('src/components/invoices/QuoteForm.tsx', hasCRLF ? norm.replace(/\n/g, '\r\n') : norm, 'utf8');
console.log('Successfully patched QuoteForm.tsx');
