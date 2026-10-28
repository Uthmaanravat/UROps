const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/QuoteForm.tsx', 'utf8');

// 1. Add catalogueItems to QuoteFormProps
code = code.replace(
    'hasVatRegistration?: boolean;\n}',
    'hasVatRegistration?: boolean;\n    catalogueItems?: any[];\n}'
);

// 2. Add catalogueItems to props destructured
code = code.replace(
    'hasVatRegistration = false\n}: QuoteFormProps) {',
    'hasVatRegistration = false,\n    catalogueItems = []\n}: QuoteFormProps) {'
);

// 3. Make layout full width when isAeroWashWorkspace
code = code.replace(
    '<div className="flex flex-col lg:flex-row gap-6 items-start">\n            <div className="flex-1 w-full space-y-6">',
    '<div className={cn("w-full items-start", !isAeroWashWorkspace && "flex flex-col lg:flex-row gap-6")}>\n            <div className={cn("w-full space-y-6", !isAeroWashWorkspace && "flex-1")}>'
);

// 4. Pass catalogueItems to AeroWashQuoteBuilder
code = code.replace(
    'termsTemplates={termsTemplates}\n                                onChange={setAeroWashPayload}',
    'termsTemplates={termsTemplates}\n                                catalogueItems={catalogueItems}\n                                onChange={setAeroWashPayload}'
);

// 5. Hide CatalogSidePanel for AeroWash
code = code.replace(
    '{/* Catalog Side Panel (Shared Component) */}\n            <CatalogSidePanel',
    '{/* Catalog Side Panel (LR Builders only) */}\n            {!isAeroWashWorkspace && (\n            <CatalogSidePanel'
);

code = code.replace(
    'clientName={selectedClient?.name}\n                rateYear={effectiveRateYear}\n            />',
    'clientName={selectedClient?.name}\n                rateYear={effectiveRateYear}\n            />\n            )}'
);

fs.writeFileSync('src/components/invoices/QuoteForm.tsx', code, 'utf8');
console.log('QuoteForm.tsx patched successfully!');
