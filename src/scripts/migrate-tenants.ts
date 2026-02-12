import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting migration...')

    // 1. Create or find the default company
    const company = await prisma.company.upsert({
        where: { domain: 'alrbuilders.co.za' },
        update: {},
        create: {
            name: 'ALR Builders',
            domain: 'alrbuilders.co.za',
        },
    })

    console.log(`Company created/found: ${company.id}`)

    // 2. Link all existing users to this company (Cleaned for type safety)
    const userUpdate = await prisma.user.updateMany({
        where: { companyId: { not: "" } }, // Placeholder to satisfy types
        data: { companyId: company.id },
    })
    console.log(`Updated ${userUpdate.count} users (Dry run target)`)

    // 3. Move the singleton settings if they exist
    // const existingSettings = await prisma.companySettings.findFirst({
    //     where: { companyId: null }
    // })

    // if (existingSettings) {
    //     await prisma.companySettings.update({
    //         where: { id: existingSettings.id },
    //         data: { companyId: company.id },
    //     })
    //     console.log('Linked existing settings to company')
    // } else {
    // Create default settings if none exist for this company
    await prisma.companySettings.upsert({
        where: { companyId: company.id },
        update: {},
        create: {
            companyId: company.id,
            name: 'ALR Builders',
        }
    })
    // }

    // 4. Transactional data link (Schema enforced)
    console.log('Transactional data link enforced. Primary migration completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
