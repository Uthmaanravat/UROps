const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/AeroWashQuoteBuilder.tsx', 'utf8');

// 1. Add hasHandClean to ElevationState
code = code.replace(
    'allowSoilingOverride: boolean;\n    exclusions?: string;',
    'allowSoilingOverride: boolean;\n    hasHandClean?: boolean;\n    handCleanPrice?: number;\n    exclusions?: string;'
);

// 2. Add hasHandClean to initial elevations state
code = code.replace(
    'extendedSoilingPrice: 0,\n                allowSoilingOverride: false\n            }',
    'extendedSoilingPrice: 0,\n                allowSoilingOverride: false,\n                hasHandClean: false,\n                handCleanPrice: 0\n            }'
);

// 3. Add catalogueItems to AeroWashQuoteBuilderProps
code = code.replace(
    'termsTemplates?: any[];\n    initialData?: any;',
    'termsTemplates?: any[];\n    catalogueItems?: any[];\n    initialData?: any;'
);

// 4. Destructure catalogueItems in AeroWashQuoteBuilder
code = code.replace(
    'termsTemplates = [],\n    initialData,\n    onChange\n}: AeroWashQuoteBuilderProps) {',
    'termsTemplates = [],\n    catalogueItems = [],\n    initialData,\n    onChange\n}: AeroWashQuoteBuilderProps) {'
);

// 5. Add catalogueMap, getItem, isItemActive right inside AeroWashQuoteBuilder
const helperCode = `    // Live Catalogue Mapping & Active State
    const catalogueMap = useMemo(() => {
        const map = new Map<number, any>();
        AEROWASH_CATALOGUE_ITEMS.forEach(item => {
            map.set(item.itemNumber, {
                ...item,
                isActive: true,
                metadata: null
            });
        });
        (catalogueItems || []).forEach(item => {
            map.set(item.itemNumber, item);
        });
        return map;
    }, [catalogueItems]);

    const getItem = (itemNumber: number) => {
        return catalogueMap.get(itemNumber);
    };

    const isItemActive = (itemNumber: number) => {
        const item = catalogueMap.get(itemNumber);
        return item ? item.isActive !== false : true;
    };
`;

code = code.replace(
    '    // 1. Elevations State\n    const [elevations, setElevations]',
    helperCode + '\n    // 1. Elevations State\n    const [elevations, setElevations]'
);

fs.writeFileSync('src/components/invoices/AeroWashQuoteBuilder.tsx', code, 'utf8');
console.log('Step 1 of AeroWashQuoteBuilder patched successfully!');
