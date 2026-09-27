-- CreateTable
CREATE TABLE "OTP" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OTP_email_type_idx" ON "OTP"("email", "type");

-- CreateIndex
CREATE INDEX "OTP_phone_type_idx" ON "OTP"("phone", "type");
