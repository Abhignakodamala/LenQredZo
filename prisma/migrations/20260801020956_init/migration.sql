-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT DEFAULT '#1e40af',
    "subdomain" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "companyId" INTEGER,
    "branchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "aadhar" TEXT,
    "pan" TEXT,
    "companyId" INTEGER,
    "branchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "nationality" TEXT DEFAULT 'Indian',
    "altIdType" TEXT,
    "altIdNumber" TEXT,
    "alternateMobile" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "residenceType" TEXT,
    "permanentAddress" TEXT,
    "employmentType" TEXT,
    "employerName" TEXT,
    "designation" TEXT,
    "workEmail" TEXT,
    "monthlyIncome" DOUBLE PRECISION,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "isPEP" BOOLEAN NOT NULL DEFAULT false,
    "isForeignTaxResident" BOOLEAN NOT NULL DEFAULT false,
    "nomineeName" TEXT,
    "nomineeRelation" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "consentPlace" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "interestType" TEXT NOT NULL DEFAULT 'percentage',
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "tenure" INTEGER NOT NULL,
    "disbursedAmount" DOUBLE PRECISION,
    "deductUpfront" BOOLEAN NOT NULL DEFAULT false,
    "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processingFeeType" TEXT NOT NULL DEFAULT 'percentage',
    "penaltyType" TEXT NOT NULL DEFAULT 'none',
    "penaltyValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roundEmi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EMI" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltyPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EMI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guarantor" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "aadhar" TEXT,
    "pan" TEXT,
    "relationship" TEXT,
    "type" TEXT NOT NULL DEFAULT 'guarantor',
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guarantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_subdomain_key" ON "Company"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EMI" ADD CONSTRAINT "EMI_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantor" ADD CONSTRAINT "Guarantor_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
