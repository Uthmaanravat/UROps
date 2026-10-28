const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testProjectUpdate() {
    try {
        console.log('Testing prisma.project.update with { id, companyId }...');
        // Just checking TypeScript / runtime behavior
        await prisma.project.update({
            where: { id: 'dummy-id', companyId: 'dummy-company' },
            data: { status: 'SOW' }
        });
    } catch (e) {
        console.log('Error from project.update:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testProjectUpdate();
