const fs = require('fs');
let code = fs.readFileSync('src/app/(dashboard)/invoices/actions.ts', 'utf8');

const targetStart = `    const companyId = await ensureAuth()
    const year = new Date().getFullYear();`;

const replacementStart = `    const companyId = await ensureAuth()
    console.log('[createInvoiceAction] Initiating invoice/quote creation:', {
        companyId,
        clientId: data.clientId,
        type: data.type,
        workType: data.workType,
        site: data.site,
        itemsCount: data.items?.length,
        hasMetadata: !!data.metadata
    });

    try {
        const year = new Date().getFullYear();`;

const targetEnd = `    revalidatePath("/drone");
    revalidatePath("/invoices");
    revalidatePath("/projects");
    revalidatePath("/clients");
    revalidatePath(\`/clients/\${data.clientId}\`);
    if (effectiveProjectId) {
        revalidatePath(\`/projects/\${effectiveProjectId}\`);
    }
    return invoice.id;
}`;

const replacementEnd = `    revalidatePath("/drone");
    revalidatePath("/invoices");
    revalidatePath("/projects");
    revalidatePath("/clients");
    revalidatePath(\`/clients/\${data.clientId}\`);
    if (effectiveProjectId) {
        revalidatePath(\`/projects/\${effectiveProjectId}\`);
    }

    console.log('[createInvoiceAction] Invoice created successfully with ID:', invoice.id, 'Number:', formattedQuoteNumber);
    return invoice.id;
    } catch (err: any) {
        console.error('[createInvoiceAction] FATAL ERROR:', {
            name: err?.name,
            message: err?.message,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
            companyId,
            clientId: data.clientId
        });
        throw new Error(err?.message || "Failed to save quotation on server.");
    }
}`;

const normStart = targetStart.replace(/\r\n/g, '\n');
const normEnd = targetEnd.replace(/\r\n/g, '\n');
let normCode = code.replace(/\r\n/g, '\n');

if (normCode.includes(normStart) && normCode.includes(normEnd)) {
    normCode = normCode.replace(normStart, replacementStart.replace(/\r\n/g, '\n'));
    normCode = normCode.replace(normEnd, replacementEnd.replace(/\r\n/g, '\n'));
    fs.writeFileSync('src/app/(dashboard)/invoices/actions.ts', normCode, 'utf8');
    console.log('actions.ts patched with full try/catch error logging!');
} else {
    console.error('Targets not found in actions.ts', {
        hasStart: normCode.includes(normStart),
        hasEnd: normCode.includes(normEnd)
    });
}
