const fs = require('fs');
let file = fs.readFileSync('src/lib/aerowash-catalogue.ts', 'utf8');
const target = `    {
        itemNumber: 20,
        name: 'Extended Travel',
        clientDescription:
            'Travel provision for sites beyond the standard service area (see Terms).',
        category: 'SITE CONDITIONS',
        pricingMethod: 'PRICE_ON_QUOTE'
    }
];`;

const replacement = `    {
        itemNumber: 20,
        name: 'Extended Travel',
        clientDescription:
            'Travel provision for sites beyond the standard service area (see Terms).',
        category: 'SITE CONDITIONS',
        pricingMethod: 'PRICE_ON_QUOTE'
    },
    {
        itemNumber: 21,
        name: 'Scheduled Maintenance Programme – [Biannual / Quarterly / Monthly]',
        clientDescription:
            'Scheduled maintenance visits on fixed, pre-agreed dates.',
        category: 'CONTRACTS',
        pricingMethod: 'CONTRACT_PROGRAMME_DISCOUNT',
        internalNotes: 'Discount: Biannual −10%, Quarterly −15%, Monthly −20%. Client sees price per visit + visits per year, no percentages.'
    },
    {
        itemNumber: 22,
        name: 'Monthly Glazing + Quarterly Full Facade Programme',
        clientDescription:
            'Monthly window and glazing maintenance, with a full facade clean included every quarter in the same visit.',
        category: 'CONTRACTS',
        pricingMethod: 'CONTRACT_COMBINED_PROGRAMME',
        internalNotes: '= 8 × item 1 + 4 × item 2 per year at the monthly rate, generated as recurring visits. Landmark flag forces Once-off + Full facade on first quote.'
    }
];`;

if (file.includes('itemNumber: 21')) {
  console.log('Already updated');
} else {
  const hasCRLF = file.includes('\r\n');
  const normalizedFile = file.replace(/\r\n/g, '\n');
  const normalizedTarget = target.replace(/\r\n/g, '\n');
  const normalizedReplacement = replacement.replace(/\r\n/g, '\n');
  if (normalizedFile.includes(normalizedTarget)) {
    const updated = normalizedFile.replace(normalizedTarget, normalizedReplacement);
    fs.writeFileSync('src/lib/aerowash-catalogue.ts', hasCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
    console.log('Successfully updated aerowash-catalogue.ts with 22 items');
  } else {
    console.error('Target not found in aerowash-catalogue.ts');
  }
}
