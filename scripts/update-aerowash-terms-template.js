const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NEW_TERMS_BODY = `INCLUDED
Auto-list the items on this quote by name, then always add:
• Pre- and post-clean photographic record
• All labour, equipment and remote pilot crew

EXCLUDED
Auto-list first, in bold: exclusions ticked on the quote's elevations + cracked/damaged condition-flag locations. Then always:
• Internal faces of glass, unless separately agreed
• Hardened cement, paint and adhesive residue
• Repair of existing damage, failed sealant or penetrated staining

CONDITIONS OF ACCESS
• The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.
• All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.
• Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.
• The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

COMMERCIAL TERMS
• Quotations are fixed price for the scope and elevations stated.
• A 60% deposit is payable on acceptance to secure the booking.
• The balance is payable on completion.
• This quotation is valid for 45 days from the date of issue.
• Any variation or additional work is quoted separately before it is carried out.
• Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.
• Where work cannot start, continue or be completed for reasons outside AeroWash's control, including site access not being available or work being stopped at the client's request, a standby or return attendance charge applies, agreed with you before it is invoiced.
• Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

NOTE ON INTRODUCTORY ALLOWANCE
Note on the introductory allowance. [Item names] are shown above at their standard value and are included at no charge on this first engagement only, as an introduction to our service. They will be quoted at standard rates on subsequent works.

ACCEPTANCE
To proceed, sign below and return, or confirm by email to info@aerowash.co.za.`;

async function updateTerms() {
  const companyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
  const existing = await prisma.termsTemplate.findFirst({
    where: { companyId }
  });

  if (existing) {
    await prisma.termsTemplate.update({
      where: { id: existing.id },
      data: {
        name: 'AeroWash Standard Quotation Terms',
        body: NEW_TERMS_BODY
      }
    });
    console.log('Updated existing AeroWash TermsTemplate:', existing.id);
  } else {
    const created = await prisma.termsTemplate.create({
      data: {
        companyId,
        name: 'AeroWash Standard Quotation Terms',
        body: NEW_TERMS_BODY,
        isDefault: true
      }
    });
    console.log('Created AeroWash TermsTemplate:', created.id);
  }
}

updateTerms().catch(console.error).finally(() => prisma.$disconnect());
