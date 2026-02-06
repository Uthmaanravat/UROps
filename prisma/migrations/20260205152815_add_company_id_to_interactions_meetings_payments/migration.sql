/*
  Warnings:

  - A unique constraint covering the columns `[companyId]` on the table `CompanySettings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `CompanySettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Interaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Meeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `PricingKnowledge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `ScopeOfWork` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `SubmissionLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `WorkBreakdownPricing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "companyId" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PricingKnowledge" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ScopeOfWork" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SubmissionLog" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkBreakdownPricing" ADD COLUMN     "companyId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedPriceItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedPriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeOfWork" ADD CONSTRAINT "ScopeOfWork_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkBreakdownPricing" ADD CONSTRAINT "WorkBreakdownPricing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingKnowledge" ADD CONSTRAINT "PricingKnowledge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedPriceItem" ADD CONSTRAINT "FixedPriceItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLog" ADD CONSTRAINT "SubmissionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
