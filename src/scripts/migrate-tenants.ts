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

    // 2. Link all existing users to this company
    // const userUpdate = await prisma.user.updateMany({
    //     where: { companyId: null },
    //     data: { companyId: company.id },
    // })
    // console.log(`Updated ${userUpdate.count} users`)

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

    // 4. Link all transactional data
    const models = [
        'client',
        'project',
        'invoice',
        'scopeOfWork',
        'workBreakdownPricing',
        'pricingKnowledge',
        'fixedPriceItem',
        'submissionLog'
    ]

    for (const model of models) {
        // const count = await (prisma as any)[model].updateMany({
        //     where: { companyId: null },
        //     data: { companyId: company.id },
        // })
        console.log(`Skipping migration for ${model} - schema enforced`)
    }

    console.log('Migration completed successfully!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
