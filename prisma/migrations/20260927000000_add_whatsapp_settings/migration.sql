-- Add per-company WhatsApp Cloud API configuration.
ALTER TABLE "Company"
  ADD COLUMN "whatsappToken" TEXT,
  ADD COLUMN "whatsappPhoneNumberId" TEXT;
