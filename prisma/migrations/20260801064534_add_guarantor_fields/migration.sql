-- AlterTable
ALTER TABLE "Guarantor" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "consentDate" TIMESTAMP(3),
ADD COLUMN     "consentGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "grossAnnualIncome" DOUBLE PRECISION,
ADD COLUMN     "pinCode" TEXT;
