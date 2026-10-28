const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

const target = `        if (group.title === "Financials" && !isTendersEnabled) {
            return {
                ...group,
                items: group.items.filter(item => item.href !== "/tenders")
            };
        }
        return group;`;

const replacement = `        if (group.title === "Financials" && !isTendersEnabled) {
            return {
                ...group,
                items: group.items.filter(item => item.href !== "/tenders")
            };
        }
        if (group.title === "System") {
            const isAeroWash = isDroneEnabled || settings?.theme === "dark-orange" || settings?.companyId === "70af7281-072d-4ed5-9f2e-af4d93e99ea9";
            if (isAeroWash && !group.items.some(item => item.title === "AeroWash Catalogue")) {
                return {
                    ...group,
                    items: [
                        { title: "Settings", href: "/settings" },
                        { title: "Quotation Terms", href: "/settings/terms" },
                        { title: "AeroWash Catalogue", href: "/settings/catalogue" }
                    ]
                };
            }
        }
        return group;`;

const targetNormalized = target.replace(/\r\n/g, '\n');
const contentNormalized = content.replace(/\r\n/g, '\n');

if (contentNormalized.includes(targetNormalized)) {
    content = contentNormalized.replace(targetNormalized, replacement.replace(/\r\n/g, '\n'));
    fs.writeFileSync('src/components/layout/Sidebar.tsx', content, 'utf8');
    console.log('Sidebar patched successfully!');
} else {
    console.error('Target not found in Sidebar.tsx');
}
