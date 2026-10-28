const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/CatalogSidePanel.tsx', 'utf8');

// Replace rate / unit line
const targetPrice = `<span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {formatCurrency(price, currencySymbol)} / {item.unit || "ea"}
                        </span>`;

const replacePrice = `<span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {item.rateNote ? (
                                <span className="text-amber-400 font-semibold">{item.rateNote}</span>
                            ) : (
                                \`\${formatCurrency(price, currencySymbol)} / \${item.unit || "ea"}\`
                            )}
                        </span>`;

// Replace description block
const targetDesc = `{/* Full Description with wrapping */}
                <p className="text-gray-200 font-medium text-[12px] leading-relaxed break-words">
                    {item.description}
                </p>`;

const replaceDesc = `{/* Full Description with wrapping */}
                <div className="space-y-0.5">
                    {item.isCatalogueItem && item.name && (
                        <p className="text-white font-bold text-[12px] leading-snug">
                            {item.name}
                        </p>
                    )}
                    <p className="text-gray-300 font-normal text-[11px] leading-relaxed break-words">
                        {item.clientDescription || item.description}
                    </p>
                </div>`;

const hasCRLF = code.includes('\r\n');
let normalized = code.replace(/\r\n/g, '\n');
const normTargetPrice = targetPrice.replace(/\r\n/g, '\n');
const normReplacePrice = replacePrice.replace(/\r\n/g, '\n');
const normTargetDesc = targetDesc.replace(/\r\n/g, '\n');
const normReplaceDesc = replaceDesc.replace(/\r\n/g, '\n');

if (normalized.includes(normTargetPrice)) {
  normalized = normalized.replace(normTargetPrice, normReplacePrice);
}
if (normalized.includes(normTargetDesc)) {
  normalized = normalized.replace(normTargetDesc, normReplaceDesc);
}

fs.writeFileSync('src/components/invoices/CatalogSidePanel.tsx', hasCRLF ? normalized.replace(/\n/g, '\r\n') : normalized, 'utf8');
console.log('Successfully updated CatalogSidePanel.tsx');
