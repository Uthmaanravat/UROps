const fs = require('fs');
let code = fs.readFileSync('src/lib/aerowash-catalogue.ts', 'utf8');

if (!code.includes('generateAeroWashScopeOfWorks')) {
  const addition = `

/**
 * Auto-generates a client-facing Scope of Works description from selected items and site info.
 * Hard rule: Plain client language, NO passes, pressures, chemicals, water type/volumes.
 */
export function generateAeroWashScopeOfWorks(params: {
    siteName?: string;
    elevationNames?: string[];
    hasGlazing?: boolean;
    hasFullFacade?: boolean;
    hasRoofClean?: boolean;
    hasSolarClean?: boolean;
    hasSignage?: boolean;
    hasBirdFouling?: boolean;
    hasStainPreTreatment?: boolean;
    hasPostConstruction?: boolean;
    hasFacadeSurvey?: boolean;
    hasThermalSurvey?: boolean;
}): string {
    const siteStr = params.siteName ? \` at \${params.siteName}\` : '';
    const elevStr = params.elevationNames && params.elevationNames.length > 0
        ? params.elevationNames.join(', ')
        : 'the exposed building elevations';

    const sentences: string[] = [];

    // Base sentence
    const cleanType = params.hasFullFacade ? 'full facade and window' : 'exterior maintenance';
    sentences.push(
        \`Exterior maintenance cleaning of \${elevStr}\${siteStr}, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.\`
    );

    if (params.hasRoofClean) {
        sentences.push('Includes soft wash treatment of roof surfaces to remove organic growth and accumulated debris.');
    }
    if (params.hasSolarClean) {
        sentences.push('Includes pure water cleaning of the solar photovoltaic panel array.');
    }
    if (params.hasSignage) {
        sentences.push('Includes cleaning of building signage, entrance features and canopies.');
    }
    if (params.hasBirdFouling) {
        sentences.push('Includes targeted treatment and removal of bird fouling from facade surfaces, ledges and roof areas.');
    }
    if (params.hasStainPreTreatment) {
        sentences.push('Includes pre-treatment of organic growth and surface staining across affected facade areas.');
    }
    if (params.hasPostConstruction) {
        sentences.push('Includes removal of construction dust and residue from exterior surfaces.');
    }
    if (params.hasFacadeSurvey) {
        sentences.push('Includes high-resolution aerial photographic condition survey of the building envelope.');
    }
    if (params.hasThermalSurvey) {
        sentences.push('Includes thermal imaging survey of roof surfaces to inspect membrane integrity.');
    }

    return sentences.join(' ');
}
`;
  code = code + addition;
  fs.writeFileSync('src/lib/aerowash-catalogue.ts', code, 'utf8');
  console.log('Added generateAeroWashScopeOfWorks to aerowash-catalogue.ts');
} else {
  console.log('Already present');
}
