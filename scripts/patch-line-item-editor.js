const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/LineItemEditor.tsx', 'utf8');

// 1. Add justificationEnabled to LineItemEditorProps
code = code.replace(
  'isInvoice?: boolean\n}',
  'isInvoice?: boolean\n    justificationEnabled?: boolean\n}'
);

// 2. Add justificationEnabled to component signature
code = code.replace(
  'isInvoice = false\n}: LineItemEditorProps',
  'isInvoice = false,\n    justificationEnabled = true\n}: LineItemEditorProps'
);

// 3. Condition the justification dropdown
code = code.replace(
  ') : !isInvoice ? (',
  ') : (!isInvoice && justificationEnabled !== false) ? ('
);

fs.writeFileSync('src/components/invoices/LineItemEditor.tsx', code, 'utf8');
console.log('Successfully patched LineItemEditor.tsx');
